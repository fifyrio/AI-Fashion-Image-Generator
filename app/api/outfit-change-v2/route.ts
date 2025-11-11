import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';
import { getRandomModelUrl, Character } from '@/lib/pipeline';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    console.warn('[api/outfit-change-v2] Invalid JSON payload');
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }

  const { clothingImageUrl, character } = body as {
    clothingImageUrl?: string;
    character?: Character;
  };

  if (!clothingImageUrl || typeof clothingImageUrl !== 'string') {
    console.warn('[api/outfit-change-v2] Missing or invalid clothingImageUrl');
    return NextResponse.json(
      { error: 'Missing or invalid clothingImageUrl parameter' },
      { status: 400 }
    );
  }

  if (!character || typeof character !== 'string') {
    console.warn('[api/outfit-change-v2] Missing or invalid character');
    return NextResponse.json(
      { error: 'Missing or invalid character parameter' },
      { status: 400 }
    );
  }

  console.log(`[api/outfit-change-v2] Received request`);
  console.log(`  Clothing URL: ${clothingImageUrl}`);
  console.log(`  Character: ${character}`);

  try {
    // 获取模特图片URL
    const modelImageUrl = getRandomModelUrl(character);
    console.log(`  Model URL: ${modelImageUrl}`);

    const kieService = new KIEImageService();
    const result = await kieService.outfitChangeV2(
      clothingImageUrl,
      modelImageUrl,
      character
    );

    if (!result.success) {
      console.error(`[api/outfit-change-v2] Task creation failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error || 'Failed to create outfit change V2 task' },
        { status: 500 }
      );
    }

    console.log(`[api/outfit-change-v2] Task created successfully: ${result.taskId}`);

    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      modelImageUrl: modelImageUrl,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[api/outfit-change-v2] Error: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
