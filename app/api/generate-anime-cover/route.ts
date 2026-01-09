import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';
import { ANIME_COVER_PROMPT } from '@/lib/prompts';
import { saveKIETaskMetadata } from '@/lib/r2';
import type { KIETaskMetadata } from '@/lib/kie-image-service';

export const maxDuration = 180; // 3分钟，给 KIE API 更多的生成时间

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, title } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: '缺少参考图片URL' },
        { status: 400 }
      );
    }

    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: '缺少封面标题' },
        { status: 400 }
      );
    }

    console.log('[generate-anime-cover] Generating anime cover', {
      imageUrl,
      title: title.trim()
    });

    // 生成完整提示词
    const finalPrompt = ANIME_COVER_PROMPT(title.trim());

    console.log('[generate-anime-cover] Final prompt:', finalPrompt);

    // 使用 KIE 服务的 createProTask 方法生成图片（针对 nano-banana-pro）
    const kieService = new KIEImageService();
    const taskId = await kieService.createProTask(
      finalPrompt,
      imageUrl,
      '9:16',
      '2K'
    );

    console.log('[generate-anime-cover] Task created successfully:', taskId);

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
    console.log('[generate-anime-cover] Task metadata saved to R2');

    return NextResponse.json({
      success: true,
      taskId: taskId,
      message: '任务创建成功，稍后可在任务列表中查看进度'
    });
  } catch (error) {
    console.error('[generate-anime-cover] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
