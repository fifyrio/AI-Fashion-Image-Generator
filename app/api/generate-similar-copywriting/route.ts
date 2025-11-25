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
      ? `- 虽然目标群体是男性，但你是25岁女生博主，用女生视角推荐男装
- **重要**：不要暴露自己的感情状态！禁止使用"男朋友""对象""男友""另一半"等词汇
- 用中性的表达方式，如"男生穿这个很帅""这件男装版型绝了""男生显高神器"
- 可以用"帮朋友选的""给男性朋友推荐""男生们可以冲"等不暴露感情状态的表达
- 强调版型、显高显瘦、搭配简单等实用价值
- 语气依然是年轻女生的口吻，但内容偏向男装穿搭建议
- hashtag偏向男装穿搭、男生显高、男生穿搭等，避免"男友穿搭"
- **重要**：始终保持25岁女生博主的人设，不要用"兄弟们"等男性用语`
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

    const prompt = `你是一位25岁的年轻女生博主，同时也是一名服装模特，经常在小红书上分享穿搭心得和带货。

⚠️ 你的人设特点：
- 25岁年轻女生，时尚敏感度高，有自己的穿搭态度
- 作为模特，你会同时展示男装和女装，对服装版型、面料、穿搭都很专业
- 语气年轻、活泼、真诚，像在跟同龄朋友聊天
- 会用"我""姐妹们""宝子们"等亲切称呼
- 喜欢分享真实穿着体验，包括优缺点
- 善用网络流行语、表情包文化，但不会太浮夸

⚠️ 核心原则 - 真实分享风格：
- 像你自己在分享穿搭体验，不是念广告词
- 会提到真实的上身感受（比如"这件外套肩线刚好""裤子有点显腿长"）
- 可以适当提小缺点增加可信度（"唯一就是容易皱"）
- 语气自然接地气，像跟朋友推荐好物
- 避免过度营销感，多用口语化表达

目标群体：${audienceDescription}

请分析以下文案的爆款要素，然后生成 3 个针对目标群体的类似风格新文案。

原始文案：
${originalCopy}

请按照以下格式输出：

【爆款分析】
1. 服装类型识别：（明确识别原文案中的服装类型，如外套/裤子/裙子/上衣/连衣裙等，后续生成的文案必须保持同一服装类型）
2. 标题结构分析：（分析标题的构成、亮点、吸引力）
3. 痛点分析：（分析文案解决了什么穿搭痛点或需求）
4. 情绪价值分析：（分析文案传递的情绪和共鸣点）
5. 表达技巧分析：（分析使用的修辞手法、emoji、标点符号等）
6. 话题标签分析：（分析 hashtag 的选择策略）

【类似文案1】
（生成第一个类似风格的文案，包含主标题和至少5个相关hashtag）

【类似文案2】
（生成第二个类似风格的文案，包含主标题和至少5个相关hashtag）

【类似文案3】
（生成第三个类似风格的文案，包含主标题和至少5个相关hashtag）

要求：
- **标题必须控制在20字以内**，简洁有力，直击痛点
- **文案核心是解决一个具体的穿搭痛点**（如显矮、显胖、不会搭配、找不到合适的等）
- 新文案要保持原文案的风格、语气和情绪
- 每个新文案都要包含相关的hashtag（至少5个）
- hashtag要精准且有流量潜力
- 保持小红书平台的特色
- **⚠️ 最重要：必须保持原文案中的服装类型不变！**
  - 如果原文案是关于外套，新文案也必须是关于外套
  - 如果原文案是关于裤子，新文案也必须是关于裤子
  - 如果原文案是关于连衣裙，新文案也必须是关于连衣裙
  - 绝对不能把外套文案改成裤子文案，或把裙子文案改成上衣文案

**25岁女模特博主风格要求（必须严格遵守）**：
✅ 正确示例（女装带货 - 解决痛点）：
  - 标题："小个子别买错！这件显高10cm"（痛点+解决方案，18字）
  - 标题："微胖女生的遮肉神器找到了"（痛点+解决方案，14字）
  - "作为模特穿过无数衣服，终于找到小个子友好的了"（专业背书+痛点）
  - "肩宽星人的救星！这件肩线设计绝了"（痛点+专业分析）

✅ 正确示例（男装带货 - 女生视角解决痛点，不暴露感情状态）：
  - 标题："男生不会穿？照着买就对了"（痛点+解决方案，13字）
  - "这件男装版型太绝了！显高显瘦"（专业评价+效果）
  - "男生显高穿搭模板，我帮你们试过了"（专业背书+痛点）
  - "帮朋友选的，他穿完直接帅了一个度"（中性表达+效果）

❌ 错误示例（暴露感情状态）：
  - "帮我男朋友买的"（暴露有男友）
  - "给对象选的这件"（暴露有对象）
  - "男友穿搭分享"（暴露有男友）

❌ 错误示例：
  - "本产品采用先进技术..."（太正式、像广告）
  - "完美无缺的选择"（过度夸张、不真实）
  - "这件衣服真的很好看"（没有痛点、太空泛）
  - 标题超过20字（太长、不够精炼）

- **重要**：以25岁女模特博主的视角写，要体现你的专业度和真实体验：
${audienceGuidelines}

记住：你是一个25岁的年轻女模特博主，懂服装、有态度、真诚分享，不是在念广告词！`;

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
