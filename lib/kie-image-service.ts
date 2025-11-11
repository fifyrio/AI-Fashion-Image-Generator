import { ImageGenerationResult } from './types';
import { saveKIETaskMetadata } from './r2';
import { IMAGE_GENERATION_BASE64_PROMPT, IMAGE_GENERATION_BASE64_TOP_ONLY_PROMPT, EXTRACT_CLOTHING_PROMPT, EXTRACT_CLOTHING_WITH_MATCH_PROMPT, OUTFIT_CHANGE_V2_PROMPT } from './prompts';

// KIE API 响应类型
interface KIECreateTaskResponse {
    code: number;
    message: string;
    data: {
        taskId: string;
    };
}

// KIE 回调响应类型
export interface KIECallbackResponse {
    code: number;
    data: {
        completeTime: number;
        consumeCredits: number;
        costTime: number;
        createTime: number;
        model: string;
        param: string;
        remainedCredits: number;
        resultJson: string;
        state: 'success' | 'failed';
        taskId: string;
        updateTime: number;
    };
    msg: string;
}

// 解析后的结果
interface KIEResultJson {
    resultUrls: string[];
}

// 任务状态类型
export type KIETaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';

// 任务元数据（存储在 R2）
export interface KIETaskMetadata {
    taskId: string;
    status: KIETaskStatus;
    prompt: string;
    imageUrl: string;
    character?: string;
    clothingImageUrl?: string; // 用于 outfit-change-v2，存储服装图片URL
    createdAt: string;
    updatedAt: string;
    resultUrls?: string[];
    error?: string;
    consumeCredits?: number;
    costTime?: number;
}

// KIE 图片生成服务类
export class KIEImageService {
    private apiToken: string;
    private baseUrl: string;
    private callbackUrl: string;

    constructor() {
        // 从环境变量获取配置
        this.apiToken = process.env.KIE_API_TOKEN || '';
        this.baseUrl = 'https://api.kie.ai/api/v1/jobs';
        this.callbackUrl = process.env.KIE_CALLBACK_URL || '';

        if (!this.apiToken) {
            console.warn('⚠️  KIE_API_TOKEN not configured');
        }

        if (!this.callbackUrl) {
            console.warn('⚠️  KIE_CALLBACK_URL not configured');
        }
    }

    /**
     * 创建 KIE 图片生成任务
     * @param prompt 生成提示词
     * @param imageUrls 参考图片URL（单个或多个）
     * @returns 任务ID
     */
    async createTask(prompt: string, imageUrls: string | string[], imageRatio: '9:16' | '1:1' = '9:16'): Promise<string> {
        // 统一转换为数组
        const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];

        const response = await fetch(`${this.baseUrl}/createTask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiToken}`
            },
            body: JSON.stringify({
                model: 'google/nano-banana-edit',
                callBackUrl: this.callbackUrl,
                input: {
                    prompt: prompt,
                    image_urls: urls,
                    output_format: 'png',
                    image_size: imageRatio
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`KIE API request failed: ${response.status} ${errorText}`);
        }

        const result: KIECreateTaskResponse = await response.json();

        if (result.code !== 200) {
            throw new Error(`KIE API error: ${result.message}`);
        }

        console.log(`✅ KIE task created: ${result.data.taskId}`);
        return result.data.taskId;
    }

    /**
     * 查询任务状态
     * @param taskId 任务ID
     * @returns 任务详情
     */
    async getTaskStatus(taskId: string): Promise<KIECallbackResponse['data']> {
        const response = await fetch(`${this.baseUrl}/getTask?taskId=${taskId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.apiToken}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`KIE API request failed: ${response.status} ${errorText}`);
        }

        const result: KIECallbackResponse = await response.json();

        if (result.code !== 200) {
            throw new Error(`KIE API error: ${result.msg}`);
        }

        return result.data;
    }

    /**
     * 轮询等待任务完成
     * @param taskId 任务ID
     * @param maxAttempts 最大轮询次数（默认30次）
     * @param intervalMs 轮询间隔（默认2秒）
     * @returns 生成的图片URL
     */
    async waitForTaskCompletion(
        taskId: string,
        maxAttempts: number = 30,
        intervalMs: number = 2000
    ): Promise<string> {
        for (let i = 0; i < maxAttempts; i++) {
            const status = await this.getTaskStatus(taskId);

            if (status.state === 'success') {
                const resultJson: KIEResultJson = JSON.parse(status.resultJson);
                if (resultJson.resultUrls && resultJson.resultUrls.length > 0) {
                    console.log(`✅ KIE task completed: ${taskId}`);
                    return resultJson.resultUrls[0];
                }
                throw new Error('KIE task completed but no result URLs found');
            }

            if (status.state === 'failed') {
                throw new Error(`KIE task failed: ${taskId}`);
            }

            // 任务还在进行中，等待后重试
            console.log(`⏳ KIE task ${taskId} still processing (attempt ${i + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        throw new Error(`KIE task timeout: ${taskId} (max attempts: ${maxAttempts})`);
    }

    /**
     * 生成图片接口（异步模式）
     * 只创建任务并返回 taskId，不等待完成
     * @param clothing 服装描述/提示词
     * @param imageUrl 参考图片URL
     * @param extractTopOnly 是否只提取上装
     * @param wearMask 是否佩戴白色口罩
     * @returns 包含 taskId 的生成结果
     */
    async generateImageBase64(
        clothing: string,
        imageUrl: string,
        extractTopOnly: boolean = false,
        wearMask: boolean = false
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('🚀 Starting KIE image generation (async)...');
            console.log(`📝 Prompt: ${clothing}`);
            console.log(`🖼️  Image URL: ${imageUrl}`);
            console.log(`👕 Extract Top Only: ${extractTopOnly}`);
            console.log(`😷 Wear Mask: ${wearMask}`);

            // 根据 extractTopOnly 选择不同的 prompt
            const basePrompt = extractTopOnly
                ? IMAGE_GENERATION_BASE64_TOP_ONLY_PROMPT
                : IMAGE_GENERATION_BASE64_PROMPT;

            // 如果需要戴口罩，在服装描述后添加口罩要求
            const clothingWithMask = wearMask
                ? `${clothing}\n\n特别要求：模特佩戴白色口罩。`
                : clothing;

            const fullPrompt = `${basePrompt}${clothingWithMask}`;
            const taskId = await this.createTask(fullPrompt, imageUrl);
            console.log(`✅ prompts: ${fullPrompt}`);

            console.log(`✅ KIE task created: ${taskId}`);

            // 保存任务元数据到 R2
            const metadata: KIETaskMetadata = {
                taskId,
                status: 'pending',
                prompt: clothing,
                imageUrl,
                createdAt: startTime.toISOString(),
                updatedAt: startTime.toISOString(),
            };

            await saveKIETaskMetadata(metadata);

            // 返回 taskId，不等待完成
            return {
                prompt: clothing,
                imageUrl,
                success: true,
                timestamp: startTime,
                taskId: taskId,
                result: undefined // 异步模式下，result 通过 callback 获取
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ KIE task creation failed: ${errorMessage}`);

            return {
                prompt: clothing,
                imageUrl,
                success: false,
                error: errorMessage,
                timestamp: startTime
            };
        }
    }

    /**
     * 生成模特姿势图片（异步模式）
     * @param pose 姿势描述
     * @param description 服装和场景描述
     * @param imageUrl 原始图片URL
     * @param holdingPhone 是否一只手举着手机
     * @returns 包含 taskId 的生成结果
     */
    async generateModelPose(
        pose: string,
        description: string,
        imageUrl: string,
        holdingPhone: boolean = false
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('💃 Starting KIE model pose generation (async)...');
            console.log(`📝 Pose: ${pose}`);
            console.log(`📝 Description: ${description}`);
            console.log(`📱 Holding Phone: ${holdingPhone}`);
            console.log(`🖼️  Image URL: ${imageUrl}`);

            // 构建提示词
            let poseWithPhone = pose;
            if (holdingPhone) {
                poseWithPhone = `${pose}，模特一只手举着手机`;
            }

            const prompt = `保持图片中的服装样式不变（${description}），但是按照下面的姿势要求生成新的模特图片:
姿势：${poseWithPhone}

请生成一张符合上述姿势描述的模特图片，确保服装细节与原图一致。`;

            // 创建任务
            const taskId = await this.createTask(prompt, imageUrl);
            console.log(`✅ KIE task created: ${taskId}`);

            // 保存任务元数据到 R2
            const metadata: KIETaskMetadata = {
                taskId,
                status: 'pending',
                prompt: pose,
                imageUrl,
                createdAt: startTime.toISOString(),
                updatedAt: startTime.toISOString(),
            };

            await saveKIETaskMetadata(metadata);

            // 返回 taskId，不等待完成
            return {
                prompt: pose,
                imageUrl,
                success: true,
                timestamp: startTime,
                taskId: taskId,
                result: undefined // 异步模式下，result 通过 callback 获取
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ KIE model pose task creation failed: ${errorMessage}`);

            return {
                prompt: pose,
                imageUrl,
                success: false,
                error: errorMessage,
                timestamp: startTime
            };
        }
    }

    /**
     * 提取服装（去除模特）
     * @param imageUrl 原始图片URL
     * @param recommendMatch 是否推荐搭配的裤子或上衣
     * @returns 包含 taskId 的生成结果
     */
    async extractClothing(
        imageUrl: string,
        recommendMatch: boolean = false
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('👔 Starting KIE clothing extraction (async)...');
            console.log(`🖼️  Image URL: ${imageUrl}`);
            console.log(`🎯 Recommend Match: ${recommendMatch}`);

            // 根据 recommendMatch 选择不同的 prompt
            const prompt = recommendMatch
                ? EXTRACT_CLOTHING_WITH_MATCH_PROMPT
                : EXTRACT_CLOTHING_PROMPT;

            console.log(`📝 Using prompt: ${recommendMatch ? 'WITH_MATCH' : 'STANDARD'}`);

            // 创建任务，使用 1:1 的图片比例
            const taskId = await this.createTask(prompt, imageUrl, '1:1');
            console.log(`✅ KIE task created: ${taskId}`);

            // 保存任务元数据到 R2
            const metadata: KIETaskMetadata = {
                taskId,
                status: 'pending',
                prompt: 'Extract Clothing',
                imageUrl,
                createdAt: startTime.toISOString(),
                updatedAt: startTime.toISOString(),
            };

            await saveKIETaskMetadata(metadata);

            // 返回 taskId，不等待完成
            return {
                prompt: 'Extract Clothing',
                imageUrl,
                success: true,
                timestamp: startTime,
                taskId: taskId,
                result: undefined // 异步模式下，result 通过 callback 获取
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ KIE clothing extraction task creation failed: ${errorMessage}`);

            return {
                prompt: 'Extract Clothing',
                imageUrl,
                success: false,
                error: errorMessage,
                timestamp: startTime
            };
        }
    }

    /**
     * 模特换装V2（将提取的服装穿到指定模特身上）
     * @param clothingImageUrl 提取的服装图片URL
     * @param modelImageUrl 模特图片URL
     * @param character 模特角色
     * @returns 包含 taskId 的生成结果
     */
    async outfitChangeV2(
        clothingImageUrl: string,
        modelImageUrl: string,
        character: string
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('👗 Starting outfit change V2 (async)...');
            console.log(`👔 Clothing URL: ${clothingImageUrl}`);
            console.log(`🧍 Model URL: ${modelImageUrl}`);
            console.log(`🎭 Character: ${character}`);

            // 使用换装V2的 prompt
            const prompt = OUTFIT_CHANGE_V2_PROMPT;

            // 关键：传递两张图片的URL数组
            // 第一张：服装图片（what to wear）
            // 第二张：模特图片（who will wear）
            const taskId = await this.createTask(
                prompt,
                [clothingImageUrl, modelImageUrl],
                '9:16'
            );

            console.log(`✅ KIE task created: ${taskId}`);

            // 保存任务元数据到 R2
            const metadata: KIETaskMetadata = {
                taskId,
                status: 'pending',
                prompt: 'Outfit Change V2',
                imageUrl: modelImageUrl, // 保存模特URL作为主URL
                character,
                clothingImageUrl, // 额外保存服装URL
                createdAt: startTime.toISOString(),
                updatedAt: startTime.toISOString(),
            };

            await saveKIETaskMetadata(metadata);

            // 返回 taskId，不等待完成
            return {
                prompt: 'Outfit Change V2',
                imageUrl: modelImageUrl,
                success: true,
                timestamp: startTime,
                taskId: taskId,
                result: undefined // 异步模式下，result 通过 callback 获取
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Outfit change V2 task creation failed: ${errorMessage}`);

            return {
                prompt: 'Outfit Change V2',
                imageUrl: modelImageUrl,
                success: false,
                error: errorMessage,
                timestamp: startTime
            };
        }
    }

    /**
     * 处理 KIE 回调请求
     * 用于 API 路由处理回调
     * @param callbackData KIE 回调数据
     */
    static processCallback(callbackData: KIECallbackResponse): {
        taskId: string;
        success: boolean;
        resultUrls?: string[];
        error?: string;
    } {
        const { data } = callbackData;

        if (data.state === 'success') {
            const resultJson: KIEResultJson = JSON.parse(data.resultJson);
            return {
                taskId: data.taskId,
                success: true,
                resultUrls: resultJson.resultUrls
            };
        }

        return {
            taskId: data.taskId,
            success: false,
            error: `Task failed with state: ${data.state}`
        };
    }
}
