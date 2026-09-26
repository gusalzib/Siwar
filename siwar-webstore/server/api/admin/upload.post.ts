// server/api/admin/upload.post.ts
import { randomUUID } from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import { getR2Client } from '~/server/utils/r2'

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
  const config = useRuntimeConfig()

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
    throw createError({
      statusCode: 422,
      statusMessage: `Image optimization failed: ${err.message || 'Corrupted file'}`,
    })
  }

  // 5. Generate deterministic, collision-resistant object key in R2
  // Format: products/<timestamp>-<uuid>.webp
  const objectKey = `products/${Date.now()}-${randomUUID()}.webp`

  // 6. Upload directly to Cloudflare R2
  const r2 = getR2Client()
  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: config.r2BucketName,
        Key: objectKey,
        Body: processedBuffer,
        ContentType: 'image/webp',
        // Cache for 1 year since object keys are immutable and content-hashed by timestamp+UUID
        CacheControl: 'public, max-age=31536000, immutable',
      })
    )
  } catch (err: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Cloudflare R2 storage error: ${err.message || 'Upload failed'}`,
    })
  }

  // 7. Assemble public URL for client consumption
  const publicBaseUrl = ((config.public.r2PublicUrl as string) || '').replace(/\/$/, '')
  const publicUrl = `${publicBaseUrl}/${objectKey}`

  setResponseStatus(event, 201)
  return {
    statusCode: 201,
    url: publicUrl,
    fileName: objectKey,
  }
})