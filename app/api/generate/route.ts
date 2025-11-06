import { NextRequest, NextResponse } from 'next/server';
import { runGenerationPipeline, VALID_CHARACTERS } from '@/lib/pipeline';
import { GenerationRequest, UploadedReference } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    console.warn('[api/generate] Invalid JSON payload');
    return NextResponse.json(
      { error: 'Invalid request payload' },
      { status: 400 }
    );
  }

  const { character, uploads, extractTopOnly } = body as {
    character?: string;
    uploads?: UploadedReference[];
    extractTopOnly?: boolean;
  };

  if (!character || !VALID_CHARACTERS.includes(character as (typeof VALID_CHARACTERS)[number])) {
    console.warn('[api/generate] Invalid character provided:', character);
    return NextResponse.json(
      { error: 'Invalid character. Supported values: lin, Qiao, qiao_mask' },
      { status: 400 }
    );
  }

  if (!Array.isArray(uploads) || uploads.length === 0) {
    console.warn('[api/generate] Missing uploads array');
    return NextResponse.json(
      { error: 'No uploaded references found. Upload images before generating.' },
      { status: 400 }
    );
  }

  const requestPayload: GenerationRequest = {
    character,
    uploads,
    extractTopOnly: extractTopOnly ?? false,
  };

  console.log(
    `[api/generate] Received request for character="${character}" with ${uploads.length} upload(s), extractTopOnly=${extractTopOnly ?? false}`
  );

  const { generated, failures } = await runGenerationPipeline(requestPayload);

  if (failures.length > 0) {
    console.warn(
      `[api/generate] Completed with failures: success=${generated.length}, failures=${failures.length}`
    );
  } else {
    console.log(
      `[api/generate] Completed successfully with ${generated.length} generated image(s)`
    );
  }

  return NextResponse.json({
    success: failures.length === 0,
    character,
    generated,
    errors: failures.length > 0 ? failures : undefined,
    total: uploads.length,
    completed: generated.length,
  });
}
