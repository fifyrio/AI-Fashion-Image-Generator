// 消息内容类型
export type MessageContent = {
    type: "text" | "image_url";
    text?: string;
    image_url?: { url: string };
};

// 图片分析结果
export interface ImageAnalysisResult {
    filename: string;
    modelName: string;
    analysis: string;
    timestamp: Date;
    success: boolean;
    error?: string;
}

// 图片生成结果
export interface ImageGenerationResult {
    prompt: string;
    imageUrl: string;
    success: boolean;
    timestamp: Date;
    result?: string;
    error?: string;
    savedPath?: string;
    decodedImage?: {
        mimeType: string;
        buffer: Buffer;
        size: number;
    };
}

// OpenRouter API响应
export interface OpenRouterResponse {
    choices: Array<{
        message: {
            content: string;
            images?: ImageResult[];
        };
    }>;
}

// 图片结果
export interface ImageResult {
    type: "image_url";
    image_url?: {
        url: string;
    };
}

// 上传到 R2 的参考图片信息
export interface UploadedReference {
    key: string;
    url: string;
    filename?: string;
    size?: number;
    contentType?: string;
}

// 生成任务请求
export interface GenerationRequest {
    character: string;
    uploads: UploadedReference[];
}

// 单张生成结果
export interface GeneratedImageRecord {
    imageKey: string;
    imageUrl: string;
    metadataKey: string;
    metadataUrl: string;
    createdAt: string;
    character: string;
    analysis: string;
    xiaohongshuTitle?: string;
    source: UploadedReference;
}

// 生成失败信息
export interface GenerationFailure {
    source: UploadedReference;
    error: string;
}
