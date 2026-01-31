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

// ========== 公式匹配器类型 ==========

// 上装分析结果（从 AI 分析中提取）
export interface TopGarmentAnalysis {
    type: string;      // 服装类型
    length: string;    // 长度
    fit: string;       // 版型
    style: string;     // 风格
    color: string;     // 颜色
    material?: string; // 材质（可选）
}

// 公式定义
export interface FormulaDefinition {
    id: string;
    name: string;

    // 上装匹配规则
    topRules: {
        types: string[];        // 服装类型关键词
        lengths: string[];      // 长度关键词
        styles: string[];       // 风格关键词
        excludeTypes?: string[]; // 排除类型
    };

    // 推荐的下装
    bottomRecommendation: {
        types: string[];        // 下装类型
        colors: string[];       // 颜色
        fits: string[];         // 版型
        materials?: string[];   // 材质（可选）
    };

    // 搭配原则
    principle: string;
    styleEffect: string;

    // 评分权重
    weights: {
        typeMatch: number;
        lengthMatch: number;
        styleMatch: number;
        colorMatch: number;
    };
}

// 公式匹配结果
export interface FormulaMatchResult {
    matchedFormula: FormulaDefinition;
    score: number;
    confidence: 'high' | 'low';
    fallback?: boolean;
}

// 下装推荐
export interface BottomRecommendation {
    type: string;
    color: string;
    fit: string;
    material?: string;
    formulaName: string;
    principle: string;
}
