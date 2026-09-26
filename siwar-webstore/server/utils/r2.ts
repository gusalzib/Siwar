// server/utils/r2.ts
import { S3Client } from '@aws-sdk/client-s3'

let s3ClientInstance: S3Client | null = null

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

  const config = useRuntimeConfig()

  if (!config.r2AccountId || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
    throw new Error('Cloudflare R2 credentials are missing from runtimeConfig / .env')
  }

  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
    },
  })

  return s3ClientInstance
}