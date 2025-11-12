import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { prompt, character } = await request.json();

    if (!prompt || !character) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('[generate-mimic-reference] Starting KIE task creation:', {
      promptPreview: prompt.substring(0, 100),
      character
    });

    // Get the character's model image URL
    const characterImageUrl = getCharacterImageUrl(character);

    // Build the prompt to maintain character consistency while changing pose and scene
    const fullPrompt = `将上传的图片换成下面的效果，保持人物的一致性，图片的人物有合适的影子，姿势和背景换成下面的：

${prompt}

请确保：
1. 保持人物外貌特征的一致性
2. 人物有自然的影子效果
3. 姿势和背景严格按照上述描述生成`;

    // Use KIE service to create async task
    const kieService = new KIEImageService();
    const result = await kieService.generateModelPose(
      fullPrompt,
      '',
      characterImageUrl,
      false
    );

    if (!result.success || !result.taskId) {
      throw new Error(result.error || 'Failed to create KIE task');
    }

    console.log('[generate-mimic-reference] KIE task created successfully:', result.taskId);

    // Return taskId for frontend polling
    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      message: 'Task created successfully. Image generation in progress.'
    });
  } catch (error) {
    console.error('[generate-mimic-reference] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

// Helper function to get character image URL
function getCharacterImageUrl(character: string): string {
  const baseUrl = 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev';
  return `${baseUrl}/${character}/frame_1.jpg`;
}
