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
    extractTopOnly?: boolean;
    wearMask?: boolean;
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

// 单个穿搭分析
export interface IndividualOutfitAnalysis {
    imageIndex: number;
    imageUrl?: string;
    top: {
        type: string;
        color: string;
        material: string;
        fit: string;
        designFeatures: string;
        style: string;
    };
    bottom: {
        type: string;
        color: string;
        material: string;
        fit: string;
        designFeatures: string;
    };
    colorScheme: string;
    styleTags: string[];
    summary: string;
}

// 穿搭公式
export interface OutfitFormula {
    formulaName: string;
    topPattern: string;
    bottomPattern: string;
    matchingPrinciple: string;
    styleEffect: string;
    suitableScenes: string[];
    examples: string;
}

// 共同规律
export interface CommonPatterns {
    colorPatterns: {
        frequentCombos: string[];
        coloringTechniques: string;
        colorRatios: string;
    };
    fitPatterns: {
        topBottomBalance: string;
        silhouetteRules: string;
    };
    materialPatterns: {
        contrastUsage: string;
        materialEchoes: string;
    };
    stylePatterns: {
        dominantStyle: string;
        mixingTechniques: string;
    };
    frequentItems: string[];
}

// 实用建议
export interface PracticalAdvice {
    mustHaveItems: string[];
    colorSchemeRecommendations: string[];
    commonMistakes: string[];
    advancedTips: string[];
}

// 爆款总结完整结果
export interface OutfitSummaryResult {
    overallSummary: {
        mainStyle: string;
        keyFeatures: string[];
        description: string;
    };
    individualAnalysis: IndividualOutfitAnalysis[];
    outfitFormulas: OutfitFormula[];
    commonPatterns: CommonPatterns;
    practicalAdvice: PracticalAdvice;
}
