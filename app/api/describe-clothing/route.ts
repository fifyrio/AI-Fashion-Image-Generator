import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
  }

  const { imageUrl } = body as { imageUrl?: string };

  if (!imageUrl || typeof imageUrl !== 'string') {
    return NextResponse.json({ error: 'Missing or invalid imageUrl parameter' }, { status: 400 });
  }

  console.log(`[api/describe-clothing] Analyzing: ${imageUrl}`);

  try {
    const aiService = new AIService();
    const description = await aiService.describeClothing(imageUrl);

    console.log(`[api/describe-clothing] Success`);

    return NextResponse.json({
      success: true,
      description,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[api/describe-clothing] Error: ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
