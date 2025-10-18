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
    console.log('='.repeat(80));
    console.log('[api/callback] 📥 Received KIE callback');
    console.log('[api/callback] Timestamp:', new Date().toISOString());

    // 解析回调数据
    const callbackData: KIECallbackResponse = await request.json();

    console.log('[api/callback] 📦 Full callback payload:');
    console.log(JSON.stringify(callbackData, null, 2));
    console.log('[api/callback] Task ID:', callbackData.data.taskId);
    console.log('[api/callback] State:', callbackData.data.state);
    console.log('[api/callback] Model:', callbackData.data.model);
    console.log('[api/callback] Cost time:', callbackData.data.costTime, 'seconds');
    console.log('[api/callback] Consume credits:', callbackData.data.consumeCredits);

    // 处理回调
    console.log('[api/callback] 🔄 Processing callback...');
    const result = KIEImageService.processCallback(callbackData);

    if (!result.success) {
      console.error('[api/callback] ❌ Task failed:', result.error);

      // 更新任务状态为失败
      console.log('[api/callback] Updating task status to failed...');
      await updateKIETaskMetadata(result.taskId, {
        status: 'failed',
        error: result.error,
      });

      console.log('[api/callback] Failed task updated in R2');
      return NextResponse.json({
        success: false,
        message: 'Task failed',
        taskId: result.taskId,
        error: result.error,
      });
    }

    // 任务成功，获取任务元数据
    console.log('[api/callback] ✅ Task succeeded, fetching metadata from R2...');
    const taskMetadata = await getKIETaskMetadata(result.taskId);

    if (!taskMetadata) {
      console.warn('[api/callback] ⚠️  Task metadata not found:', result.taskId);
      return NextResponse.json({
        success: false,
        message: 'Task metadata not found',
        taskId: result.taskId,
      }, { status: 404 });
    }

    console.log('[api/callback] 📄 Task metadata found:');
    console.log('[api/callback]   - Prompt:', taskMetadata.prompt.substring(0, 100) + '...');
    console.log('[api/callback]   - Image URL:', taskMetadata.imageUrl);
    console.log('[api/callback]   - Created:', taskMetadata.createdAt);

    // 下载生成的图片并上传到 R2
    console.log('[api/callback] 🖼️  Processing result images...');
    console.log('[api/callback] Result URLs count:', result.resultUrls?.length || 0);
    const uploadedImages: string[] = [];

    if (result.resultUrls && result.resultUrls.length > 0) {
      for (let i = 0; i < result.resultUrls.length; i++) {
        const imageUrl = result.resultUrls[i];
        try {
          console.log(`[api/callback] [${i + 1}/${result.resultUrls.length}] Downloading: ${imageUrl}`);

          // 下载图片
          const imageResponse = await fetch(imageUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status} ${imageResponse.statusText}`);
          }

          const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
          console.log(`[api/callback] Downloaded ${imageBuffer.length} bytes`);

          // 上传到 R2
          const imageKey = `generated/kie-${result.taskId}-${randomUUID()}.png`;
          console.log(`[api/callback] Uploading to R2: ${imageKey}`);

          await uploadBufferToR2({
            key: imageKey,
            body: imageBuffer,
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000, immutable',
          });

          const publicUrl = getPublicUrl(imageKey);
          uploadedImages.push(publicUrl);

          console.log(`[api/callback] ✅ Uploaded successfully: ${publicUrl}`);
        } catch (error) {
          console.error(`[api/callback] ❌ Failed to process image ${imageUrl}:`, error);
          console.error('[api/callback] Error details:', error instanceof Error ? error.stack : error);
        }
      }
    }

    // 更新任务状态为完成
    console.log('[api/callback] 💾 Updating task status to completed...');
    const updated = await updateKIETaskMetadata(result.taskId, {
      status: 'completed',
      resultUrls: uploadedImages,
      consumeCredits: callbackData.data.consumeCredits,
      costTime: callbackData.data.costTime,
    });

    console.log('[api/callback] ✅ Task completed successfully:', result.taskId);
    console.log('[api/callback] 📊 Summary:');
    console.log(`[api/callback]   - Uploaded images: ${uploadedImages.length}`);
    console.log(`[api/callback]   - Cost time: ${callbackData.data.costTime}s`);
    console.log(`[api/callback]   - Credits consumed: ${callbackData.data.consumeCredits}`);
    console.log('[api/callback] 🎉 Callback processing complete!');
    console.log('='.repeat(80));

    return NextResponse.json({
      success: true,
      message: 'Callback processed successfully',
      taskId: result.taskId,
      resultUrls: uploadedImages,
      metadata: updated,
    });

  } catch (error) {
    console.error('='.repeat(80));
    console.error('[api/callback] ❌ ERROR processing callback');
    console.error('[api/callback] Error message:', error instanceof Error ? error.message : error);
    console.error('[api/callback] Error stack:', error instanceof Error ? error.stack : 'N/A');
    console.error('='.repeat(80));

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
