import { ImageGenerationResult } from './types';
import { saveKIETaskMetadata } from './r2';
import { IMAGE_GENERATION_BASE64_PROMPT, IMAGE_GENERATION_BASE64_TOP_ONLY_PROMPT, EXTRACT_CLOTHING_PROMPT, EXTRACT_CLOTHING_UNZIP_PROMPT, EXTRACT_CLOTHING_TOP_ONLY_PROMPT, EXTRACT_CLOTHING_WITH_MATCH_PROMPT, OUTFIT_CHANGE_V2_PROMPT } from './prompts';

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
    async createTask(
        prompt: string,
        imageUrls: string | string[],
        imageRatio: '9:16' | '1:1' = '9:16',
        model: string = 'google/nano-banana-edit'
    ): Promise<string> {
        // 统一转换为数组
        const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];

        try {
            console.log(`🔄 Creating KIE task...`);
            console.log(`📍 API URL: ${this.baseUrl}/createTask`);
            console.log(`📝 Prompt length: ${prompt.length} chars`);
            console.log(`🖼️  Image URLs: ${urls.length} image(s)`);
            urls.forEach((url, index) => {
                console.log(`   Image ${index + 1}: ${url}`);
            });
            console.log(`🤖 Model: ${model}`);
            console.log(`🔑 Token configured: ${this.apiToken ? 'Yes' : 'No'}`);
            console.log(`🔗 Callback URL: ${this.callbackUrl || 'Not configured'}`);

            const requestBody = {
                model,
                callBackUrl: this.callbackUrl,
                input: {
                    prompt: prompt,
                    image_urls: urls,
                    output_format: 'png',
                    image_size: imageRatio
                }
            };

            console.log(`📤 Request body:`, JSON.stringify(requestBody, null, 2));

            const response = await fetch(`${this.baseUrl}/createTask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ KIE API HTTP error: ${response.status} ${response.statusText}`);
                console.error(`❌ Response body: ${errorText}`);
                throw new Error(`KIE API request failed: ${response.status} ${errorText}`);
            }

            const responseText = await response.text();
            console.log(`📦 KIE API Response: ${responseText}`);

            let result: KIECreateTaskResponse;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error(`❌ Failed to parse KIE API response as JSON`);
                console.error(`❌ Response text: ${responseText}`);
                throw new Error(`KIE API returned invalid JSON: ${responseText.substring(0, 200)}`);
            }

            if (result.code !== 200) {
                console.error(`❌ KIE API error code: ${result.code}`);
                console.error(`❌ KIE API error message: ${result.message || 'No error message provided'}`);
                console.error(`❌ Full response:`, JSON.stringify(result, null, 2));
                const errorMsg = result.message || `Unknown error (code: ${result.code})`;
                throw new Error(`KIE API error: ${errorMsg}`);
            }

            console.log(`✅ KIE task created: ${result.data.taskId}`);
            return result.data.taskId;
        } catch (error) {
            // 捕获网络层面的错误（如DNS解析失败、连接超时等）
            if (error instanceof Error) {
                console.error(`❌ Network/Fetch error: ${error.message}`);
                console.error(`❌ Error name: ${error.name}`);
                console.error(`❌ Error stack: ${error.stack}`);

                // 检查是否是网络连接问题
                if (error.message === 'fetch failed' || error.name === 'FetchError') {
                    throw new Error(`Network connection failed. Please check: 1) Internet connectivity, 2) KIE API URL (${this.baseUrl}), 3) Firewall/proxy settings. Original error: ${error.message}`);
                }
            }
            throw error;
        }
    }

    /**
     * 创建仅基于文本提示词的 KIE 任务
     * @param prompt 生成提示词
     * @param imageRatio 图片长宽比
     * @param model 使用的模型
     */
    async createPromptOnlyTask(
        prompt: string,
        imageRatio: '9:16' | '1:1' = '9:16',
        model: string = 'google/nano-banana'
    ): Promise<string> {
        try {
            console.log(`🔄 Creating prompt-only KIE task...`);
            console.log(`📍 API URL: ${this.baseUrl}/createTask`);
            console.log(`📝 Prompt length: ${prompt.length} chars`);
            console.log(`🤖 Model: ${model}`);
            console.log(`🎞️  Image size: ${imageRatio}`);

            const response = await fetch(`${this.baseUrl}/createTask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify({
                    model,
                    callBackUrl: this.callbackUrl,
                    input: {
                        prompt,
                        output_format: 'png',
                        image_size: imageRatio
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ KIE prompt-only HTTP error: ${response.status} ${response.statusText}`);
                console.error(`❌ Response body: ${errorText}`);
                throw new Error(`KIE API request failed: ${response.status} ${errorText}`);
            }

            const responseText = await response.text();
            console.log(`📦 KIE prompt-only API Response: ${responseText}`);

            let result: KIECreateTaskResponse;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error(`❌ Failed to parse KIE prompt-only API response as JSON`);
                console.error(`❌ Response text: ${responseText}`);
                throw new Error(`KIE API returned invalid JSON: ${responseText.substring(0, 200)}`);
            }

            if (result.code !== 200) {
                console.error(`❌ KIE prompt-only API error code: ${result.code}`);
                console.error(`❌ KIE prompt-only API error message: ${result.message || 'No error message provided'}`);
                console.error(`❌ Full response:`, JSON.stringify(result, null, 2));
                const errorMsg = result.message || `Unknown error (code: ${result.code})`;
                throw new Error(`KIE API error: ${errorMsg}`);
            }

            console.log(`✅ KIE prompt-only task created: ${result.data.taskId}`);
            return result.data.taskId;
        } catch (error) {
            if (error instanceof Error) {
                console.error(`❌ Prompt-only task error: ${error.message}`);
                if (error.stack) {
                    console.error(error.stack);
                }
            }
            throw error;
        }
    }

    /**
     * 针对 nano-banana-pro 的专用创建任务方法
     * 该模型要求不同的参数结构
     */
    async createProTask(
        prompt: string,
        imageInputs: string | string[],
        aspectRatio: '9:16' | '1:1' = '9:16',
        resolution: '1K' | '2K' = '2K'
    ): Promise<string> {
        const urls = Array.isArray(imageInputs) ? imageInputs : [imageInputs];

        try {
            console.log(`🔄 Creating KIE PRO task...`);
            console.log(`📍 API URL: ${this.baseUrl}/createTask`);
            console.log(`📝 Prompt length: ${prompt.length} chars`);
            console.log(`🖼️  Image inputs: ${urls.length} image(s)`);
            urls.forEach((url, index) => {
                console.log(`   Image ${index + 1}: ${url}`);
            });
            console.log(`🎞️  Aspect Ratio: ${aspectRatio}`);
            console.log(`🖥️  Resolution: ${resolution}`);
            console.log(`🔑 Token configured: ${this.apiToken ? 'Yes' : 'No'}`);
            console.log(`🔗 Callback URL: ${this.callbackUrl || 'Not configured'}`);

            const requestBody = {
                model: 'nano-banana-pro',
                callBackUrl: this.callbackUrl,
                input: {
                    prompt,
                    image_input: urls,
                    aspect_ratio: aspectRatio,
                    resolution,
                    output_format: 'png'
                }
            };

            console.log(`📤 PRO Request body:`, JSON.stringify(requestBody, null, 2));

            const response = await fetch(`${this.baseUrl}/createTask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiToken}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ KIE PRO API HTTP error: ${response.status} ${response.statusText}`);
                console.error(`❌ Response body: ${errorText}`);
                throw new Error(`KIE PRO API request failed: ${response.status} ${errorText}`);
            }

            const responseText = await response.text();
            console.log(`📦 KIE PRO API Response: ${responseText}`);

            let result: KIECreateTaskResponse;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error(`❌ Failed to parse KIE PRO API response as JSON`);
                console.error(`❌ Response text: ${responseText}`);
                throw new Error(`KIE PRO API returned invalid JSON: ${responseText.substring(0, 200)}`);
            }

            if (result.code !== 200) {
                console.error(`❌ KIE PRO API error code: ${result.code}`);
                console.error(`❌ KIE PRO API error message: ${result.message || 'No error message provided'}`);
                console.error(`❌ Full response:`, JSON.stringify(result, null, 2));
                const errorMsg = result.message || `Unknown error (code: ${result.code})`;
                throw new Error(`KIE PRO API error: ${errorMsg}`);
            }

            console.log(`✅ KIE PRO task created: ${result.data.taskId}`);
            return result.data.taskId;
        } catch (error) {
            if (error instanceof Error) {
                console.error(`❌ KIE PRO error: ${error.message}`);
                if (error.stack) {
                    console.error(error.stack);
                }
            }
            throw error;
        }
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
     * @param wearingMask 是否带着白色口罩
     * @param useProModel 是否使用PRO模型
     * @returns 包含 taskId 的生成结果
     */
    async generateModelPose(
        pose: string,
        description: string,
        imageUrl: string,
        holdingPhone: boolean = false,
        wearingMask: boolean = false,
        useProModel: boolean = false
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('💃 Starting KIE model pose generation (async)...');
            console.log(`📝 Pose: ${pose}`);
            console.log(`📝 Description: ${description}`);
            console.log(`📱 Holding Phone: ${holdingPhone}`);
            console.log(`😷 Wearing Mask: ${wearingMask}`);
            console.log(`🚀 Use Pro Model: ${useProModel}`);
            console.log(`🖼️  Image URL: ${imageUrl}`);

            // 构建提示词
            let poseWithExtras = pose;
            if (holdingPhone) {
                poseWithExtras = `${poseWithExtras}，模特一只手举着手机`;
            }
            if (wearingMask) {
                poseWithExtras = `${poseWithExtras}，模特带着白色口罩`;
            }

            const prompt = `保持图片中的服装样式和背景环境完全不变（${description}），只改变模特的姿势:
姿势：${poseWithExtras}

⚠️ **最重要的核心要求 - 严格保持模特身材**：
1. **绝对不要改变模特的身材比例** - 模特的身材必须与原图完全一致：
   - ❗**臀部大小和形状绝对不能改变** - 这是最重要的要求之一：
     * 臀部的大小（臀围）必须与原图完全一致，不能变大也不能变小
     * 臀部的形状和曲线必须与原图完全一致
     * 臀部的高度和位置必须与原图完全一致
     * **特别是在生成背面姿势时，臀部的所有特征都必须100%保持原图**
     * 不要因为角度变化而"优化"或"美化"臀部
   - ❗**腿部长度绝对不能改变** - 腿的长度、上下身比例必须与原图完全一致
   - ❗**腿部粗细绝对不能改变** - 大腿粗细、小腿粗细、膝盖位置、脚踝粗细都不能有任何变化
   - ❗**腿部形状完全保留** - 腿的形状、线条、曲线必须与原图完全一致
   - ❗**身体其他部位也要保持** - 胸部大小、腰围、肩宽、手臂粗细等所有身材特征都不能改变
   - ❗**整体身材曲线完全保留** - 所有身体尺寸和比例保持不变
2. **完全保持原背景不变** - 背景环境、场景、道具、光线等完全与原图一致
3. **完全保持服装不变** - 服装款式、颜色、材质、细节与原图完全一致
4. **只改变模特姿势** - 按照姿势描述要求改变模特的动作、角度、表情
5. **保持整体协调** - 新姿势要与背景和服装风格协调自然

姿势美学要求（在不改变身材的前提下）：
1. **腿部动作要自然柔美** - 避免双腿笔直僵硬地站立：
   - ⚠️ 注意：改变姿势时，腿的粗细、长短必须与原图完全一致，只改变腿的摆放角度和姿态
   - 一条腿可以微微弯曲，呈现放松自然的状态
   - 重心可以偏向一侧，另一腿轻轻点地或交叉
   - 膝盖微屈，展现优雅的S型曲线
   - 脚踝可以有轻微角度变化，避免僵直
   - 双腿之间保持适度空间，避免完全并拢的僵硬感
2. **身体姿态流畅** - 展现专业模特的优雅气质：
   - 身体可以有轻微的侧转或倾斜
   - 肩膀放松，不要过于紧绷
   - 腰部和胯部呈现自然的曲线美
   - 整体姿态呈现柔和的流线型
3. **动作协调性** - 手部、腿部、身体动作要互相呼应，形成和谐的整体造型

❌ 绝对禁止的操作：
- ❌ 不要改变臀部的大小（不能让臀部变大或变小）
- ❌ 不要改变臀部的形状（不能改变臀部曲线和轮廓）
- ❌ **特别禁止：在生成背面姿势时改变臀部大小** - 背面图片时臀部最明显，必须严格保持原图臀部特征
- ❌ 不要改变腿的长度（不能拉长或缩短腿）
- ❌ 不要改变腿的粗细（不能让腿变细或变粗）
- ❌ 不要改变腿的形状（不能改变腿部线条和曲线）
- ❌ 不要为了"显瘦"、"显高"、"拉长比例"、"提臀"、"美化身材"而修改任何身体部位
- ❌ 不要改变其他任何身体部位的尺寸和比例

✅ 正确做法：
- ✅ 只改变姿势（身体角度、腿的摆放角度、站姿、动作），绝对不改变身材（臀部大小、腿的长短、粗细）
- ✅ 姿势适应原有身材，而不是身材适应姿势
- ✅ 保持原图模特真实的身材比例，展现真实的姿态效果
- ✅ **背面姿势时特别注意：臀部是最显眼的部位，必须100%保持原图的臀部大小和形状**

请生成一张符合上述要求的模特图片，特别注意：
1. **在展现背面姿势时，臀部的大小、形状、曲线必须与原图完全一致**
2. 在展现腿部动作自然优雅的同时，必须完全保持原图中腿部的长度、粗细和形状不变
3. 所有身材特征（臀部、腿部、腰部等）都必须与原图100%一致，只改变姿势角度`;

            // 创建任务（根据useProModel选择不同的方法）
            const taskId = useProModel
                ? await this.createProTask(prompt, imageUrl, '9:16', '2K')
                : await this.createTask(prompt, imageUrl);
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
     * @param extractTopOnly 是否只提取上装
     * @param unzipJacket 是否强制外套敞开（不拉拉链、不扣纽扣）
     * @returns 包含 taskId 的生成结果
     */
    async extractClothing(
        imageUrl: string,
        recommendMatch: boolean = false,
        extractTopOnly: boolean = false,
        unzipJacket: boolean = false
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('👔 Starting KIE clothing extraction (async)...');
            console.log(`🖼️  Image URL: ${imageUrl}`);
            console.log(`🎯 Recommend Match: ${recommendMatch}`);
            console.log(`👕 Extract Top Only: ${extractTopOnly}`);
            console.log(`🧥 Unzip Jacket: ${unzipJacket}`);

            // 根据 extractTopOnly、recommendMatch 和 unzipJacket 选择不同的 prompt
            let prompt: string;
            let promptType: string;

            if (extractTopOnly) {
                prompt = EXTRACT_CLOTHING_TOP_ONLY_PROMPT;
                promptType = 'TOP_ONLY';
            } else if (recommendMatch) {
                prompt = EXTRACT_CLOTHING_WITH_MATCH_PROMPT;
                promptType = 'WITH_MATCH';
            } else if (unzipJacket) {
                prompt = EXTRACT_CLOTHING_UNZIP_PROMPT;
                promptType = 'UNZIP';
            } else {
                prompt = EXTRACT_CLOTHING_PROMPT;
                promptType = 'STANDARD';
            }

            console.log(`📝 Using prompt: ${promptType}`);

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
     * @param adjustPose 是否微调模特动作
     * @returns 包含 taskId 的生成结果
     */
    async outfitChangeV2(
        clothingImageUrl: string,
        modelImageUrl: string,
        character: string,
        adjustPose: boolean = false,
        useProModel: boolean = false
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();

        try {
            console.log('👗 Starting outfit change V2 (async)...');
            console.log(`👔 Clothing URL: ${clothingImageUrl}`);
            console.log(`🧍 Model URL: ${modelImageUrl}`);
            console.log(`🎭 Character: ${character}`);
            console.log(`💃 Adjust Pose: ${adjustPose}`);
            console.log(`🧠 Use Pro Model: ${useProModel}`);

            // 使用换装V2的 prompt,如果开启动作微调则添加相关提示
            let prompt = OUTFIT_CHANGE_V2_PROMPT;
            if (adjustPose) {
                // 生成随机的姿势变化选项，增加多样性
                const handPoses = [
                    '右手自然下垂，左手轻轻搭在腰间',
                    '双手自然垂放在身体两侧，手指微微张开',
                    '右手插口袋，左手自然下垂',
                    '左手插口袋，右手自然下垂',
                    '双手轻轻交叉放在身前',
                    '一只手轻扶头发，另一只手自然下垂',
                    '一只手轻拉衣角，另一只手自然垂放',
                    '双手轻轻搭在大腿上',
                    '一只手叉腰，另一只手自然下垂',
                    '双手轻握在身前'
                ];

                const bodyAngles = [
                    '身体正对镜头',
                    '身体微微向右侧转15度',
                    '身体微微向左侧转15度',
                    '肩膀微微倾斜，呈现放松姿态',
                    '身体保持端正但放松的状态'
                ];

                const legPoses = [
                    '双腿自然并拢站立',
                    '左腿微微向前，右腿在后，重心在后腿',
                    '右腿微微向前，左腿在后，重心在后腿',
                    '双腿微微分开站立，重心均匀分布',
                    '一条腿微屈，另一条腿伸直站立',
                    '双腿自然交叉站立，呈现优雅姿态'
                ];

                // 使用时间戳作为随机种子，确保每次调用有不同的组合
                const timestamp = Date.now();
                const handIndex = timestamp % handPoses.length;
                const bodyIndex = Math.floor(timestamp / 1000) % bodyAngles.length;
                const legIndex = Math.floor(timestamp / 10000) % legPoses.length;

                const selectedHandPose = handPoses[handIndex];
                const selectedBodyAngle = bodyAngles[bodyIndex];
                const selectedLegPose = legPoses[legIndex];

                console.log(`🎲 Random pose selected:`);
                console.log(`  Hand: ${selectedHandPose}`);
                console.log(`  Body: ${selectedBodyAngle}`);
                console.log(`  Legs: ${selectedLegPose}`);

                prompt = prompt + `\n\n⚠️ **动作微调要求 - 必须严格执行以下姿势变化**：

**🎯 核心原则：在保持模特身材、服装、背景完全不变的前提下，改变模特的姿势和动作**

**📝 具体姿势要求（必须按照以下描述生成）：**

1. **手部动作**：${selectedHandPose}

2. **身体角度**：${selectedBodyAngle}

3. **腿部姿势**：${selectedLegPose}
   （⚠️ 注意：改变腿部姿势时，腿的长度、粗细、形状必须与第二张图完全一致，只改变腿的摆放角度和站姿，不改变腿的任何身材特征）

4. **面部表情**：自然微笑或平静表情，眼神看向镜头或略微偏向一侧

5. **面部配饰**：模特佩戴白色口罩

**✅ 必须做到：**
- 严格按照上述手部、身体、腿部的具体描述生成姿势
- 姿势要自然、优雅、符合整体风格
- 整体姿态要协调统一，不能生硬

**❌ 绝对禁止：**
- 不要保持与第二张图完全相同的姿势（必须有变化）
- 不要改变模特的任何身材特征（身高、胖瘦、腿长、腿粗细、胸围、腰围等）
- 不要改变服装的款式、尺寸、颜色、细节
- 不要改变背景环境

**🎯 目标：生成一张模特穿着第一张图服装的照片，姿势按照上述具体要求改变，但身材、服装、背景与预期完全一致。**`;
            }

            // 关键：传递两张图片的URL数组
            // 第一张：服装图片（what to wear）
            // 第二张：模特图片（who will wear）
            const taskId = useProModel
                ? await this.createProTask(
                    prompt,
                    [clothingImageUrl, modelImageUrl],
                    '9:16',
                    '2K'
                )
                : await this.createTask(
                    prompt,
                    [clothingImageUrl, modelImageUrl],
                    '9:16',
                    'google/nano-banana-edit'
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
     * 根据纯文本描述生成模特图片（异步模式）
     * @param prompt 描述提示词
     * @param options 可选配置（风格、长宽比、模型）
     */
    async generateModelFromPrompt(
        prompt: string,
        options?: {
            style?: string;
            aspectRatio?: '9:16' | '1:1';
            model?: string;
        }
    ): Promise<ImageGenerationResult & { taskId?: string }> {
        const startTime = new Date();
        const aspectRatio = options?.aspectRatio ?? '9:16';
        const model = options?.model ?? 'google/nano-banana';
        const finalPrompt = options?.style
            ? `${prompt}\n\n风格关键词：${options.style}`
            : prompt;

        try {
            console.log('🧍 Starting prompt-only model generation (async)...');
            console.log(`📝 Prompt preview: ${finalPrompt.substring(0, 80)}...`);
            console.log(`🎨 Style: ${options?.style || '默认'}`);
            console.log(`🎞️  Aspect Ratio: ${aspectRatio}`);
            console.log(`🤖 Model: ${model}`);

            const taskId = await this.createPromptOnlyTask(finalPrompt, aspectRatio, model);
            console.log(`✅ KIE prompt-only task created: ${taskId}`);

            const metadata: KIETaskMetadata = {
                taskId,
                status: 'pending',
                prompt: finalPrompt,
                imageUrl: '',
                createdAt: startTime.toISOString(),
                updatedAt: startTime.toISOString(),
            };

            await saveKIETaskMetadata(metadata);

            return {
                prompt: finalPrompt,
                imageUrl: '',
                success: true,
                timestamp: startTime,
                taskId,
                result: undefined
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ Prompt-only model generation failed: ${errorMessage}`);

            return {
                prompt: finalPrompt,
                imageUrl: '',
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
