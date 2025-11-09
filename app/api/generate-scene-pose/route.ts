import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerator } from '@/lib/image-generator';
import { uploadBufferToR2, uploadJsonToR2, getPublicUrl } from '@/lib/r2';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { originalImageUrl, character, scene, pose } = await request.json();

    if (!originalImageUrl || !character || !scene || !pose) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('[generate-scene-pose] Starting generation:', {
      character,
      scenePreview: scene.substring(0, 100),
      posePreview: pose.substring(0, 100)
    });

    const imageGenerator = new ImageGenerator();
    const result = await imageGenerator.generateScenePose(
      originalImageUrl,
      scene,
      pose
    );

    if (!result.success || !result.result) {
      throw new Error(result.error || 'Generation failed');
    }

    console.log('[generate-scene-pose] Generation completed, uploading to R2...');

    // Upload generated image to R2
    const timestamp = Date.now();
    const filename = `scene-pose-${character}-${timestamp}.png`;
    const key = `generated/scene-pose/${filename}`;

    // Convert base64 data URI to buffer
    let buffer: Buffer;
    if (result.result.startsWith('data:image/')) {
      const base64Data = result.result.split(',')[1];
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      throw new Error('Invalid image format returned from API');
    }

    await uploadBufferToR2({
      key,
      body: buffer,
      contentType: 'image/png'
    });

    const imageUrl = getPublicUrl(key);

    console.log('[generate-scene-pose] Upload completed:', imageUrl);

    // Save metadata
    const metadataKey = `generated/scene-pose/${filename}.json`;
    const metadata = {
      character,
      scene,
      pose,
      originalImageUrl,
      generatedImageUrl: imageUrl,
      timestamp: new Date().toISOString()
    };

    await uploadJsonToR2(metadataKey, metadata);

    return NextResponse.json({
      success: true,
      imageUrl,
      metadata
    });
  } catch (error) {
    console.error('[generate-scene-pose] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
