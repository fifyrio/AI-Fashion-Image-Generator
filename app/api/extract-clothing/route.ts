import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    console.warn('[api/extract-clothing] Invalid JSON payload');
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }

  const { imageUrl, recommendMatch, extractTopOnly } = body as {
    imageUrl?: string;
    recommendMatch?: boolean;
    extractTopOnly?: boolean;
  };

  if (!imageUrl || typeof imageUrl !== 'string') {
    console.warn('[api/extract-clothing] Missing or invalid imageUrl');
    return NextResponse.json(
      { error: 'Missing or invalid imageUrl parameter' },
      { status: 400 }
    );
  }

  console.log(`[api/extract-clothing] Received request for imageUrl: ${imageUrl}, recommendMatch: ${recommendMatch}, extractTopOnly: ${extractTopOnly}`);

  try {
    const kieService = new KIEImageService();
    const result = await kieService.extractClothing(imageUrl, recommendMatch, extractTopOnly);

    if (!result.success) {
      console.error(`[api/extract-clothing] Task creation failed: ${result.error}`);
      return NextResponse.json(
        { error: result.error || 'Failed to create clothing extraction task' },
        { status: 500 }
      );
    }

    console.log(`[api/extract-clothing] Task created successfully: ${result.taskId}`);

    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      imageUrl: result.imageUrl,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[api/extract-clothing] Error: ${errorMessage}`);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
