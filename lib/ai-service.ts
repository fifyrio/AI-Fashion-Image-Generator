import OpenAI from 'openai';
import { openRouterConfig, AI_MODELS } from './config';
import { ImageAnalysisResult } from './types';
import { GPT_ANALYZE_CLOTHING_PROMPT, GPT_ANALYZE_CLOTHING_NO_ACCESSORIES_PROMPT, XIAOHONGSHU_TITLE_PROMPT } from './prompts';

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
    async analyzeWithGPT(imageSource: string, ignoreAccessories: boolean = false): Promise<string> {
        console.log('📡 正在调用GPT API...');
        console.log('🔧 模型:', AI_MODELS.GPT);
        console.log('🔧 忽略配饰:', ignoreAccessories);

        const prompt = ignoreAccessories
            ? GPT_ANALYZE_CLOTHING_NO_ACCESSORIES_PROMPT
            : GPT_ANALYZE_CLOTHING_PROMPT;

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
    async analyzeImage(imageSource: string, filename: string, ignoreAccessories: boolean = false): Promise<ImageAnalysisResult> {
        const startTime = new Date();

        try {
            const analysis = await this.analyzeWithGPT(imageSource, ignoreAccessories);

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
}
