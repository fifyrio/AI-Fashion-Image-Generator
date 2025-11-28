import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { originalImageUrl, pose, description, holdingPhone, wearingMask, useProModel } = await request.json();

    if (!originalImageUrl || !pose) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('[generate-model-pose-image] Starting KIE task creation:', {
      posePreview: pose.substring(0, 100),
      descriptionPreview: description?.substring(0, 100),
      holdingPhone: holdingPhone || false,
      wearingMask: wearingMask || false,
      useProModel: useProModel || false
    });

    // 使用 KIE 服务创建异步任务
    const kieService = new KIEImageService();
    const result = await kieService.generateModelPose(
      pose,
      description || '',
      originalImageUrl,
      holdingPhone || false,
      wearingMask || false,
      useProModel || false
    );

    if (!result.success || !result.taskId) {
      throw new Error(result.error || 'Failed to create KIE task');
    }

    console.log('[generate-model-pose-image] KIE task created successfully:', result.taskId);

    // 返回 taskId，前端可以轮询状态
    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      message: 'Task created successfully. Image generation in progress.'
    });
  } catch (error) {
    console.error('[generate-model-pose-image] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
