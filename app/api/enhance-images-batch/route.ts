import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { randomUUID } from 'crypto';
import { uploadBufferToR2, getPublicUrl } from '@/lib/r2';

export const maxDuration = 300; // 5分钟，支持批量处理

interface EnhanceImageRequest {
  imageUrl: string;
  enhanceModel?: 'Low Resolution V2' | 'Standard V1';
  outputFormat?: 'jpg' | 'png' | 'webp';
  upscaleFactor?: '2x' | '4x' | '6x';
  faceEnhancement?: boolean;
  subjectDetection?: 'Foreground' | 'Background';
  faceEnhancementStrength?: number;
  faceEnhancementCreativity?: number;
}

interface EnhanceImageResult {
  success: boolean;
  originalUrl: string;
  enhancedUrl?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { images, ...defaultOptions } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: '缺少图片列表' }, { status: 400 });
    }

    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return NextResponse.json({ error: 'REPLICATE_API_TOKEN 未配置' }, { status: 500 });
    }

    const replicate = new Replicate({
      auth: token
    });

    console.log(`[enhance-images-batch] Processing ${images.length} images`);

    // 并行处理所有图片
    const results: EnhanceImageResult[] = await Promise.all(
      images.map(async (imageRequest: EnhanceImageRequest) => {
        try {
          const {
            imageUrl,
            enhanceModel = defaultOptions.enhanceModel || 'Low Resolution V2',
            outputFormat = defaultOptions.outputFormat || 'jpg',
            upscaleFactor = defaultOptions.upscaleFactor || '2x',
            faceEnhancement = defaultOptions.faceEnhancement ?? true,
            subjectDetection = defaultOptions.subjectDetection || 'Foreground',
            faceEnhancementStrength = defaultOptions.faceEnhancementStrength ?? 0.8,
            faceEnhancementCreativity = defaultOptions.faceEnhancementCreativity ?? 0.5
          } = imageRequest;

          if (!imageUrl) {
            return {
              success: false,
              originalUrl: '',
              error: '缺少图片地址'
            };
          }

          const replicateInput = {
            image: imageUrl,
            enhance_model: enhanceModel,
            output_format: outputFormat,
            upscale_factor: upscaleFactor,
            face_enhancement: faceEnhancement,
            subject_detection: subjectDetection,
            face_enhancement_strength: faceEnhancementStrength,
            face_enhancement_creativity: faceEnhancementCreativity
          };

          console.log(`[enhance-images-batch] Enhancing ${imageUrl}`, replicateInput);

          const output = await replicate.run('topazlabs/image-upscale', {
            input: replicateInput
          });

          const persistedUrl = await persistEnhancementResult(output);
          if (!persistedUrl) {
            throw new Error('未能获取增强后的图片地址');
          }

          console.log(`[enhance-images-batch] Success: ${imageUrl} -> ${persistedUrl}`);

          return {
            success: true,
            originalUrl: imageUrl,
            enhancedUrl: persistedUrl
          };
        } catch (error) {
          console.error(`[enhance-images-batch] Error enhancing ${imageRequest.imageUrl}:`, error);
          return {
            success: false,
            originalUrl: imageRequest.imageUrl || '',
            error: error instanceof Error ? error.message : '增强失败'
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`[enhance-images-batch] Completed: ${successCount} success, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: images.length,
        success: successCount,
        failed: failureCount
      }
    });
  } catch (error) {
    console.error('[enhance-images-batch] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量增强失败' },
      { status: 500 }
    );
  }
}

async function persistEnhancementResult(output: unknown): Promise<string | null> {
  const directUrl = extractUrlFromOutput(output);
  if (directUrl) {
    try {
      const downloadResponse = await fetch(directUrl);
      if (!downloadResponse.ok || !downloadResponse.body) {
        return directUrl;
      }
      const arrayBuffer = await downloadResponse.arrayBuffer();
      return await uploadBuffer(arrayBuffer, downloadResponse.headers.get('content-type') || 'image/jpeg');
    } catch (error) {
      console.warn('[enhance-images-batch] Failed to download replicate result, fallback to direct URL:', error);
      return directUrl;
    }
  }

  const bufferResult = await extractBufferFromOutput(output);
  if (bufferResult) {
    return uploadBuffer(bufferResult.buffer, bufferResult.contentType);
  }

  return null;
}

async function uploadBuffer(arrayBuffer: ArrayBuffer | Buffer, contentType: string): Promise<string> {
  const buffer = Buffer.isBuffer(arrayBuffer) ? arrayBuffer : Buffer.from(arrayBuffer);
  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const key = `enhancements/${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.${extension}`;

  await uploadBufferToR2({
    key,
    body: buffer,
    contentType,
    cacheControl: 'public, max-age=31536000, immutable'
  });

  return getPublicUrl(key);
}

async function extractBufferFromOutput(output: unknown): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!output) {
    return null;
  }

  if (typeof Blob !== 'undefined' && output instanceof Blob) {
    const arrayBuffer = await output.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), contentType: output.type || 'image/jpeg' };
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const nested = await extractBufferFromOutput(item);
      if (nested) {
        return nested;
      }
    }
  }

  if (typeof output === 'object') {
    if (output instanceof Uint8Array) {
      return { buffer: Buffer.from(output), contentType: 'image/jpeg' };
    }
    if (output && 'output' in output) {
      return extractBufferFromOutput((output as { output: unknown }).output);
    }
    if (output && 'arrayBuffer' in output && typeof (output as { arrayBuffer?: () => Promise<ArrayBuffer> }).arrayBuffer === 'function') {
      const arrayBuffer = await (output as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
      return { buffer: Buffer.from(arrayBuffer), contentType: 'image/jpeg' };
    }
  }

  return null;
}

function extractUrlFromOutput(output: unknown): string | null {
  if (!output) {
    return null;
  }

  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output)) {
    for (const item of output) {
      const url = extractUrlFromOutput(item);
      if (url) {
        return url;
      }
    }
    return null;
  }

  if (typeof output === 'object') {
    if (output && 'url' in output) {
      const value = (output as { url?: (() => string) | string }).url;
      if (typeof value === 'function') {
        try {
          const url = value();
          if (typeof url === 'string') {
            return url;
          }
        } catch (error) {
          console.warn('[enhance-images-batch] Failed to read url() from output:', error);
        }
      }
      if (typeof value === 'string') {
        return value;
      }
    }

    if (output && 'output' in output) {
      return extractUrlFromOutput((output as { output: unknown }).output);
    }
  }

  return null;
}
