// server/api/admin/upload.post.ts
import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { getR2Client, getR2Config } from '~/server/utils/r2'

/**
 * Route: POST /api/admin/upload
 * Access: Admin only (protected by server/middleware/admin-auth.ts)
 * 
 * Purpose:
 * Receives raw product photos (JPG, PNG, HEIC, WebP) via multipart/form-data,
 * optimizes and converts them to standard WebP using Sharp, and persists them
 * to the Cloudflare R2 object storage bucket.
 * 
 * Response Shape (HTTP 201 Created):
 * {
 *   "statusCode": 201,
 *   "url": "https://pub-xxx.r2.dev/products/1727339100000-a1b2c3d4.webp",
 *   "fileName": "products/1727339100000-a1b2c3d4.webp"
 * }
 */
export default defineEventHandler(async (event) => {
  // 1. Read multipart form data from the incoming HTTP request
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No file provided in request',
    })
  }

  // 2. Locate the file field (expected name: 'file')
  const filePart = formData.find((part) => part.name === 'file' && part.filename)
  if (!filePart || !filePart.data || filePart.data.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or empty file payload',
    })
  }

  // 3. Security & Validation Guards:
  // - Enforce maximum raw upload limit (10 MB)
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
  if (filePart.data.length > MAX_FILE_SIZE_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: 'File size exceeds the 10 MB limit',
    })
  }

  // - Validate declared MIME type
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/avif', 'image/tiff']
  if (!filePart.type || !allowedMimeTypes.includes(filePart.type.toLowerCase())) {
    throw createError({
      statusCode: 415,
      statusMessage: 'Only image files (JPEG, JPG, PNG, WebP, AVIF, TIFF) are permitted',
    })
  }

  // 4. Image Processing via Sharp:
  // - .rotate(): auto-orients photos using EXIF orientation tags (e.g. photos taken from phones)
  // - .resize(): caps max width/height at 1600px without enlarging smaller images
  // - .webp(): encodes with 82% quality for balanced compression and high-DPI clarity
  let processedBuffer: Buffer
  try {
    processedBuffer = await sharp(filePart.data)
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer()
  } catch (err: any) {
    console.error('Sharp image processing error:', err)
    throw createError({
      statusCode: 422,
      statusMessage: `Image optimization failed: ${err.message || 'Corrupted file'}`,
    })
  }

  // 5. Generate deterministic, collision-resistant object key in R2
  // Format: products/<timestamp>-<uuid>.webp
  const objectKey = `products/${Date.now()}-${randomUUID()}.webp`

  // 6. Resolve R2 credentials and bucket config
  const r2Config = getR2Config()
  if (!r2Config.bucketName) {
    console.error('❌ Cloudflare R2 error: R2_BUCKET_NAME is missing.')
    throw createError({
      statusCode: 500,
      statusMessage: 'Cloudflare R2 configuration error: Missing R2_BUCKET_NAME environment variable on Railway.',
    })
  }

  let r2
  try {
    r2 = getR2Client()
  } catch (err: any) {
    console.error('❌ Cloudflare R2 Client error:', err)
    throw createError({
      statusCode: 500,
      statusMessage: err.statusMessage || err.message || 'Failed to initialize Cloudflare R2 client',
    })
  }

  // 7. Upload directly to Cloudflare R2
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: r2Config.bucketName,
        Key: objectKey,
        Body: processedBuffer,
        ContentType: 'image/webp',
        // Cache for 1 year since object keys are immutable and content-hashed by timestamp+UUID
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
  } catch (err: any) {
    console.error('❌ Cloudflare R2 PutObjectCommand error:', err)
    throw createError({
      statusCode: 502,
      statusMessage: `Cloudflare R2 storage error: ${err.message || 'Upload failed'} (${err.name || 'PutObjectError'})`,
    })
  }

  // 8. Assemble public URL for client consumption
  // Uses R2_PUBLIC_URL if defined (e.g. https://pub-xxx.r2.dev or custom CDN domain).
  let publicBaseUrl = r2Config.publicUrl
  if (!publicBaseUrl) {
    console.warn('⚠️ R2_PUBLIC_URL is not set. Falling back to default R2 bucket URL.')
    publicBaseUrl = `https://${r2Config.bucketName}.${r2Config.accountId}.r2.cloudflarestorage.com`
  }

  const publicUrl = `${publicBaseUrl}/${objectKey}`

  setResponseStatus(event, 201)
  return {
    statusCode: 201,
    url: publicUrl,
    fileName: objectKey,
  }
})