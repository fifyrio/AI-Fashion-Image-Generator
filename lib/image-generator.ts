import OpenAI from 'openai';
import { openRouterConfig, AI_MODELS } from './config';
import { ImageGenerationResult, ImageResult } from './types';
import { IMAGE_GENERATION_BASE64_PROMPT } from './prompts';

// 图片生成服务类
export class ImageGenerator {
    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            baseURL: openRouterConfig.baseURL,
            apiKey: openRouterConfig.apiKey,
        });
    }

    // 调用Gemini模型生成图片（Base64模式）
    async generateWithGeminiBase64(clothing: string, imageUrl: string): Promise<string> {
        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: `${IMAGE_GENERATION_BASE64_PROMPT}${clothing}`
            },
            {
                type: "image_url",
                image_url: { url: imageUrl }
            }
        ];

        console.log("🔍 Gemini Base64 API请求");

        const completion = await this.client.chat.completions.create({
            model: AI_MODELS.GEMINI,
            messages: [{ role: "user", content }],
            max_tokens: 4000,
            temperature: 0.7
        }, {
            headers: {
                "HTTP-Referer": openRouterConfig.siteUrl,
                "X-Title": openRouterConfig.siteName
            }
        });

        console.log("🔍 Gemini Base64 API响应");

        return this.processOpenRouterResponse(completion);
    }

    // 生成图片接口（Base64模式）
    async generateImageBase64(
        clothing: string,
        imageUrl: string
    ): Promise<ImageGenerationResult> {
        const startTime = new Date();

        try {
            const result = await this.generateWithGeminiBase64(clothing, imageUrl);

            return {
                prompt: clothing,
                imageUrl,
                success: true,
                timestamp: startTime,
                result: result
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                prompt: clothing,
                imageUrl,
                success: false,
                error: errorMessage,
                timestamp: startTime
            };
        }
    }

    // 根据场景和姿势生成图片（使用 Gemini 2.5 Flash Image）
    async generateScenePose(
        originalImageUrl: string,
        scene: string,
        pose: string
    ): Promise<ImageGenerationResult> {
        const startTime = new Date();
        const prompt = `模特的服装不变，场景和姿势按照下面的内容改变:
场景：${scene}
姿势：${pose}`;

        console.log('🎭 Scene-Pose generation prompt:', prompt);

        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: prompt
            },
            {
                type: "image_url",
                image_url: { url: originalImageUrl }
            }
        ];

        try {
            const completion = await this.client.chat.completions.create({
                model: 'google/gemini-2.5-flash-image',
                messages: [{ role: "user", content }],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            console.log('📦 Scene-Pose API response received');

            const result = this.processOpenRouterResponse(completion);

            return {
                prompt,
                imageUrl: originalImageUrl,
                success: true,
                timestamp: startTime,
                result: result
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 Scene-Pose generation failed:', errorMessage);
            return {
                prompt,
                imageUrl: originalImageUrl,
                success: false,
                error: errorMessage,
                timestamp: startTime
            };
        }
    }

    // 根据模特姿势生成图片（使用 Gemini 2.5 Flash Image）
    async generateModelPose(
        originalImageUrl: string,
        pose: string,
        description: string
    ): Promise<ImageGenerationResult> {
        const startTime = new Date();
        const prompt = `保持图片中的服装样式不变（${description}），但是按照下面的姿势要求生成新的模特图片:
姿势：${pose}

请生成一张符合上述姿势描述的模特图片，确保服装细节与原图一致。`;

        console.log('💃 Model-Pose generation prompt:', prompt);

        const content: OpenAI.Chat.ChatCompletionContentPart[] = [
            {
                type: "text",
                text: prompt
            },
            {
                type: "image_url",
                image_url: { url: originalImageUrl }
            }
        ];

        try {
            const completion = await this.client.chat.completions.create({
                model: 'google/gemini-2.5-flash-image',
                messages: [{ role: "user", content }],
                max_tokens: 4000,
                temperature: 0.7
            }, {
                headers: {
                    "HTTP-Referer": openRouterConfig.siteUrl,
                    "X-Title": openRouterConfig.siteName
                }
            });

            console.log('📦 Model-Pose API response received');

            const result = this.processOpenRouterResponse(completion);

            return {
                prompt,
                imageUrl: originalImageUrl,
                success: true,
                timestamp: startTime,
                result: result
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('🚨 Model-Pose generation failed:', errorMessage);
            return {
                prompt,
                imageUrl: originalImageUrl,
                success: false,
                error: errorMessage,
                timestamp: startTime
            };
        }
    }

    /**
     * 处理 OpenRouter API 响应，提取图片数据
     */
    private processOpenRouterResponse(completion: OpenAI.Chat.Completions.ChatCompletion): string {
        const choice = completion.choices?.[0];
        const message = choice?.message as OpenAI.Chat.Completions.ChatCompletionMessage & { images?: ImageResult[] };

        console.log("🔍 处理 OpenRouter API 响应", message);

        // 优先检查是否有生成的图片（images 字段）
        if (message?.images && message.images.length > 0) {
            console.log("🖼️  发现生成的图片");
            const imageResult: ImageResult = message.images[0];

            if (imageResult.type === "image_url" && imageResult.image_url?.url) {
                const dataUri = imageResult.image_url.url;

                // 检查是否为 data URI 格式
                if (dataUri.startsWith('data:image/')) {
                    const matches = dataUri.match(/^data:([^;]+);base64,(.+)$/);
                    if (matches) {
                        const [, mimeType, base64Data] = matches;
                        console.log(`📦 解析 data URI: ${mimeType}, 长度: ${base64Data.length}`);

                        if (base64Data.length > 100) {
                            console.log("✅ 完整的 base64 图片数据");
                            return dataUri;
                        } else {
                            console.warn("⚠️  base64 数据被截断");
                        }
                    }
                }

                return dataUri;
            }
        }

        // 如果没有图片字段，检查文本内容
        if (message?.content) {
            const content = message.content.trim();
            console.log(`📝 检查文本响应内容长度: ${content.length}`);

            // 检查是否为完整的 base64 图片数据
            if (content.startsWith('data:image/')) {
                return content;
            }

            // 返回文本内容
            return content;
        }

        throw new Error('OpenRouter API 响应格式错误或内容为空');
    }
}
