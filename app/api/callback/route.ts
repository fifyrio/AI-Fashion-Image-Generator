import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService, type KIECallbackResponse } from '@/lib/kie-image-service';
import { getKIETaskMetadata, updateKIETaskMetadata, uploadBufferToR2, getPublicUrl } from '@/lib/r2';
import { randomUUID } from 'crypto';

/**
 * POST /api/callback
 * 接收 KIE API 的回调通知
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[api/callback] Received KIE callback');

    // 解析回调数据
    const callbackData: KIECallbackResponse = await request.json();

    console.log(`[api/callback] Task ID: ${callbackData.data.taskId}`);
    console.log(`[api/callback] State: ${callbackData.data.state}`);

    // 处理回调
    const result = KIEImageService.processCallback(callbackData);

    if (!result.success) {
      console.error(`[api/callback] Task failed: ${result.error}`);

      // 更新任务状态为失败
      await updateKIETaskMetadata(result.taskId, {
        status: 'failed',
        error: result.error,
      });

      return NextResponse.json({
        success: false,
        message: 'Task failed',
        taskId: result.taskId,
        error: result.error,
      });
    }

    // 任务成功，获取任务元数据
    const taskMetadata = await getKIETaskMetadata(result.taskId);

    if (!taskMetadata) {
      console.warn(`[api/callback] Task metadata not found: ${result.taskId}`);
      return NextResponse.json({
        success: false,
        message: 'Task metadata not found',
        taskId: result.taskId,
      }, { status: 404 });
    }

    console.log(`[api/callback] Found task metadata for: ${result.taskId}`);

    // 下载生成的图片并上传到 R2
    const uploadedImages: string[] = [];

    if (result.resultUrls && result.resultUrls.length > 0) {
      for (const imageUrl of result.resultUrls) {
        try {
          console.log(`[api/callback] Downloading image: ${imageUrl}`);

          // 下载图片
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.statusText}`);
          }

          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

          // 上传到 R2
          const imageKey = `generated/kie-${result.taskId}-${randomUUID()}.png`;
          await uploadBufferToR2({
            key: imageKey,
            body: imageBuffer,
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000, immutable',
          });

          const publicUrl = getPublicUrl(imageKey);
          uploadedImages.push(publicUrl);

          console.log(`[api/callback] Uploaded to R2: ${imageKey}`);
        } catch (error) {
          console.error(`[api/callback] Failed to process image ${imageUrl}:`, error);
        }
      }
    }

    // 更新任务状态为完成
    const updated = await updateKIETaskMetadata(result.taskId, {
      status: 'completed',
      resultUrls: uploadedImages,
      consumeCredits: callbackData.data.consumeCredits,
      costTime: callbackData.data.costTime,
    });

    console.log(`[api/callback] Task completed successfully: ${result.taskId}`);
    console.log(`[api/callback] Uploaded ${uploadedImages.length} image(s) to R2`);

    return NextResponse.json({
      success: true,
      message: 'Callback processed successfully',
      taskId: result.taskId,
      resultUrls: uploadedImages,
      metadata: updated,
    });

  } catch (error) {
    console.error('[api/callback] Error processing callback:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
