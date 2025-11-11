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

        const prompt = `描述我上传的图片的服装特征，并给我8个穿着此衣服的模特姿势+场景搭配组合，场景和姿势要详细(场景默认有这个'服装店'场景: ${defaultBoutiqueScene})

请以JSON格式返回结果，格式如下：
{
  "description": "服装描述",
  "suggestions": [
    {"scene": "场景1详细描述", "pose": "姿势1详细描述"},
    {"scene": "场景2详细描述", "pose": "姿势2详细描述"},
    {"scene": "场景3详细描述", "pose": "姿势3详细描述"},
    {"scene": "场景4详细描述", "pose": "姿势4详细描述"},
    {"scene": "场景5详细描述", "pose": "姿势5详细描述"},
    {"scene": "场景6详细描述", "pose": "姿势6详细描述"},
    {"scene": "场景7详细描述", "pose": "姿势7详细描述"},
    {"scene": "场景8详细描述", "pose": "姿势8详细描述"}
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
}
