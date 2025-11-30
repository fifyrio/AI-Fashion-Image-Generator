import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt, style, gender, aspectRatio } = await request.json();

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: '缺少模特描述' },
        { status: 400 }
      );
    }

    if (!style) {
      return NextResponse.json(
        { error: '缺少模特风格' },
        { status: 400 }
      );
    }

    const trimmedPrompt = prompt.trim();
    console.log('[generate-model] Creating model task', {
      style,
      gender: gender || 'unknown',
      aspectRatio: aspectRatio || '9:16',
      promptPreview: trimmedPrompt.substring(0, 80)
    });

    const kieService = new KIEImageService();
    const result = await kieService.generateModelFromPrompt(trimmedPrompt, {
      style,
      aspectRatio: aspectRatio === '1:1' ? '1:1' : '9:16'
    });

    if (!result.success || !result.taskId) {
      throw new Error(result.error || '无法创建生成任务');
    }

    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      message: '任务创建成功，稍后可在任务列表中查看进度'
    });
  } catch (error) {
    console.error('[generate-model] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
