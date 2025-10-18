import { randomUUID } from 'crypto';
import path from 'path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import {
  uploadBufferToR2,
  uploadJsonToR2,
  getPublicUrl,
  listObjects,
  getBucketName,
  r2Client,
  getKIETaskMetadata,
  updateKIETaskMetadata,
} from './r2';
import { AIService } from './ai-service';
import { ImageGenerator } from './image-generator';
import { KIEImageService } from './kie-image-service';
import {
  GenerationFailure,
  GenerationRequest,
  GeneratedImageRecord,
  UploadedReference,
} from './types';

export const VALID_CHARACTERS = ['lin', 'Qiao', 'lin_home_1', 'ayi'] as const;
export type Character = (typeof VALID_CHARACTERS)[number];

function getModelBaseUrl(): string {
  return process.env.R2_MODEL_BASE_URL || process.env.R2_PUBLIC_BASE_URL || 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev';
}

export function getRandomModelUrl(name: Character): string {
  const host = getModelBaseUrl();

  const linHomeMatch = name.match(/^lin_home_(\d+)$/);
  if (linHomeMatch) {
    const homeNumber = linHomeMatch[1];
    return `${host}/lin_home_${homeNumber}/frame_1.png`;
  }

  const randomNumber = Math.floor(Math.random() * 10) + 1;
  return `${host}/${name}/frame_${randomNumber}.jpg`;
}

function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
  };
  return map[mimeType] || '.png';
}

async function resolveImageResult(result: string): Promise<{ buffer: Buffer; mimeType: string }> {
  if (result.startsWith('data:image/')) {
    const matches = result.match(/^data:([^;]+);base64,(.+)$/s);
    if (!matches) {
      throw new Error('Invalid data URI returned by generator');
    }

    const [, mimeType, base64Data] = matches;
    return {
      mimeType,
      buffer: Buffer.from(base64Data, 'base64'),
    };
  }

  if (result.startsWith('http://') || result.startsWith('https://')) {
    const response = await fetch(result);
    if (!response.ok) {
      throw new Error(`Failed to download generated image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type')?.split(';')[0] || 'image/png';
    const arrayBuffer = await response.arrayBuffer();

    return {
      mimeType: contentType,
      buffer: Buffer.from(arrayBuffer),
    };
  }

  throw new Error('Unsupported generated result format. Expected data URI or HTTPS URL.');
}

function buildBaseKey(character: string): string {
  return `generated/${character}/${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
}

async function saveGeneratedArtifact(params: {
  character: string;
  analysis: string;
  buffer: Buffer;
  mimeType: string;
  source: UploadedReference;
  xiaohongshuTitle?: string;
}): Promise<GeneratedImageRecord> {
  const { character, analysis, buffer, mimeType, source, xiaohongshuTitle } = params;
  const extension = getExtensionFromMime(mimeType);
  const baseKey = buildBaseKey(character);
  const imageKey = `${baseKey}${extension}`;

  await uploadBufferToR2({
    key: imageKey,
    body: buffer,
    contentType: mimeType,
  });

  const createdAt = new Date().toISOString();
  const metadataKey = `${baseKey}.json`;

  const metadata = {
    createdAt,
    character,
    source,
    imageKey,
    imageUrl: getPublicUrl(imageKey),
    analysis,
    xiaohongshuTitle,
  };

  await uploadJsonToR2(metadataKey, metadata);

  return {
    imageKey,
    imageUrl: metadata.imageUrl,
    metadataKey,
    metadataUrl: getPublicUrl(metadataKey),
    xiaohongshuTitle,
    analysis,
    source,
    createdAt,
    character,
  };
}

/**
 * 轮询等待 KIE 任务完成
 * @param taskId 任务 ID
 * @param maxAttempts 最大轮询次数（默认30次，共60秒）
 * @param intervalMs 轮询间隔（默认2秒）
 * @returns 生成的图片 URL 数组
 */
async function pollKIETaskCompletion(
  taskId: string,
  maxAttempts: number = 30,
  intervalMs: number = 2000
): Promise<string[]> {
  for (let i = 0; i < maxAttempts; i++) {
    const metadata = await getKIETaskMetadata(taskId);

    if (!metadata) {
      console.log(
        `[pipeline] Task metadata not yet available for ${taskId} (attempt ${i + 1}/${maxAttempts})`
      );
    } else {
      if (metadata.status === 'completed' && metadata.resultUrls && metadata.resultUrls.length > 0) {
        console.log(`[pipeline] KIE task completed: ${taskId}`);
        return metadata.resultUrls;
      }

      if (metadata.status === 'failed') {
        throw new Error(`KIE task failed: ${metadata.error || 'Unknown error'}`);
      }

      if (metadata.status === 'timeout') {
        throw new Error(`KIE task timed out: ${metadata.error || 'Timeout recorded in metadata'}`);
      }

      // 任务还在进行中，等待后重试
      console.log(
        `[pipeline] Waiting for KIE task ${taskId} (attempt ${i + 1}/${maxAttempts}), status="${metadata.status}"`
      );
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  const waitedSeconds = (maxAttempts * intervalMs) / 1000;
  const timeoutMessage = `KIE task timeout: ${taskId} (waited ${waitedSeconds} seconds)`;

  try {
    await updateKIETaskMetadata(taskId, {
      status: 'timeout',
      error: timeoutMessage,
    });
  } catch (updateError) {
    console.warn(
      `[pipeline] Failed to record timeout for task ${taskId}:`,
      updateError instanceof Error ? updateError.message : updateError
    );
  }

  throw new Error(timeoutMessage);
}

export async function runGenerationPipeline(request: GenerationRequest): Promise<{
  generated: GeneratedImageRecord[];
  failures: GenerationFailure[];
}> {
  console.log(
    `[pipeline] Starting KIE generation for character="${request.character}" with ${request.uploads.length} reference(s)`
  );
  const aiService = new AIService();
  const kieService = new KIEImageService();

  const generated: GeneratedImageRecord[] = [];
  const failures: GenerationFailure[] = [];

  for (let index = 0; index < request.uploads.length; index++) {
    const upload = request.uploads[index];
    console.log(
      `[pipeline] [${index + 1}/${request.uploads.length}] Processing key="${upload.key}" filename="${upload.filename ?? 'N/A'}"`
    );
    try {
      const filename = upload.filename ?? path.basename(upload.key);
      const analysisResult = await aiService.analyzeImage(upload.url, filename);

      if (!analysisResult.success) {
        console.warn(
          `[pipeline] Analysis failed for key="${upload.key}" reason="${analysisResult.error ?? 'unknown'}"`
        );
        throw new Error(analysisResult.error || 'Image analysis failed');
      }

      const clothingDetails = analysisResult.analysis;
      console.log(`[pipeline] Analysis succeeded, summary length=${clothingDetails.length}`);
      const modelImageUrl = getRandomModelUrl(request.character as Character);
      console.log(`[pipeline] Using model image URL="${modelImageUrl}"`);

      // 使用 KIE 创建任务
      const generationResult = await kieService.generateImageBase64(clothingDetails, modelImageUrl);
      if (!generationResult.success || !generationResult.taskId) {
        console.warn(
          `[pipeline] KIE task creation failed for key="${upload.key}" reason="${generationResult.error ?? 'unknown'}"`
        );
        throw new Error(generationResult.error || 'KIE task creation failed');
      }

      const taskId = generationResult.taskId;
      console.log(`[pipeline] KIE task created: ${taskId}, waiting for completion...`);

      // 轮询等待任务完成（callback 会更新状态）
      const resultUrls = await pollKIETaskCompletion(taskId);
      console.log(`[pipeline] KIE task completed, got ${resultUrls.length} result(s)`);

      // 获取第一个结果 URL
      const resultUrl = resultUrls[0];
      const { buffer, mimeType } = await resolveImageResult(resultUrl);
      console.log(
        `[pipeline] Downloaded result, mimeType="${mimeType}", bufferSize=${buffer.length} bytes`
      );

      let xiaohongshuTitle: string | undefined;
      try {
        xiaohongshuTitle = await aiService.generateXiaohongshuTitle(clothingDetails, 1);
        console.log('[pipeline] Xiaohongshu title generated successfully');
      } catch (titleError) {
        console.warn('Failed to generate Xiaohongshu title:', titleError);
      }

      const record = await saveGeneratedArtifact({
        character: request.character,
        analysis: clothingDetails,
        buffer,
        mimeType,
        source: upload,
        xiaohongshuTitle,
      });

      console.log(
        `[pipeline] Saved generated image to R2 key="${record.imageKey}" metadata="${record.metadataKey}"`
      );
      generated.push(record);
    } catch (error) {
      console.error(
        `[pipeline] Error processing key="${upload.key}":`,
        error instanceof Error ? error.message : error
      );
      failures.push({
        source: upload,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.log(
    `[pipeline] Completed generation for character="${request.character}". Success=${generated.length}, failures=${failures.length}`
  );
  return { generated, failures };
}

/**
 * KIE 异步生成管道（仅创建任务，不等待完成）
 * 返回任务 ID 列表，实际生成通过 /api/callback 完成
 */
export async function runKIEGenerationPipeline(request: GenerationRequest): Promise<{
  tasks: Array<{ taskId: string; source: UploadedReference; analysis: string }>;
  failures: GenerationFailure[];
}> {
  console.log(
    `[kie-pipeline] Starting KIE generation for character="${request.character}" with ${request.uploads.length} reference(s)`
  );
  const aiService = new AIService();
  const kieService = new KIEImageService();

  const tasks: Array<{ taskId: string; source: UploadedReference; analysis: string }> = [];
  const failures: GenerationFailure[] = [];

  for (let index = 0; index < request.uploads.length; index++) {
    const upload = request.uploads[index];
    console.log(
      `[kie-pipeline] [${index + 1}/${request.uploads.length}] Processing key="${upload.key}" filename="${upload.filename ?? 'N/A'}"`
    );
    try {
      const filename = upload.filename ?? path.basename(upload.key);
      const analysisResult = await aiService.analyzeImage(upload.url, filename);

      if (!analysisResult.success) {
        console.warn(
          `[kie-pipeline] Analysis failed for key="${upload.key}" reason="${analysisResult.error ?? 'unknown'}"`
        );
        throw new Error(analysisResult.error || 'Image analysis failed');
      }

      const clothingDetails = analysisResult.analysis;
      console.log(`[kie-pipeline] Analysis succeeded, summary length=${clothingDetails.length}`);
      const modelImageUrl = getRandomModelUrl(request.character as Character);
      console.log(`[kie-pipeline] Using model image URL="${modelImageUrl}"`);

      // 创建 KIE 任务（异步，不等待完成）
      const generationResult = await kieService.generateImageBase64(clothingDetails, modelImageUrl);

      if (!generationResult.success || !generationResult.taskId) {
        console.warn(
          `[kie-pipeline] Task creation failed for key="${upload.key}" reason="${generationResult.error ?? 'unknown'}"`
        );
        throw new Error(generationResult.error || 'KIE task creation failed');
      }

      console.log(`[kie-pipeline] KIE task created: ${generationResult.taskId}`);

      tasks.push({
        taskId: generationResult.taskId,
        source: upload,
        analysis: clothingDetails,
      });

    } catch (error) {
      console.error(
        `[kie-pipeline] Error processing key="${upload.key}":`,
        error instanceof Error ? error.message : error
      );
      failures.push({
        source: upload,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  console.log(
    `[kie-pipeline] Completed task creation for character="${request.character}". Tasks=${tasks.length}, failures=${failures.length}`
  );
  return { tasks, failures };
}

async function streamToString(stream: Readable | ReadableStream<Uint8Array> | Blob): Promise<string> {
  if (!stream) {
    return '';
  }

  if (typeof (stream as Blob).text === 'function') {
    return (stream as Blob).text();
  }

  if (typeof (stream as ReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done ?? false;
      if (result.value) {
        chunks.push(result.value);
      }
    }
    return Buffer.concat(chunks).toString('utf-8');
  }

  const nodeStream = stream as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

export interface GeneratedImageSummary {
  name: string;
  path: string;
  timestamp: number;
  xiaohongshuTitle?: string;
  metadataUrl?: string;
  analysis?: string;
  source?: UploadedReference;
  character?: string;
}

export async function listGeneratedImages(): Promise<GeneratedImageSummary[]> {
  const objects = await listObjects('generated/');
  const images: GeneratedImageSummary[] = [];

  for (const object of objects) {
    if (!object.Key) continue;
    const ext = path.extname(object.Key).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) continue;

    const metadataKey = object.Key.replace(ext, '.json');
    let xiaohongshuTitle: string | undefined;
    let analysis: string | undefined;
    let source: UploadedReference | undefined;
    let character: string | undefined;

    try {
      const metadataResponse = await r2Client.send(
        new GetObjectCommand({
          Bucket: getBucketName(),
          Key: metadataKey,
        })
      );

      if (metadataResponse.Body) {
        const text = await streamToString(metadataResponse.Body as Readable);
        const metadata = JSON.parse(text);
        xiaohongshuTitle = metadata.xiaohongshuTitle;
        analysis = metadata.analysis;
        source = metadata.source;
        character = metadata.character;
      }
    } catch (error) {
      console.warn(`Unable to read metadata for ${metadataKey}:`, (error as Error).message);
    }

      images.push({
        name: path.basename(object.Key),
        path: getPublicUrl(object.Key),
        timestamp: object.LastModified ? new Date(object.LastModified).getTime() : Date.now(),
        xiaohongshuTitle,
        metadataUrl: getPublicUrl(metadataKey),
        analysis,
        source,
        character,
      });
  }

  images.sort((a, b) => b.timestamp - a.timestamp);
  return images;
}
