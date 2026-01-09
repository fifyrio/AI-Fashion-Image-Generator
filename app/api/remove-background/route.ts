import { NextRequest, NextResponse } from 'next/server';
import { ReplicateService } from '@/lib/replicate-service';

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

  console.log(`[api/remove-background] Processing: ${imageUrl}`);

  try {
    const replicateService = new ReplicateService();
    const resultUrl = await replicateService.removeBackground(imageUrl);

    console.log(`[api/remove-background] Success: ${resultUrl}`);

    return NextResponse.json({
      success: true,
      resultUrl,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[api/remove-background] Error: ${errorMessage}`);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
