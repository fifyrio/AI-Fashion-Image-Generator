import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { originalCopy, targetAudience = 'female' } = await request.json();

    if (!originalCopy) {
      return NextResponse.json(
        { error: 'Missing original copywriting' },
        { status: 400 }
      );
    }

    console.log('[generate-similar-copywriting] Analyzing copywriting...', {
      targetAudience
    });

    // 调用 OpenRouter API 进行文案分析和生成
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not configured');
    }

    // 根据目标群体调整提示词
    const audienceDescription = targetAudience === 'male'
      ? '男性用户（关注实用性、性能、科技感、理性决策）'
      : '女性用户（关注独立自我、勇敢做自己、态度表达、自信力量）';

    const audienceGuidelines = targetAudience === 'male'
      ? `- 语气要直接、简洁、有力，像朋友之间的真诚推荐
- 强调产品性能、实用价值、技术优势
- 使用理性分析和数据支撑，但要接地气
- hashtag偏向功能性、技术性、实用性
- 减少过度修饰，增加客观描述
- 可以使用幽默但不要过于花哨
- **重要**：要像真实的网红博主在分享真实体验，不要太商业化`
      : `- 语气要自信、独立、有态度，像一个活出自我的女生在分享
- **核心主题：突出女生勇敢做自己、独立自主的气质**
- 强调自我价值、独立精神、勇敢追求自己想要的生活
- 表达"不为取悦他人，只为自己而活"的态度
- 文案要传递力量感和自信，而非只是甜美可爱
- 使用有力量、有态度的表达，展现现代独立女性的风采
- hashtag偏向独立、自我、态度、女性力量
- 可以使用丰富的emoji，但要有态度感
- **重要**：要像一个独立自信的女生在分享自己的生活态度，不是在撒娇卖萌
- 关键词参考：做自己、独立、自信、勇敢、态度、不讨好、悦己、自我成长`;

    const prompt = `你是一位专业的小红书爆款文案分析师和创作专家。

⚠️ 核心原则 - 网红真诚风格：
- 文案必须像真实的网红博主在分享，不是广告文案
- 语气要真诚、自然、接地气，像朋友间的推荐
- 可以有个人化的表达（比如"我""姐妹们""宝子们""兄弟们"）
- 可以分享真实的使用感受和小缺点（增加可信度）
- 避免过度夸张和营销味道
- 多用口语化表达，少用书面语
- 适当使用网络流行语和梗

目标群体：${audienceDescription}

请分析以下文案的爆款要素，然后生成 3 个针对目标群体的类似风格新文案。

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
- 保持小红书平台的特色

**网红真诚风格要求（必须严格遵守）**：
✅ 正确示例（女性独立态度）：
  - "我就是喜欢，不需要理由"（自信、有态度）
  - "取悦自己，才是最重要的事"（独立、悦己）
  - "不为任何人改变自己，做最真实的我"（勇敢、真实）
  - "人生是自己的，凭什么要活在别人的眼光里"（独立宣言）
  - "这一刻，只属于我自己"（自我、力量）

✅ 正确示例（男性真诚推荐）：
  - "兄弟们听我一句劝，这个真的能解决..."（直接、真诚推荐）
  - "说实话，刚开始我也不信，但是..."（真诚、有转折）

❌ 错误示例：
  - "本产品采用先进技术..."（太正式、像广告）
  - "完美无缺的选择"（过度夸张、不真实）
  - "您值得拥有"（书面语、太客气）
  - "小仙女们快来看"（太甜腻、缺乏力量感）

- **重要**：生成的文案必须符合目标群体特征：
${audienceGuidelines}

记住：要像一个真实的、值得信赖的网红博主在分享自己的真实体验和感受，而不是在推销产品！`;

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
