import { NextRequest, NextResponse } from 'next/server';
import { GPT_ANALYZE_PANTS_PROMPT } from '@/lib/prompts';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Missing imageUrl parameter' },
        { status: 400 }
      );
    }

    console.log('[analyze-pants] Analyzing pants from image:', imageUrl);

    // 调用 OpenRouter API 分析裤子
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

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
                text: GPT_ANALYZE_PANTS_PROMPT
              },
              {
                type: 'image_url',
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 1500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('[analyze-pants] OpenRouter response:', JSON.stringify(data, null, 2));

    if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
      console.error('[analyze-pants] Invalid response structure:', data);
      throw new Error('OpenRouter API returned invalid response structure');
    }

    const content = data.choices[0]?.message?.content?.trim() || '裤子分析失败';

    console.log('[analyze-pants] Analysis completed');
    console.log('[analyze-pants] Raw response:', content);

    // 尝试从响应中提取JSON
    let parsedData;
    try {
      // 尝试找到JSON代码块
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[1]);
      } else {
        // 尝试直接解析整个内容
        parsedData = JSON.parse(content);
      }
    } catch (e) {
      console.warn('[analyze-pants] Failed to parse JSON, using fallback extraction');
      // 如果JSON解析失败，返回原始内容
      return NextResponse.json({
        success: true,
        pantsType: '牛仔裤',
        color: '蓝色',
        colorDetail: '请手动查看分析内容',
        material: '牛仔布',
        waistHeight: 'high',
        fitType: 'slim',
        style: '休闲',
        fullAnalysis: content,
        pantsDescription: 'slim-fit blue denim jeans',
        waistFitDescription: 'high-waisted fit visible at the waist'
      });
    }

    // 中文转英文映射
    const colorMap: Record<string, string> = {
      '深蓝色': 'dark blue',
      '浅蓝色': 'light blue',
      '黑色': 'black',
      '白色': 'white',
      '灰色': 'gray',
      '深灰色': 'dark gray',
      '浅灰色': 'light gray',
      '卡其色': 'khaki',
      '米色': 'beige',
      '棕色': 'brown',
      '军绿色': 'olive green',
      '藏青色': 'navy blue'
    };

    const typeMap: Record<string, string> = {
      '牛仔裤': 'denim jeans',
      '西装裤': 'dress trousers',
      '休闲裤': 'casual pants',
      '运动裤': 'sweatpants',
      '打底裤': 'leggings',
      '阔腿裤': 'wide-leg pants',
      '直筒裤': 'straight pants'
    };

    const fitMap: Record<string, string> = {
      'slim': 'slim-fit',
      'skinny': 'skinny-fit',
      'straight': 'straight-fit',
      'loose': 'relaxed-fit',
      'wide': 'wide-leg'
    };

    const waistMap: Record<string, string> = {
      'high': 'high-waisted fit visible at the waist',
      'mid': 'mid-rise fit sitting naturally at the waist',
      'low': 'relaxed fit with gentle structure around the legs'
    };

    // 构建英文描述
    const colorEn = colorMap[parsedData.color] || parsedData.color;
    const typeEn = typeMap[parsedData.pantsType] || 'pants';
    const fitEn = fitMap[parsedData.fitType] || parsedData.fitType;

    const pantsDescription = `${fitEn} ${colorEn} ${typeEn}`;
    const waistFitDescription = waistMap[parsedData.waistHeight] || waistMap['high'];

    console.log('[analyze-pants] Parsed data:', parsedData);
    console.log('[analyze-pants] Generated English description:', pantsDescription);
    console.log('[analyze-pants] Generated waist fit:', waistFitDescription);

    return NextResponse.json({
      success: true,
      ...parsedData,
      pantsDescription,
      waistFitDescription
    });
  } catch (error) {
    console.error('[analyze-pants] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
