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

    console.log('[analyze-mimic-reference] Analyzing image:', imageUrl);

    const aiService = new AIService();
    const result = await aiService.analyzeMimicReference(imageUrl);

    console.log('[analyze-mimic-reference] Analysis completed:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[analyze-mimic-reference] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
