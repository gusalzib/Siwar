// server/utils/r2.ts
import { S3Client } from '@aws-sdk/client-s3'

let s3ClientInstance: S3Client | null = null

function cleanEnv(val?: string | null): string {
  if (!val) return ''
  let cleaned = String(val).trim()
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  return cleaned
}

export interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucketName: string
  publicUrl: string
  endpoint: string
}

/**
 * Resolves Cloudflare R2 configuration from Nuxt runtimeConfig or runtime environment variables.
 * In Docker/Railway deployments, process.env injected at container runtime does not map
 * to useRuntimeConfig() automatically unless prefixed with NUXT_, so direct process.env
 * fallbacks are required.
 */
export function getR2Config(): R2Config {
  const config = useRuntimeConfig()

  const accountId = cleanEnv(
    config.r2AccountId ||
    process.env.R2_ACCOUNT_ID ||
    process.env.NUXT_R2_ACCOUNT_ID
  )

  const accessKeyId = cleanEnv(
    config.r2AccessKeyId ||
    process.env.R2_ACCESS_KEY_ID ||
    process.env.NUXT_R2_ACCESS_KEY_ID
  )

  const secretAccessKey = cleanEnv(
    config.r2SecretAccessKey ||
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.NUXT_R2_SECRET_ACCESS_KEY
  )

  const bucketName = cleanEnv(
    config.r2BucketName ||
    process.env.R2_BUCKET_NAME ||
    process.env.NUXT_R2_BUCKET_NAME
  )

  const rawPublicUrl = cleanEnv(
    (config.public?.r2PublicUrl as string) ||
    process.env.R2_PUBLIC_URL ||
    process.env.NUXT_PUBLIC_R2_PUBLIC_URL
  )
  const publicUrl = rawPublicUrl.replace(/\/+$/, '')

  // Determine endpoint: support explicit R2_ENDPOINT or derive from accountId
  let endpoint = cleanEnv(
    process.env.R2_ENDPOINT ||
    process.env.NUXT_R2_ENDPOINT
  )
  if (!endpoint && accountId) {
    if (accountId.startsWith('http://') || accountId.startsWith('https://')) {
      endpoint = accountId
    } else {
      endpoint = `https://${accountId}.r2.cloudflarestorage.com`
    }
  }
  if (endpoint) {
    endpoint = endpoint.replace(/\/+$/, '')
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
    endpoint,
  }
}

/**
 * Returns a singleton S3Client instance configured for Cloudflare R2.
 * 
 * Purpose:
 * Cloudflare R2 uses the AWS S3 v4 signature protocol. Rather than connecting
 * to AWS servers, the endpoint points to Cloudflare's regional endpoint:
 * https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 */
export function getR2Client(): S3Client {
  if (s3ClientInstance) {
    return s3ClientInstance
  }

  const { accountId, accessKeyId, secretAccessKey, endpoint } = getR2Config()

  if (!accountId || !accessKeyId || !secretAccessKey) {
    const missing: string[] = []
    if (!accountId) missing.push('R2_ACCOUNT_ID')
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID')
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY')

    console.error('❌ Cloudflare R2 configuration error. Missing variables:', missing.join(', '))
    throw createError({
      statusCode: 500,
      statusMessage: `Cloudflare R2 configuration error: Missing environment variables (${missing.join(', ')}). Check your environment variables on Railway.`,
    })
  }

  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return s3ClientInstance
}