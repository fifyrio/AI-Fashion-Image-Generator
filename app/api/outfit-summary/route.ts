import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai-service';

export const maxDuration = 120; // 2 minutes for multiple image analysis

export async function POST(request: NextRequest) {
  try {
    const { imageUrls } = await request.json();

    // Validation
    if (!imageUrls || !Array.isArray(imageUrls)) {
      return NextResponse.json(
        { error: '缺少图片URL列表' },
        { status: 400 }
      );
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: '至少需要上传1张图片' },
        { status: 400 }
      );
    }

    if (imageUrls.length > 10) {
      return NextResponse.json(
        { error: '最多支持分析10张图片' },
        { status: 400 }
      );
    }

    console.log(`[outfit-summary] Analyzing ${imageUrls.length} outfit images`);

    const aiService = new AIService();
    const result = await aiService.analyzeOutfitSummary(imageUrls);

    console.log('[outfit-summary] Analysis completed successfully');

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('[outfit-summary] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '爆款总结生成失败'
      },
      { status: 500 }
    );
  }
}
