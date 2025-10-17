// GPT分析服装的提示词
export const GPT_ANALYZE_CLOTHING_PROMPT = `请详细描述图片中人物的穿搭，包括：
1. 服装款式和颜色
2. 配饰细节
3. 整体风格
4. 场景和背景
5. 人物姿态和表情

请用中文回答，尽可能详细和准确。`;

// GPT分析背景和姿态的提示词
export const GPT_ANALYZE_BG_GESTURE_PROMPT = `请详细描述图片中的背景环境和人物姿态：
1. 背景场景描述（室内/室外、环境特征、光线等）
2. 人物的姿态和动作
3. 人物的表情和神态
4. 整体氛围

请用中文回答，注重细节描述。`;

// Gemini生成图片的提示词（普通模式）
export const IMAGE_GENERATION_PROMPT = `请根据以下服装描述，在提供的模特图片基础上，生成一张穿着这些服装的图片。
要求：
1. 保持模特的姿态和表情
2. 服装要自然贴合模特身材
3. 注意光影和材质细节

服装描述`;

// Gemini生成图片的提示词（新背景和姿态）
export const IMAGE_GENERATION_NEW_BG_GESTURE_PROMPT = `请根据以下描述，生成一张新的人物图片：

服装描述：{clothingDescription}

背景和姿态：{bgGestureDescription}

要求：
1. 人物穿着描述中的服装
2. 放置在指定的背景环境中
3. 采用描述的姿态和表情
4. 注意整体的协调性和真实感
5. 保持专业的摄影质量`;

// Gemini生成Base64图片的提示词
export const IMAGE_GENERATION_BASE64_PROMPT = `请根据以下服装描述，在提供的模特图片基础上，生成一张穿着这些服装的图片。

要求：
1. 保持模特的姿态和表情
2. 服装要自然贴合模特身材
3. 注意光影和材质细节
4. 直接返回完整的 base64 格式图片数据（以 data:image/ 开头）

服装描述：`;

// 小红书标题生成提示词
export const XIAOHONGSHU_TITLE_PROMPT = `请根据以下服装描述，生成一个小红书风格的爆款标题。

服装描述：{clothingDescription}

图片数量：{imageCount}张

要求：
1. 标题要吸引眼球，使用适当的emoji
2. 突出服装的亮点和特色
3. 体现时尚感和潮流感
4. 字数控制在20-30字之间
5. 可以使用小红书常见的标题套路（如：种草、必入、绝绝子等）

请只返回标题内容，不需要其他说明。`;
