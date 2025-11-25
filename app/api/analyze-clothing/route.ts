import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/lib/ai-service';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, extractTopOnly } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing imageUrl parameter' },
        { status: 400 }
      );
    }

    console.log('[analyze-clothing] Analyzing clothing from image:', imageUrl);
    console.log('[analyze-clothing] Extract top only:', extractTopOnly || false);

    // 调用 OpenRouter API 获取简短描述
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const prompt = `请用30字以内简洁描述这张图片中的服装特征，格式为关键词组合，例如：
- "黑色短袖T恤 圆领 宽松版型 纯色"
- "蓝色牛仔裤 高腰 直筒版型"
- "白色衬衫 长袖 修身剪裁 商务风"

要求：
- 必须在30字以内
- 只描述服装本身，不描述人物
- 关键词包括：颜色、类型、版型、风格、特殊设计等
- 用空格分隔关键词
- 不要用完整句子，只用词组`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.SITE_NAME || 'AI Fashion Generator'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 100,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    const data = await response.json();
    const analysis = data.choices[0]?.message?.content?.trim() || '服装描述生成失败';

    console.log('[analyze-clothing] Analysis completed:', analysis);

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('[analyze-clothing] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
