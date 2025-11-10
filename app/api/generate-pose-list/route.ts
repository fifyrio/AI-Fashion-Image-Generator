import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    console.log('[generate-pose-list] Analyzing image:', imageUrl);

    const aiService = new AIService();
    const result = await aiService.generateModelPoseList(imageUrl);

    console.log('[generate-pose-list] Analysis completed:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[generate-pose-list] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
