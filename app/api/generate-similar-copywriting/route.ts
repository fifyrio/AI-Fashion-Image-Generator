import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { originalCopy } = await request.json();

    if (!originalCopy) {
      return NextResponse.json(
        { error: 'Missing original copywriting' },
        { status: 400 }
      );
    }

    console.log('[generate-similar-copywriting] Analyzing copywriting...');

    // 调用 OpenRouter API 进行文案分析和生成
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    const prompt = `你是一位专业的小红书爆款文案分析师和创作专家。

请分析以下文案的爆款要素，然后生成 3 个风格相似的新文案。

原始文案：
${originalCopy}

请按照以下格式输出：

【爆款分析】
1. 标题结构分析：（分析标题的构成、亮点、吸引力）
2. 情绪价值分析：（分析文案传递的情绪和共鸣点）
3. 表达技巧分析：（分析使用的修辞手法、emoji、标点符号等）
4. 话题标签分析：（分析 hashtag 的选择策略）
5. 核心卖点分析：（提炼文案的核心价值主张）

【类似文案1】
（生成第一个类似风格的文案，包含主标题和至少5个相关hashtag）

【类似文案2】
（生成第二个类似风格的文案，包含主标题和至少5个相关hashtag）

【类似文案3】
（生成第三个类似风格的文案，包含主标题和至少5个相关hashtag）

要求：
- 新文案要保持原文案的风格、语气和情绪
- 每个新文案都要包含相关的hashtag（至少5个）
- hashtag要精准且有流量潜力
- 文案要有吸引力和传播力
- 保持小红书平台的特色`;

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
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      throw new Error(`OpenRouter API failed: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content in API response');
    }

    console.log('[generate-similar-copywriting] Raw response:', content);

    // 解析响应内容
    const analysisMatch = content.match(/【爆款分析】\s*([\s\S]*?)(?=【类似文案1】)/);
    const copy1Match = content.match(/【类似文案1】\s*([\s\S]*?)(?=【类似文案2】)/);
    const copy2Match = content.match(/【类似文案2】\s*([\s\S]*?)(?=【类似文案3】)/);
    const copy3Match = content.match(/【类似文案3】\s*([\s\S]*?)(?=$|【)/);

    const analysis = analysisMatch ? analysisMatch[1].trim() : '分析内容解析失败';
    const similarCopywriting = [
      copy1Match ? copy1Match[1].trim() : '',
      copy2Match ? copy2Match[1].trim() : '',
      copy3Match ? copy3Match[1].trim() : ''
    ].filter(Boolean);

    if (similarCopywriting.length === 0) {
      // 如果解析失败，尝试简单分割
      const parts = content.split(/【类似文案\d】/).filter(Boolean);
      if (parts.length >= 2) {
        similarCopywriting.push(...parts.slice(1, 4).map((p: string) => p.trim()));
      }
    }

    console.log('[generate-similar-copywriting] Generated copywriting:', {
      analysisLength: analysis.length,
      copywritingCount: similarCopywriting.length
    });

    return NextResponse.json({
      analysis,
      similarCopywriting: similarCopywriting.length > 0
        ? similarCopywriting
        : ['生成的文案1', '生成的文案2', '生成的文案3']
    });

  } catch (error) {
    console.error('[generate-similar-copywriting] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
