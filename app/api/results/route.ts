import { NextResponse } from 'next/server';
import { listGeneratedImages } from '@/lib/pipeline';

export async function GET() {
  try {
    const images = await listGeneratedImages();

    return NextResponse.json({
      success: true,
      count: images.length,
      images,
    });
  } catch (error) {
    console.error('Error reading generated images from R2:', error);
    return NextResponse.json(
      { error: 'Failed to read generated images' },
      { status: 500 }
    );
  }
}
