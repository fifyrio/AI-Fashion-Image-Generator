import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { uploadBufferToR2, getPublicUrl } from '@/lib/r2';
import { createILoveIMGService } from '@/lib/ilovepdf-service';

export const maxDuration = 300; // 5分钟，支持批量处理

interface EnhanceImageRequest {
  imageUrl: string;
}

interface RequestBody {
  images: EnhanceImageRequest[];
  multiplier?: 2 | 4;
}

interface EnhanceImageResult {
  success: boolean;
  originalUrl: string;
  enhancedUrl?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { images, multiplier = 2 } = body;

    // Validate request
    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: '缺少图片列表' }, { status: 400 });
    }

    if (multiplier !== 2 && multiplier !== 4) {
      return NextResponse.json({ error: '倍数必须是 2 或 4' }, { status: 400 });
    }

    // Check environment variables
    if (!process.env.ILOVE_PUBLIC_KEY || !process.env.ILOVE_SECRET_KEY) {
      return NextResponse.json(
        { error: '缺少必需的环境变量：ILOVE_PUBLIC_KEY 或 ILOVE_SECRET_KEY' },
        { status: 500 }
      );
    }

    console.log(`[enhance-ilovepdf] Processing ${images.length} images with ${multiplier}x multiplier`);

    // Create service instance
    const ilovepdfService = createILoveIMGService();

    // Process all images in parallel
    const results: EnhanceImageResult[] = await Promise.all(
      images.map(async (imageRequest: EnhanceImageRequest) => {
        try {
          const { imageUrl } = imageRequest;

          if (!imageUrl) {
            return {
              success: false,
              originalUrl: '',
              error: '缺少图片地址'
            };
          }

          console.log(`[enhance-ilovepdf] Processing ${imageUrl} with ${multiplier}x`);

          // Extract filename from URL or generate one
          const urlPath = new URL(imageUrl).pathname;
          const originalFilename = urlPath.split('/').pop() || 'image.jpg';
          const filename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_');

          // Upscale image using iLoveIMG service (directly from URL)
          const result = await ilovepdfService.upscaleImage(
            imageUrl,
            filename,
            { multiplier }
          );

          if (!result.success || !result.enhancedBuffer) {
            throw new Error(result.error || '增强失败');
          }

          // Upload to R2
          const enhancedUrl = await uploadEnhancedImage(result.enhancedBuffer);

          console.log(`[enhance-ilovepdf] Success: ${imageUrl} -> ${enhancedUrl}`);

          return {
            success: true,
            originalUrl: imageUrl,
            enhancedUrl
          };
        } catch (error) {
          console.error(`[enhance-ilovepdf] Error enhancing ${imageRequest.imageUrl}:`, error);
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

    console.log(`[enhance-ilovepdf] Completed: ${successCount} success, ${failureCount} failed`);

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
    console.error('[enhance-ilovepdf] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '批量增强失败' },
      { status: 500 }
    );
  }
}

/**
 * Upload enhanced image to R2 and return public URL
 */
async function uploadEnhancedImage(buffer: Buffer): Promise<string> {
  const key = `enhancements/ilovepdf-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.jpg`;

  await uploadBufferToR2({
    key,
    body: buffer,
    contentType: 'image/jpeg',
    cacheControl: 'public, max-age=31536000, immutable'
  });

  return getPublicUrl(key);
}
