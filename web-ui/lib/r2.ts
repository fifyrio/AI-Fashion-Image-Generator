import { S3Client, PutObjectCommand, ListObjectsV2Command, _Object } from '@aws-sdk/client-s3';

/**
 * Helper to read required environment variables with descriptive errors.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const accountId = requireEnv('R2_ACCOUNT_ID');
const accessKeyId = requireEnv('R2_ACCESS_KEY_ID');
const secretAccessKey = requireEnv('R2_SECRET_ACCESS_KEY');
const bucketName = requireEnv('R2_BUCKET_NAME');
const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');

/**
 * Singleton R2 client configured for Cloudflare's S3-compatible API.
 */
export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

/**
 * Builds the public URL for a given object key.
 * Falls back to the default public bucket domain if R2_PUBLIC_BASE_URL is not provided.
 */
export function getPublicUrl(key: string): string {
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${key}`;
  }

  // Default public URL pattern for R2 buckets with public access enabled
  return `https://${bucketName}.${accountId}.r2.cloudflarestorage.com/${key}`;
}

interface UploadBufferOptions {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

/**
 * Uploads binary data to R2.
 */
export async function uploadBufferToR2(options: UploadBufferOptions): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: options.key,
    Body: options.body,
    ContentType: options.contentType,
    CacheControl: options.cacheControl ?? 'public, max-age=31536000, immutable',
    Metadata: options.metadata,
  });

  await r2Client.send(command);
}

/**
 * Uploads JSON content to R2.
 */
export async function uploadJsonToR2(key: string, data: Record<string, unknown>): Promise<void> {
  const body = Buffer.from(JSON.stringify(data, null, 2));
  await uploadBufferToR2({
    key,
    body,
    contentType: 'application/json',
    cacheControl: 'no-cache',
  });
}

interface ListOptions {
  prefix?: string;
  maxKeys?: number;
}

/**
 * Lists objects stored in the configured bucket.
 */
export async function listObjects(prefix = '', maxKeys = 1000): Promise<_Object[]> {
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await r2Client.send(command);
  return response.Contents ?? [];
}

export function getBucketName(): string {
  return bucketName;
}
