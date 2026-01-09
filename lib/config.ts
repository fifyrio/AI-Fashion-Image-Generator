// OpenRouter API配置
export const openRouterConfig = {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    siteUrl: process.env.SITE_URL || "http://localhost:3000",
    siteName: process.env.SITE_NAME || "Fashion Analysis Tool"
};

// AI模型配置
export const AI_MODELS = {
    // GPT: "openai/gpt-4o-mini",
    GPT: "google/gemini-2.5-flash-image",
    GEMINI: "google/gemini-2.5-flash-image",
    BYTEDANCE_SEED: "bytedance-seed/seed-1.6"
};

// 支持的图片格式
export const SUPPORTED_IMAGE_FORMATS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
