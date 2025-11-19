import OpenAI from 'openai';
import { openRouterConfig, AI_MODELS } from './config';
import { ImageAnalysisResult } from './types';
import {
    GPT_ANALYZE_CLOTHING_PROMPT,
    GPT_ANALYZE_CLOTHING_TOP_ONLY_PROMPT,
    XIAOHONGSHU_TITLE_PROMPT
} from './prompts';

// 辅助函数：从可能包含 markdown 代码块的字符串中提取 JSON
function extractJsonFromMarkdown(content: string): string {
    let jsonStr = content.trim();

    // Strategy 1: Look for JSON within markdown code blocks with regex
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
    }

    // Strategy 2: Remove leading/trailing ``` if present
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
        return jsonStr;
    }

    // Strategy 3: Find the first { and last } to extract JSON object
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        return jsonStr.substring(firstBrace, lastBrace + 1);
    }

    // Return as-is if no extraction strategy worked
    return jsonStr;
}

// AI服务类
export class AIService {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            baseURL: openRouterConfig.baseURL,
            apiKey: openRouterConfig.apiKey,
            timeout: 60000, // 60 seconds timeout
            maxRetries: 2, // Retry up to 2 times on network errors
        });
    }

    // 调用GPT模型分析图片
    async analyzeWithGPT(imageSource: string, extractTopOnly: boolean = false): Promise<string> {
        console.log('📡 正在调用GPT API...');
        console.log('🔧 模型:', AI_MODELS.GPT);
        console.log('🔧 只提取上装:', extractTopOnly);

        const prompt = extractTopOnly ? GPT_ANALYZE_CLOTHING_TOP_ONLY_PROMPT : GPT_ANALYZE_CLOTHING_PROMPT;

        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: prompt
            },
            {
                type: "image_url",
                image_url: { url: imageSource }
            }
        ];

        try {
            const completion = await this.client.chat.completions.create({
                model: AI_MODELS.GPT,
                messages: [{ role: "user", content }],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            console.log('📦 API完整响应:', JSON.stringify(completion, null, 2));

            if (completion.choices?.[0]?.message?.content) {
                const responseContent = completion.choices[0].message.content;
                console.log('✅ 响应内容长度:', responseContent.length);
                console.log('📝 响应内容预览:', responseContent.substring(0, 200));
                return responseContent;
            }

            console.error('❌ 响应结构异常:', {
                hasChoices: !!completion.choices,
                choicesLength: completion.choices?.length,
                firstChoice: completion.choices?.[0],
            });
            throw new Error('GPT API响应格式错误或内容为空');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 GPT API调用失败:', errorMessage);

            // 打印更详细的错误信息
            if (error instanceof Error && 'response' in error) {
                console.error('🔍 错误详情:', error);
            }

            throw error;
        }
    }

    // 分析图片接口 - 只使用GPT模型
    async analyzeImage(imageSource: string, filename: string, extractTopOnly: boolean = false): Promise<ImageAnalysisResult> {
        const startTime = new Date();

        try {
            const analysis = await this.analyzeWithGPT(imageSource, extractTopOnly);

            return {
                filename,
                modelName: AI_MODELS.GPT,
                analysis,
                timestamp: startTime,
                success: true
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                filename,
                modelName: AI_MODELS.GPT,
                analysis: '',
                timestamp: startTime,
                success: false,
                error: errorMessage
            };
        }
    }

    // 生成小红书爆款标题
    async generateXiaohongshuTitle(clothingDescription: string, imageCount: number): Promise<string> {
        console.log('📝 正在生成小红书标题...');
        console.log('🔧 模型:', AI_MODELS.GPT);

        const prompt = XIAOHONGSHU_TITLE_PROMPT
            .replace('{clothingDescription}', clothingDescription)
            .replace('{imageCount}', imageCount.toString());

        try {
            const completion = await this.client.chat.completions.create({
                model: AI_MODELS.GPT,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                max_tokens: 2000,
                temperature: 0.8
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            if (completion.choices?.[0]?.message?.content) {
                const title = completion.choices[0].message.content.trim();
                console.log('✅ 标题生成成功');
                return title;
            }

            throw new Error('标题生成失败：API响应格式错误或内容为空');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 标题生成失败:', errorMessage);
            throw error;
        }
    }

    // 分析场景和姿势建议
    async analyzeSceneAndPose(imageSource: string): Promise<{
        description: string;
        suggestions: Array<{ scene: string; pose: string }>;
    }> {
        console.log('🎭 正在分析场景和姿势...');
        console.log('🔧 模型:', AI_MODELS.GPT);

        const defaultBoutiqueScene = 'minimalist boutique clothing store interior with modern industrial design, large floor-to-ceiling window showing a rainy city street outside with raindrops on glass, textured concrete wall, dark wooden floor, simple clothing rack with neatly hung neutral-toned clothes, cozy corner by the window with a laptop, magazines, and a cup of latte on the stone ledge, soft natural daylight filtered through rain, calm rainy-day atmosphere, cinematic lighting';

        const prompt = `请仔细分析图片中的服装特征，并根据服装的风格、颜色、材质、设计细节等，智能推荐8个最匹配的场景+姿势组合。

**分析要求：**
1. **服装风格分析**：判断服装属于什么风格（休闲、正式、运动、优雅、街头、复古、轻奢等）
2. **颜色和材质分析**：分析主色调、材质质感（如丝绸、针织、牛仔、雪纺、皮革等）
3. **适用场景判断**：根据服装特征判断适合的场合（通勤、约会、度假、聚会、日常、运动等）

**场景推荐原则：**
- **必须根据服装特征匹配场景**，不要随意推荐：
  - 正式西装/衬衫 → 办公室、商务会议、咖啡厅、城市街道等正式场景
  - 休闲T恤/牛仔裤 → 咖啡厅、公园、街头、书店、商场等休闲场景
  - 运动服/运动装 → 健身房、运动场、公园、户外等运动场景
  - 连衣裙/优雅装扮 → 花园、海边、咖啡厅、餐厅、美术馆等优雅场景
  - 街头潮流装 → 城市街头、涂鸦墙、天台、工业风建筑等街头场景
  - 复古风格 → 复古咖啡厅、老街、书店、艺术画廊等复古场景
  - 度假装扮 → 海滩、度假村、泳池、热带花园等度假场景

- **场景要多样化但风格统一**：推荐不同场景，但都要符合服装风格
- **场景描述要详细具体**：包括环境特征、光线、氛围、道具等细节
- **其中一个场景可以使用默认服装店场景**：${defaultBoutiqueScene}

**姿势推荐原则：**
- **姿势要与场景协调**：不同场景下的姿势要自然合理
- **姿势要符合服装风格**：正式装扮姿势优雅端庄，休闲装扮姿势放松随性
- **姿势要多样化**：包括站姿、坐姿、行走、互动等不同姿势

请以JSON格式返回结果，格式如下：
{
  "description": "服装的详细特征分析（风格、颜色、材质、适用场合等）",
  "suggestions": [
    {"scene": "场景1详细描述（根据服装匹配的场景）", "pose": "姿势1详细描述（与场景协调的姿势）"},
    {"scene": "场景2详细描述", "pose": "姿势2详细描述"},
    {"scene": "场景3详细描述", "pose": "姿势3详细描述"},
    {"scene": "场景4详细描述", "pose": "姿势4详细描述"},
    {"scene": "场景5详细描述", "pose": "姿势5详细描述"},
    {"scene": "场景6详细描述", "pose": "姿势6详细描述"},
    {"scene": "场景7详细描述", "pose": "姿势7详细描述"},
    {"scene": "场景8详细描述", "pose": "姿势8详细描述"}
  ]
}

**重要提醒：场景必须与服装风格、颜色、材质高度匹配，不要推荐不相关的场景！**`;

        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: prompt
            },
            {
                type: "image_url",
                image_url: { url: imageSource }
            }
        ];

        try {
            const completion = await this.client.chat.completions.create({
                model: AI_MODELS.GPT,
                messages: [{ role: "user", content }],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            console.log('📦 API完整响应:', JSON.stringify(completion, null, 2));

            if (completion.choices?.[0]?.message?.content) {
                const responseContent = completion.choices[0].message.content;
                console.log('✅ 响应内容:', responseContent);

                // Extract JSON from response (handle markdown code blocks)
                const jsonStr = extractJsonFromMarkdown(responseContent);

                const result = JSON.parse(jsonStr);
                return result;
            }

            throw new Error('场景姿势分析失败：API响应格式错误或内容为空');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 场景姿势分析失败:', errorMessage);

            // Log more error details
            if (error instanceof Error && 'response' in error) {
                console.error('🔍 错误详情:', error);
            }

            throw error;
        }
    }

    // 生成模特姿势列表
    async generateModelPoseList(imageSource: string, wearingMask: boolean = false): Promise<{
        description: string;
        poses: string[];
    }> {
        console.log('💃 正在生成模特姿势列表...');
        console.log('🔧 模型:', AI_MODELS.GPT);
        console.log('😷 白色口罩:', wearingMask);

        const maskRequirement = wearingMask ? '，模特需要带着白色口罩' : '';
        const prompt = `请仔细分析图片中的服装特征，并生成8个能够充分展示服装特性的模特姿势${maskRequirement}。

**核心目标：姿势应该突出展示服装的设计特点，而不是强调模特身材曲线**

**第一步：服装特征分析**
请先详细分析服装的以下特征：
1. **服装类型**：
   - 上装类型（外套/衬衫/T恤/毛衣/背心等）
   - 下装类型（裤子/裙子/短裤等）
   - 有无特殊单品（丝袜/配饰等）

2. **设计特点**（重点关注）：
   - **领口设计**：圆领/V领/高领/翻领等，是否有特殊装饰
   - **袖子设计**：长袖/短袖/泡泡袖/喇叭袖等，袖口细节
   - **版型剪裁**：修身/宽松/oversize/A字/直筒等
   - **图案/印花**：是否有特殊图案、印花、刺绣、logo等
   - **材质质感**：丝绸/针织/牛仔/雪纺/皮革等，光泽感如何
   - **细节装饰**：纽扣/拉链/口袋/系带/褶皱/开衩等设计细节
   - **颜色搭配**：主色调、撞色、渐变等颜色特征
   - **裤型/裙型特点**：喇叭裤/阔腿裤/铅笔裤/百褶裙/A字裙等，长度和版型

3. **服装风格**：休闲/正式/运动/优雅/街头/复古/轻奢等

4. **需要重点展示的部位**（基于服装特征判断）：
   - 如果上装有特殊领口设计 → 姿势需要展示领口区域
   - 如果袖子有设计亮点 → 姿势需要展示手臂和袖子
   - 如果腰部有设计（腰带/收腰） → 姿势需要展示腰线
   - 如果下装有特殊剪裁 → 姿势需要展示腿部线条和裤型/裙型
   - 如果有印花/图案 → 姿势需要完整展示图案区域
   - 如果有口袋设计 → 可以有手插口袋的姿势展示口袋
   - 如果有开衩/褶皱 → 需要能展示这些动态细节的姿势

**第二步：生成展示服装的姿势**
基于服装特征分析，生成8个不同的姿势，要求：

1. **姿势目的性**：每个姿势都应该有明确目标 - 展示服装的某个设计特点
   - ❌ 错误示例："模特侧身站立，展示曲线"（强调身材）
   - ✅ 正确示例："模特侧身站立，一手轻扶腰间系带，展示腰部收腰设计和系带细节"（强调服装）

2. **手部动作的功能性**：
   - 手插口袋 → 展示口袋设计
   - 手拉外套衣角 → 展示外套版型和内搭
   - 手扶领口/袖口 → 展示领口或袖口设计
   - 手自然下垂或微微打开 → 展示整体服装轮廓
   - 手拿配饰/包包 → 展示搭配效果

3. **身体角度的选择**：
   - 正面 → 展示正面设计（印花、纽扣、领口等）
   - 侧面 → 展示侧面剪裁、版型轮廓、开衩等
   - 背面 → 展示背部设计（背部图案、拉链、蝴蝶结等）
   - 3/4侧身 → 展示立体剪裁和整体搭配

4. **动态姿势的运用**：
   - 行走姿势 → 展示下装的动态效果（裙摆飘动、阔腿裤摆动等）
   - 转身姿势 → 展示服装的流动感和360度效果
   - 坐姿 → 展示服装在不同状态下的版型保持
   - 手臂动作 → 展示袖子的活动范围和设计

5. **姿势多样性**：
   - 包含站姿、坐姿、行走、转身等不同类型
   - 包含正面、侧面、背面等不同角度
   - 包含静态和动态姿势的组合
   - 每个姿势都要强调不同的服装特点

6. **避免强调身材的描述**：
   - ❌ 不要用"展示曲线"、"凸显身材"、"性感"、"妖娆"等词汇
   - ✅ 使用"展示版型"、"呈现剪裁"、"显示设计细节"、"突出材质质感"等词汇

**姿势描述要求**：
- 每个姿势描述要详细具体，包含：
  1. 身体朝向和角度
  2. 手部具体动作（展示哪个服装细节）
  3. 腿部姿势（站/坐/走）
  4. 面部表情和视线方向
  5. 这个姿势要展示服装的哪个设计特点${wearingMask ? '\n  6. 明确说明模特带着白色口罩' : ''}

**输出格式：**
请以JSON格式返回结果：
{
  "description": "服装的详细特征分析（包括类型、设计特点、材质、风格、需要重点展示的部位）",
  "poses": [
    "姿势1：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}",
    "姿势2：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}",
    "姿势3：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}",
    "姿势4：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}",
    "姿势5：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}",
    "姿势6：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}",
    "姿势7：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}",
    "姿势8：[详细描述] - 重点展示：[具体的服装设计特点]${wearingMask ? '，带着白色口罩' : ''}"
  ]
}

**重要提醒：**
- 姿势的目的是展示服装，不是展示身材
- 每个姿势都要针对性地展示服装的某个具体设计特点
- 描述要专业、客观，聚焦于服装本身
- 姿势要自然、优雅，符合服装风格
- 确保8个姿势各不相同，从多角度全方位展示服装`;

        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: prompt
            },
            {
                type: "image_url",
                image_url: { url: imageSource }
            }
        ];

        try {
            const completion = await this.client.chat.completions.create({
                model: AI_MODELS.GPT,
                messages: [{ role: "user", content }],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            console.log('📦 API完整响应:', JSON.stringify(completion, null, 2));

            if (completion.choices?.[0]?.message?.content) {
                const responseContent = completion.choices[0].message.content;
                console.log('✅ 响应内容:', responseContent);

                // Extract JSON from response (handle markdown code blocks)
                const jsonStr = extractJsonFromMarkdown(responseContent);

                const result = JSON.parse(jsonStr);
                return result;
            }

            throw new Error('模特姿势列表生成失败：API响应格式错误或内容为空');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 模特姿势列表生成失败:', errorMessage);

            // Log more error details
            if (error instanceof Error && 'response' in error) {
                console.error('🔍 错误详情:', error);
            }

            throw error;
        }
    }

    // 分析参考图片的场景和姿势
    async analyzeMimicReference(imageSource: string): Promise<{
        sceneDescription: string;
        poseDescription: string;
    }> {
        console.log('📸 正在分析参考图片的场景和姿势...');
        console.log('🔧 模型:', AI_MODELS.GPT);

        const prompt = `请详细分析这张图片中模特的场景环境和姿势动作。

**🎯 关键要求：首先识别画面构图范围**
请先判断图片展示了模特的哪些身体部位：
- **全身构图**：头部到脚部都在画面内
- **半身构图**：胸部/腰部以上（可能包含或不包含头部）
- **上半身构图**：头部以下的上半身（肩膀、胸部、手臂等）
- **下半身构图**：腰部以下（臀部、腿部、脚部等）
- **局部构图**：只展示特定部位（如手部、腿部等）

**⚠️ 核心原则：只描述画面中实际可见的身体部位和姿势！**
- 如果图片**不包含头部**，则**完全不要**描述头部、面部、视线、表情等信息
- 如果图片**不包含腿部**，则**完全不要**描述腿部、脚部、重心等信息
- 必须严格遵守"画面中看不到的部位不描述"的原则

**场景分析要求：**
请详细描述图片中的场景环境，包括：
1. **环境类型**：室内/室外、具体场所（咖啡厅、街道、公园、办公室等）
2. **背景元素**：墙壁、家具、植物、建筑、道具等具体物品
3. **光线特征**：
   - 光源类型（自然光/人造光、窗户光/顶灯/侧光等）
   - 光线方向（从左/右/上/下照射）
   - 光线质感（柔和/强烈、暖色调/冷色调）
   - 阴影效果
4. **色调和氛围**：整体色调（暖色/冷色/中性）、氛围感（温馨/清冷/活力/宁静等）
5. **空间感**：景深、前景/中景/背景的关系
6. **拍摄角度**：平视/俯视/仰视、距离（近景/中景/远景）
7. **构图范围**：明确说明画面展示了模特的哪些身体部位（全身/半身/上半身/下半身/局部）

**姿势分析要求（⚠️ 只描述画面中可见的身体部位）：**
1. **构图说明**：首先明确说明画面展示范围（例如："本图为上半身构图，不包含头部，展示肩膀至腰部区域"）

2. **整体姿态**（如果可见）：站姿/坐姿/躺姿/行走等基本姿态

3. **身体朝向**（如果可见）：面向镜头的角度（正面/侧面/背面/斜45度等）

4. **头部动作**（⚠️ 仅当画面包含头部时才描述）：
   - 头部角度（抬头/低头/侧头/正视）
   - 视线方向（看镜头/看远处/看向某处/闭眼等）
   - 表情特征（微笑/严肃/放松/思考等）

5. **躯干姿态**（如果可见）：
   - 肩膀线条（平直/倾斜/放松/挺直）
   - 胸部朝向和姿态
   - 腰部扭转、倾斜
   - 身体曲线和重心感

6. **手臂和手部动作**（如果可见）：
   - 手臂位置（自然下垂/交叉/抬起/撑腰等）
   - 手部姿势（插口袋/托腮/拿物品/做手势等）
   - 左右手的具体动作

7. **腿部和脚部动作**（⚠️ 仅当画面包含腿部时才描述）：
   - 双腿姿势（并拢/分开/交叉/一前一后等）
   - 重心分布（重心在左腿/右腿/均衡）
   - 脚的朝向和位置

8. **整体动态感**：静态/动态、放松/紧张、自然/做作

**输出格式要求：**
请以JSON格式返回结果：
{
  "sceneDescription": "场景的详细描述（包含构图范围说明和所有场景要素）",
  "poseDescription": "姿势的详细描述（首先说明构图范围，然后只描述可见身体部位的姿势）"
}

**❗ 最重要的提醒：**
- 在poseDescription的开头必须明确说明画面构图范围（如："画面为上半身构图，不包含头部"）
- 绝对不要描述画面中看不到的身体部位！
- 如果没有头部，就完全不提头部、面部、表情、视线
- 如果没有腿部，就完全不提腿部、脚部、重心分配
- 描述要准确反映画面实际展示的内容，不要脑补或推测画面外的姿势`;

        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: prompt
            },
            {
                type: "image_url",
                image_url: { url: imageSource }
            }
        ];

        try {
            const completion = await this.client.chat.completions.create({
                model: AI_MODELS.GPT,
                messages: [{ role: "user", content }],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            console.log('📦 API完整响应:', JSON.stringify(completion, null, 2));

            if (completion.choices?.[0]?.message?.content) {
                const responseContent = completion.choices[0].message.content;
                console.log('✅ 响应内容:', responseContent);

                // Extract JSON from response (handle markdown code blocks)
                const jsonStr = extractJsonFromMarkdown(responseContent);

                const result = JSON.parse(jsonStr);

                // Ensure sceneDescription and poseDescription are strings
                // If they are objects, convert them to formatted strings
                let sceneDescription = result.sceneDescription;
                let poseDescription = result.poseDescription;

                if (typeof sceneDescription === 'object' && sceneDescription !== null) {
                    sceneDescription = JSON.stringify(sceneDescription, null, 2);
                }

                if (typeof poseDescription === 'object' && poseDescription !== null) {
                    poseDescription = JSON.stringify(poseDescription, null, 2);
                }

                return {
                    sceneDescription: String(sceneDescription || ''),
                    poseDescription: String(poseDescription || '')
                };
            }

            throw new Error('参考图片分析失败：API响应格式错误或内容为空');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 参考图片分析失败:', errorMessage);

            // Log more error details
            if (error instanceof Error && 'response' in error) {
                console.error('🔍 错误详情:', error);
            }

            throw error;
        }
    }
}
