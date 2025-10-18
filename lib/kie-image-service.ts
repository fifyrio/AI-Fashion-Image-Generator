import { ImageGenerationResult } from './types';
import { saveKIETaskMetadata } from './r2';

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
     * @param imageUrl 参考图片URL
     * @returns 任务ID
     */
    async createTask(prompt: string, imageUrl: string, imageRatio = '9:16'): Promise<string> {
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
                    image_urls: [imageUrl],
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
     * @returns 包含 taskId 的生成结果
     */
    async generateImageBase64(
        clothing: string,
        imageUrl: string
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('🚀 Starting KIE image generation (async)...');
            console.log(`📝 Prompt: ${clothing}`);
            console.log(`🖼️  Image URL: ${imageUrl}`);

            // 创建任务
            const taskId = await this.createTask(clothing, imageUrl);

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
