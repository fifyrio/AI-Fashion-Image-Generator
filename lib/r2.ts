import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, _Object } from '@aws-sdk/client-s3';
import { KIETaskMetadata } from './kie-image-service';

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

export async function deleteObjectFromR2(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    await r2Client.send(command);
  } catch (error) {
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return;
    }
    throw error;
  }
}

/**
 * KIE 任务元数据管理
 */

// 生成任务元数据的 R2 Key
function getTaskMetadataKey(taskId: string): string {
  return `kie-tasks/${taskId}.json`;
}

/**
 * 保存 KIE 任务元数据到 R2
 */
export async function saveKIETaskMetadata(metadata: KIETaskMetadata): Promise<void> {
  const key = getTaskMetadataKey(metadata.taskId);
  await uploadJsonToR2(key, metadata as unknown as Record<string, unknown>);
  console.log(`✅ Saved KIE task metadata: ${key}`);
}

/**
 * 从 R2 读取 KIE 任务元数据
 */
export async function getKIETaskMetadata(taskId: string): Promise<KIETaskMetadata | null> {
  const key = getTaskMetadataKey(taskId);

  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    const response = await r2Client.send(command);

    if (!response.Body) {
      return null;
    }

    // 读取流数据
    const bodyString = await response.Body.transformToString();
    const metadata = JSON.parse(bodyString) as KIETaskMetadata;

    return metadata;
  } catch (error) {
    // 如果对象不存在，返回 null
    if ((error as { name?: string }).name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

/**
 * 更新 KIE 任务元数据
 */
export async function updateKIETaskMetadata(
  taskId: string,
  updates: Partial<KIETaskMetadata>
): Promise<KIETaskMetadata | null> {
  const existing = await getKIETaskMetadata(taskId);

  if (!existing) {
    console.warn(`⚠️  Task metadata not found: ${taskId}`);
    return null;
  }

  const updated: KIETaskMetadata = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await saveKIETaskMetadata(updated);
  return updated;
}
