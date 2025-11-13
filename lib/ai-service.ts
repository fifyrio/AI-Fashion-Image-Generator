import OpenAI from 'openai';
import { openRouterConfig, AI_MODELS } from './config';
import { ImageAnalysisResult } from './types';
import {
    GPT_ANALYZE_CLOTHING_PROMPT,
    GPT_ANALYZE_CLOTHING_TOP_ONLY_PROMPT,
    XIAOHONGSHU_TITLE_PROMPT
} from './prompts';

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
                let jsonStr = responseContent.trim();

                // Remove markdown code blocks if present
                const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[1];
                } else if (jsonStr.startsWith('```') && jsonStr.endsWith('```')) {
                    jsonStr = jsonStr.replace(/```(?:json)?/g, '').trim();
                }

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
    async generateModelPoseList(imageSource: string): Promise<{
        description: string;
        poses: string[];
    }> {
        console.log('💃 正在生成模特姿势列表...');
        console.log('🔧 模型:', AI_MODELS.GPT);

        const prompt = `给我描述这个服装和场景的特征，并给我8个穿着此衣服的模特姿势。

请以JSON格式返回结果，格式如下：
{
  "description": "服装和场景的详细描述",
  "poses": [
    "姿势1的详细描述",
    "姿势2的详细描述",
    "姿势3的详细描述",
    "姿势4的详细描述",
    "姿势5的详细描述",
    "姿势6的详细描述",
    "姿势7的详细描述",
    "姿势8的详细描述"
  ]
}`;

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
                let jsonStr = responseContent.trim();

                // Remove markdown code blocks if present
                const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[1];
                } else if (jsonStr.startsWith('```') && jsonStr.endsWith('```')) {
                    jsonStr = jsonStr.replace(/```(?:json)?/g, '').trim();
                }

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
                let jsonStr = responseContent.trim();

                // Remove markdown code blocks if present
                const jsonMatch = jsonStr.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
                if (jsonMatch) {
                    jsonStr = jsonMatch[1];
                } else if (jsonStr.startsWith('```') && jsonStr.endsWith('```')) {
                    jsonStr = jsonStr.replace(/```(?:json)?/g, '').trim();
                }

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
