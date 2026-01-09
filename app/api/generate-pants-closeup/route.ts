import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';
import { PANTS_CLOSEUP_SITTING_PROMPT, PANTS_CLOSEUP_OVERHEAD_PROMPT } from '@/lib/prompts';
import { saveKIETaskMetadata } from '@/lib/r2';
import type { KIETaskMetadata } from '@/lib/kie-image-service';

export const maxDuration = 180; // 3分钟，给 KIE API 更多的生成时间

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, angle = 'sitting' } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: '缺少参考图片URL' },
        { status: 400 }
      );
    }

    console.log('[generate-pants-closeup] Generating pants closeup', {
      imageUrl,
      angle
    });

    // 根据角度选择提示词
    const finalPrompt = angle === 'overhead'
      ? PANTS_CLOSEUP_OVERHEAD_PROMPT
      : PANTS_CLOSEUP_SITTING_PROMPT;

    console.log('[generate-pants-closeup] Selected angle:', angle);
    console.log('[generate-pants-closeup] Final prompt:', finalPrompt);

    // 使用 KIE 服务生成图片（使用上传的裤子图片作为参考）
    const kieService = new KIEImageService();
    const taskId = await kieService.createTask(
      finalPrompt,
      imageUrl,
      '9:16',
      'google/nano-banana-edit'
    );

    console.log('[generate-pants-closeup] Task created successfully:', taskId);

    // 保存任务元数据到 R2
    const metadata: KIETaskMetadata = {
      taskId,
      status: 'pending',
      prompt: finalPrompt,
      imageUrl: imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveKIETaskMetadata(metadata);
    console.log('[generate-pants-closeup] Task metadata saved to R2');

    return NextResponse.json({
      success: true,
      taskId: taskId,
      message: '任务创建成功，稍后可在任务列表中查看进度'
    });
  } catch (error) {
    console.error('[generate-pants-closeup] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
