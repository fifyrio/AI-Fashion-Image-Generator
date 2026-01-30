import OpenAI from 'openai';
import { openRouterConfig, AI_MODELS } from './config';
import { ImageAnalysisResult } from './types';
import {
    GPT_ANALYZE_CLOTHING_PROMPT,
    GPT_ANALYZE_CLOTHING_TOP_ONLY_PROMPT,
    XIAOHONGSHU_TITLE_PROMPT,
    SMART_OUTFIT_MATCHING_PROMPT,
    OUTFIT_SUMMARY_PROMPT
} from './prompts';

// 辅助函数：从可能包含 markdown 代码块的字符串中提取 JSON
function extractJsonFromMarkdown(content: string): string {
    let jsonStr = content.trim();

    // Strategy 1: Look for JSON within markdown code blocks with regex
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
    } else if (jsonStr.startsWith('```')) {
        // Strategy 2: Remove leading/trailing ``` if present
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?\s*```$/, '').trim();
    } else {
        // Strategy 3: Find the first { and last } to extract JSON object
        const firstBrace = jsonStr.indexOf('{');
        const lastBrace = jsonStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
        }
    }

    // Strategy 4: Fix common JSON issues
    // Fix trailing commas before ] or }
    jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');

    // Fix unescaped newlines in strings (common issue with AI-generated JSON)
    // This replaces actual newlines inside JSON string values with \n
    jsonStr = jsonStr.replace(/"([^"]*(?:\\.[^"]*)*)"/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    });

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
   - **内衬/内搭/夹层设计**：是否有特殊的内衬材质、颜色对比、内里口袋、夹层设计等值得展示的内部细节

3. **服装风格**：休闲/正式/运动/优雅/街头/复古/轻奢等

4. **需要重点展示的部位**（基于服装特征判断）：
   - 如果上装有特殊领口设计 → 姿势需要展示领口区域
   - 如果袖子有设计亮点 → 姿势需要展示手臂和袖子
   - 如果腰部有设计（腰带/收腰） → 姿势需要展示腰线
   - 如果下装有特殊剪裁 → 姿势需要展示腿部线条和裤型/裙型
   - 如果有印花/图案 → 姿势需要完整展示图案区域
   - 如果有口袋设计 → 可以有手插口袋的姿势展示口袋
   - 如果有开衩/褶皱 → 需要能展示这些动态细节的姿势
   - **如果外套/衬衫有特殊内衬设计** → 需要有手提起衣襟或拉开外套的姿势，展示内衬材质、颜色、内里口袋等细节
   - **如果有叠穿/内搭设计** → 需要有撩开外套或解开纽扣的姿势，展示内搭和叠穿效果

**第二步：生成展示服装的姿势**
基于服装特征分析，生成8个不同的姿势，要求：

1. **姿势目的性**：每个姿势都应该有明确目标 - 展示服装的某个设计特点
   - ❌ 错误示例："模特侧身站立，展示曲线"（强调身材）
   - ✅ 正确示例："模特侧身站立，一手轻扶腰间系带，展示腰部收腰设计和系带细节"（强调服装）
   - ✅ 正确示例（展示内衬）："模特正面站立，右手提起外套右侧衣襟向外打开，展示外套内衬的丝绸材质和撞色设计"（展示内部细节）

2. **手部动作的功能性**：
   - 手插口袋 → 展示口袋设计
   - 手拉外套衣角 → 展示外套版型和内搭
   - 手扶领口/袖口 → 展示领口或袖口设计
   - 手自然下垂或微微打开 → 展示整体服装轮廓
   - 手拿配饰/包包 → 展示搭配效果
   - **手提起外套/衬衫右侧衣襟** → 将外套从身体往外打开，展示里面的内衬、内搭或夹层设计
   - **手拉开外套前襟** → 展示外套的内衬材质、颜色、口袋内侧等细节
   - **手撩起衣摆** → 展示衣服的下摆设计、内层或叠穿效果

3. **身体角度的选择（重点增加背面和侧面）**：
   - 正面 → 展示正面设计（印花、纽扣、领口等）- 最多2个正面姿势
   - 侧面 → 展示侧面剪裁、版型轮廓、开衩等 - 至少2个侧面姿势
   - 背面 → 展示背部设计（背部图案、拉链、蝴蝶结等）- 至少2个背面姿势
   - 3/4侧身 → 展示立体剪裁和整体搭配 - 至少1个3/4侧身姿势

4. **动态姿势的运用**：
   - 行走姿势 → 展示下装的动态效果（裙摆飘动、阔腿裤摆动等）
   - 转身姿势 → 展示服装的流动感和360度效果
   - 回眸姿势 → 背对镜头但头部转向镜头，展示服装背面和侧面
   - 手臂动作 → 展示袖子的活动范围和设计
   - ❌ 不要使用坐姿 - 坐姿容易遮挡服装细节，不利于展示

5. **姿势多样性**：
   - 全部使用站姿（包括行走、转身、静态站立等），不要坐姿
   - 角度分布要求：至少2个背面、至少2个侧面、最多2个正面、至少1个3/4侧身
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
- 确保8个姿势各不相同，从多角度全方位展示服装
- ⚠️ **角度分布强制要求**：至少2个背面姿势、至少2个侧面姿势、最多2个正面姿势、至少1个3/4侧身姿势
- ❌ **禁止使用坐姿** - 所有姿势必须是站立状态（包括行走、转身、静止站立等），不要有任何坐着的姿势`;

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

                // Ensure description is a string
                // If it's an object, convert it to a formatted string
                let description = result.description;
                if (typeof description === 'object' && description !== null) {
                    description = JSON.stringify(description, null, 2);
                }

                return {
                    description: String(description || ''),
                    poses: Array.isArray(result.poses) ? result.poses : []
                };
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
    }> {
        console.log('📸 正在分析参考图片的场景环境...');
        console.log('🔧 模型:', AI_MODELS.GPT);

        const prompt = `请详细分析这张图片中的场景环境和背景，**完全忽略模特的姿势和动作**。

**🎯 核心任务：只分析场景环境，不分析人物姿势**

**场景分析要求：**
请详细描述图片中的场景环境，包括：

1. **环境类型**：
   - 室内/室外、具体场所（咖啡厅、街道、公园、办公室、卧室、商场等）
   - 空间大小和类型（开放空间/封闭空间/室内角落等）

2. **背景元素**：
   - 主要背景物品：墙壁、家具、植物、建筑、装饰品等
   - 次要背景物品：道具、摆设、装饰等
   - 地面/地板材质和颜色

3. **光线特征（重要）**：
   - **光源类型**：自然光/人造光、窗户光/顶灯/落地灯/侧光/环境光等
   - **光线方向**：从左侧/右侧/上方/下方/正面照射
   - **光线质感**：柔和/强烈/均匀/层次分明
   - **色温**：暖色调（偏黄）/冷色调（偏蓝）/中性色
   - **阴影效果**：强阴影/柔和阴影/无明显阴影
   - **明暗对比**：高对比/低对比/均匀照明

4. **色调和氛围**：
   - **整体色调**：暖色系/冷色系/中性色系/高饱和度/低饱和度
   - **主色调**：具体的主要颜色（如米白色、浅灰色、深蓝色等）
   - **配色方案**：背景中的颜色搭配
   - **氛围感**：温馨/清冷/活力/宁静/复古/现代/简约/奢华等

5. **空间感和景深**：
   - **景深效果**：背景虚化程度（浅景深/深景深）
   - **前景元素**：前景中是否有物品（如植物、家具等）
   - **中景/背景关系**：空间层次感
   - **透视关系**：空间的纵深感

6. **拍摄角度和构图**：
   - **拍摄视角**：平视/俯视/仰视
   - **拍摄距离**：近景/中景/远景/特写
   - **画面构图**：中心构图/三分构图/对称构图等
   - **画幅比例**：方形/竖屏/横屏

7. **环境细节**：
   - 墙面质感（光滑/粗糙/有纹理）
   - 特殊装饰（壁画、海报、挂件、镜子等）
   - 窗户、门、建筑结构等

**❌ 绝对不要分析的内容：**
- ❌ 模特的姿势、动作、站姿、坐姿
- ❌ 模特的表情、视线方向、头部动作
- ❌ 模特的手部动作、腿部姿势
- ❌ 模特的身体朝向、重心分布
- ❌ 任何与人物姿态相关的描述

**✅ 正确的分析重点：**
- ✅ 只关注背景环境、光线、氛围、空间感
- ✅ 描述场景元素的位置、大小、质感
- ✅ 详细描述光影效果和色调氛围
- ✅ 分析拍摄角度和空间关系

**输出格式要求：**
请以JSON格式返回结果：
{
  "sceneDescription": "场景的详细描述（只包含环境、光线、背景元素、氛围等，不包含任何人物姿势描述）"
}

**示例输出：**
{
  "sceneDescription": "室内环境，白色墙面背景，柔和的自然光从左侧窗户照入，营造出温暖的氛围。背景中有一盆绿色植物摆放在左后方，地面为浅色木地板。光线质感柔和均匀，整体色调偏暖，呈现出温馨舒适的居家感。拍摄角度为平视，中景构图，画面采用竖屏比例（9:16）。空间感开阔，背景略有虚化，突出主体。整体氛围简约清新。"
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
                const jsonStr = extractJsonFromMarkdown(responseContent);

                const result = JSON.parse(jsonStr);

                // Ensure sceneDescription is a string
                // If it is an object, convert it to a formatted string
                let sceneDescription = result.sceneDescription;

                if (typeof sceneDescription === 'object' && sceneDescription !== null) {
                    sceneDescription = JSON.stringify(sceneDescription, null, 2);
                }

                return {
                    sceneDescription: String(sceneDescription || '')
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

    /**
     * Generate detailed clothing description using bytedance-seed model
     * @param imageSource Image URL to analyze
     * @returns Detailed clothing description
     */
    async describeClothing(imageSource: string): Promise<string> {
        console.log('📝 Generating clothing description with bytedance-seed...');
        console.log('🔧 Model:', AI_MODELS.BYTEDANCE_SEED);

        const prompt = `Please provide a detailed description of the clothing in this image. Include:
1. Type of garment (jacket, dress, pants, etc.)
2. Color and color patterns
3. Material and texture
4. Style and design details (collars, sleeves, patterns, etc.)
5. Overall style (casual, formal, sporty, etc.)

Format the response as a coherent paragraph suitable for image generation.`;

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
                model: AI_MODELS.BYTEDANCE_SEED,
                messages: [{ role: "user", content }],
                max_tokens: 500,
                temperature: 0.7
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            if (completion.choices?.[0]?.message?.content) {
                const description = completion.choices[0].message.content.trim();
                console.log('✅ Description generated:', description);
                return description;
            }

            throw new Error('Failed to generate clothing description');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 Clothing description failed:', errorMessage);
            throw error;
        }
    }

    /**
     * Describe clothing AND generate smart matching outfit suggestions
     * Combines clothing analysis with intelligent styling recommendations
     */
    async describeClothingWithSmartMatch(imageSource: string): Promise<{
        description: string;
        matchingSuggestions: string;
    }> {
        console.log('📝 Generating clothing description + smart matching with bytedance-seed...');
        console.log('🔧 Model:', AI_MODELS.BYTEDANCE_SEED);

        const prompt = SMART_OUTFIT_MATCHING_PROMPT; // From prompts.ts

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
                model: AI_MODELS.BYTEDANCE_SEED,
                messages: [{ role: "user", content }],
                max_tokens: 1200,  // Increased for description + suggestions + mix-match details
                temperature: 0.85  // Increased from 0.7 to add more variety in recommendations
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            if (completion.choices?.[0]?.message?.content) {
                const fullResponse = completion.choices[0].message.content.trim();
                console.log('✅ Smart matching response generated');

                // Parse response into description and suggestions
                const result = this.parseSmartMatchResponse(fullResponse);

                // Validate we got at least the description
                if (!result.description || result.description.length < 10) {
                    console.warn('⚠️ Description too short, falling back to basic description');
                    const basicDescription = await this.describeClothing(imageSource);
                    return {
                        description: basicDescription,
                        matchingSuggestions: ''
                    };
                }

                return result;
            }

            throw new Error('Failed to generate clothing description with smart matching');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 Smart matching failed:', errorMessage);

            // Graceful fallback to basic description
            console.log('🔄 Falling back to basic description...');
            const basicDescription = await this.describeClothing(imageSource);
            return {
                description: basicDescription,
                matchingSuggestions: '智能搭配建议生成失败，请稍后重试'
            };
        }
    }

    /**
     * Parse AI response to extract description and suggestions separately
     */
    private parseSmartMatchResponse(response: string): {
        description: string;
        matchingSuggestions: string;
    } {
        // Split by section markers
        const descriptionMatch = response.match(/【服装描述】\s*([\s\S]*?)(?=【搭配建议】|$)/);
        const suggestionsMatch = response.match(/【搭配建议】\s*([\s\S]*)/);

        const description = descriptionMatch?.[1]?.trim() || response;
        const matchingSuggestions = suggestionsMatch?.[1]?.trim() || '';

        console.log('📊 Parsed description length:', description.length);
        console.log('📊 Parsed suggestions length:', matchingSuggestions.length);

        return {
            description,
            matchingSuggestions
        };
    }

    /**
     * Analyze multiple outfit images and summarize hit product formulas
     * @param imageUrls Array of image URLs to analyze
     * @returns Structured outfit summary with formulas and patterns
     */
    async analyzeOutfitSummary(imageUrls: string[]): Promise<import('./types').OutfitSummaryResult> {
        console.log('👗 正在分析爆款穿搭公式...');
        console.log('🔧 模型:', AI_MODELS.GPT);
        console.log('📊 图片数量:', imageUrls.length);

        const prompt = OUTFIT_SUMMARY_PROMPT.replace('{imageCount}', imageUrls.length.toString());

        // Build content array with text prompt + all images
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: prompt
            },
            ...imageUrls.map(url => ({
                type: "image_url" as const,
                image_url: { url }
            }))
        ];

        try {
            const completion = await this.client.chat.completions.create({
                model: AI_MODELS.GPT,
                messages: [{ role: "user", content }],
                max_tokens: 6000, // Need larger token limit for comprehensive analysis
                temperature: 0.75 // Balanced creativity for pattern recognition
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

                const result: import('./types').OutfitSummaryResult = JSON.parse(jsonStr);

                // Add imageUrls to individualAnalysis for frontend display
                if (result.individualAnalysis) {
                    result.individualAnalysis = result.individualAnalysis.map((analysis, index) => ({
                        ...analysis,
                        imageUrl: imageUrls[index]
                    }));
                }

                return result;
            }

            throw new Error('爆款总结生成失败：API响应格式错误或内容为空');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 爆款总结失败:', errorMessage);

            if (error instanceof Error && 'response' in error) {
                console.error('🔍 错误详情:', error);
            }

            throw error;
        }
    }
}
