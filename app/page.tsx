'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { UploadedReference } from '@/lib/types';
import type { GeneratedImageSummary } from '@/lib/pipeline';

interface CharacterOption {
  id: string;
  label: string;
  image?: string;
  isCustom?: boolean;
}

// Use a fixed version number instead of Date.now() to avoid hydration mismatch
const IMAGE_VERSION = '1';

const DEFAULT_CHARACTER_OPTIONS: CharacterOption[] = [
  { id: 'lin', label: 'Lin', image: `https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/lin/frame_1.jpg?v=${IMAGE_VERSION}`, isCustom: false },
  { id: 'Qiao', label: 'Qiao', image: `https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/Qiao/frame_1.jpg?v=${IMAGE_VERSION}`, isCustom: false },
  { id: 'qiao_mask', label: 'Qiao with Mask', image: `https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/qiao_no_mask/frame_1.jpg?v=${IMAGE_VERSION}`, isCustom: false },
  { id: 'mature_woman', label: 'Mature Woman', image: `https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/mature_woman/frame_1.jpg?v=${IMAGE_VERSION}`, isCustom: false }
];

const DEFAULT_CHARACTER_ID = DEFAULT_CHARACTER_OPTIONS[0]?.id ?? 'lin';
const MODEL_NAME_REGEX = /^[a-zA-Z0-9_]+$/;
const MAX_MODEL_FILE_SIZE = 10 * 1024 * 1024;

interface FileWithStatus {
  file: File;
  preview: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  uploadedInfo?: UploadedReference & {
    key: string;
    url: string;
    filename: string;
    size: number;
    contentType: string;
  };
  error?: string;
}

type GeneratedImage = {
  imageUrl: string;
  imageKey: string;
  metadataUrl: string;
  xiaohongshuTitle?: string;
  analysis?: string;
  createdAt: string;
  source?: UploadedReference;
  character: string;
};

type ModelGender = 'female' | 'male';

const MODEL_GENERATION_PROMPTS: Record<ModelGender, string> = {
  female: [
    // 角色
    '25岁东亚女性时尚模特，身材修长匀称，',
    // 面部细节（NanoBanana 设计蓝图）
    '细腻毛孔质感的水润透明白皙肌肤，太阳穴和颧骨处自然微微泛粉的血色，',
    '精致发丝纹理的柔和弧形眉毛，温暖棕色虹彩的大双眼皮眼睛带有玻璃般湿润光泽，',
    '上眼睑从内眼角到外眼角均匀分布的双重眼神光，睫毛根部沿线自然阴影，纤细分离的自然睫毛，',
    '柔和粉米色唇彩带有细腻唇部纹理，',
    // 发型
    '乌黑亮丽的直发半扎发型，',
    // 服装
    '白色无图案短袖圆领T恤，',
    // 姿态
    '全身站立模特姿势，自然微笑，单手轻放腰侧，',
    // 场景与光线
    '纯白色背景，柔和的摄影棚补光，均匀无阴影打光，',
    // 相机与照片风格
    '竖构图，眼平视角，高清专业时尚摄影，适合电商穿搭展示，宽高比3:4'
  ].join(''),
  male: [
    // 角色
    '28岁东亚男性时尚模特，身材挺拔，',
    // 面部细节（NanoBanana 设计蓝图）
    '健康自然的小麦色肌肤，轮廓分明的下颌线，',
    '浓密但修饰整齐的自然眉毛，深棕色虹彩的明亮双眼带有清晰眼神光，',
    '自然色唇部，唇线清晰，',
    // 发型
    '干净利落的黑色短发，',
    // 服装
    '白色无图案短袖圆领T恤，',
    // 姿态
    '全身站立模特姿势，自然微笑，双手自然下垂，',
    // 场景与光线
    '纯白色背景，柔和的摄影棚补光，均匀无阴影打光，',
    // 相机与照片风格
    '竖构图，眼平视角，高清专业时尚摄影，适合电商穿搭展示，宽高比3:4'
  ].join('')
};

const MODEL_STYLE_MAP = {
  female: ['甜酷风', 'OL风', '韩风', '人鱼风', '微胖风', '清冷高级感', '日系软萌'],
  male: ['商务绅士', '街头潮酷', '运动风', '复古绅士', '韩系男友', '高级质感', '日系清爽']
} as const;

type ModelStyle = (typeof MODEL_STYLE_MAP)[ModelGender][number];

const IMAGE_ENHANCE_MODELS = ['Low Resolution V2', 'Standard V1'] as const;
const IMAGE_ENHANCE_UPSCALE_OPTIONS = ['2x', '4x', '6x'] as const;

type ImageEnhanceModel = (typeof IMAGE_ENHANCE_MODELS)[number];
type ImageEnhanceUpscale = (typeof IMAGE_ENHANCE_UPSCALE_OPTIONS)[number];

type TabType = 'outfit-change' | 'scene-pose' | 'model-pose' | 'model-generation' | 'image-enhance' | 'image-enhance-v2' | 'image-enhance-v3' | 'outfit-change-v2' | 'mimic-reference' | 'copywriting' | 'pants-closeup' | 'anime-cover' | 'outfit-gen-auto' | 'outfit-summary';

// 预设模特姿势库 - 从真实拍摄参考图分析提取
const PRESET_POSE_CATEGORIES = [
  {
    name: '站立自拍系列',
    poses: [
      '姿势：模特正面站立，双手持手机在胸前自拍，双腿自然并拢微交叉，单肩斜挎包，面部微低看向手机屏幕 - 重点展示：上装正面完整图案和阔腿裤的自然垂坠感',
      '姿势：模特正面站立，一手叉腰，另一手持手机自拍，身体微微扭转呈轻微S型，双腿分开与肩同宽 - 重点展示：上装修身版型和腰线轮廓',
      '姿势：模特正面站立微侧身，一手插裤袋，另一手持手机，单肩背包，重心落在一条腿上，另一条腿微屈 - 重点展示：裤子口袋设计和整体休闲搭配效果',
      '姿势：模特正面站立，微微低头看手机，一手持手机另一手自然下垂持小包或配饰，双腿自然站立 - 重点展示：上装领口设计和整体色系搭配',
    ]
  },
  {
    name: '动感活力系列',
    poses: [
      '姿势：模特站立，一手高举过头伸展，身体微微侧倾，另一手持手机自拍，双腿交叉站立，充满活力感 - 重点展示：上衣的修身拉伸效果和腰部线条设计',
      '姿势：模特站立，一手提包自然下垂，一条腿向后踢起弯曲，身体微前倾，表情俏皮 - 重点展示：阔腿裤裤管的动态摆动效果和整体搭配活力感',
      '姿势：模特站立，一手拉裤腰或衬衫下摆，另一手肩上挎包，一条腿微弯抬起，身体有韵律感 - 重点展示：衣摆与裤腰的层叠设计和面料质感',
      '姿势：模特站立，一手高举手机从高角度自拍，另一手叉腰，身体微侧转，表情生动 - 重点展示：上衣正面修身效果和肩线设计',
    ]
  },
  {
    name: '蹲姿系列',
    poses: [
      '姿势：模特双膝弯曲蹲下，一手自然搭在膝盖上，另一手持手机自拍，身体微微前倾，面部微嘟嘴 - 重点展示：裤子面料的褶皱纹理和阔腿裤蹲姿下的面料堆叠效果',
      '姿势：模特半蹲姿势，一手拉肩上背包带，身体微微前倾，俯拍视角，表情可爱 - 重点展示：上装领口和肩部设计，以及背包搭配效果',
    ]
  },
  {
    name: '坐姿系列',
    poses: [
      '姿势：模特盘腿坐在地上，一手叉腰，另一手持手机仰角自拍，身体挺直，表情酷飒 - 重点展示：上装完整正面图案和裤子面料自然堆叠效果',
      '姿势：模特坐在地板上，双腿自然弯曲侧放，一手拿饮品，另一手持手机自拍，姿态慵懒 - 重点展示：上衣纽扣细节和裤子面料质感',
      '姿势：模特坐在地板上，双腿自然伸展向前，一手撑地，另一手持手机，身体微侧 - 重点展示：裤子整体版型和上装休闲穿着效果',
      '姿势：模特侧坐地板，一手扶帽子或头发，腿向一侧伸展，另一手持手机自拍，姿态优雅 - 重点展示：上衣修身版型和下装宽松裤型的对比效果',
    ]
  },
  {
    name: '叉腰展示系列',
    poses: [
      '姿势：模特正面站立，一手叉腰，身体微扭呈S型，轻微低头，另一手自然持手机，双腿微分 - 重点展示：上装贴身效果与阔腿裤的松紧对比',
      '姿势：模特站立，双手自然交叠在胸前，微微低头，表情自然，双腿并拢 - 重点展示：上衣面料贴合感和袖子设计细节',
      '姿势：模特站立，一手插牛仔裤口袋，另一手自然挎包下垂，身体重心微偏一侧，表情随性 - 重点展示：牛仔裤口袋设计和上衣下摆露腰效果',
    ]
  },
];

interface ScenePoseSuggestion {
  scene: string;
  pose: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('model-generation');
  const [filesWithStatus, setFilesWithStatus] = useState<FileWithStatus[]>([]);
  const [characterOptions, setCharacterOptions] = useState<CharacterOption[]>(DEFAULT_CHARACTER_OPTIONS);
  const [character, setCharacter] = useState<string>(DEFAULT_CHARACTER_ID);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [mockProgress, setMockProgress] = useState(0);
  const [extractTopOnly, setExtractTopOnly] = useState(false);
  const [wearMask, setWearMask] = useState(false);
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [newModelName, setNewModelName] = useState('');
  const [newModelFile, setNewModelFile] = useState<File | null>(null);
  const [newModelPreview, setNewModelPreview] = useState('');
  const [addingModel, setAddingModel] = useState(false);
  const [addModelError, setAddModelError] = useState('');
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scene-Pose tab states
  const [scenePoseFile, setScenePoseFile] = useState<File | null>(null);
  const [scenePosePreview, setScenePosePreview] = useState<string>('');
  const [scenePoseUploadedUrl, setScenePoseUploadedUrl] = useState<string>('');
  const [scenePoseAnalyzing, setScenePoseAnalyzing] = useState(false);
  const [scenePoseAnalysis, setScenePoseAnalysis] = useState<{
    description: string;
    suggestions: ScenePoseSuggestion[];
  } | null>(null);
  const [scenePoseError, setScenePoseError] = useState<string>('');
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState<number | null>(null);
  const [scenePoseGenerating, setScenePoseGenerating] = useState(false);
  const [scenePoseGeneratedImage, setScenePoseGeneratedImage] = useState<string | null>(null);

  // Model-Pose tab states
  const [modelPoseFile, setModelPoseFile] = useState<File | null>(null);
  const [modelPosePreview, setModelPosePreview] = useState<string>('');
  const [downloadDirPrefix, setDownloadDirPrefix] = useState<string>('模特姿势');
  const [showDownloadSettings, setShowDownloadSettings] = useState(false);
  const [modelPoseUploadedUrl, setModelPoseUploadedUrl] = useState<string>('');
  const [modelPoseAnalyzing, setModelPoseAnalyzing] = useState(false);
  const [modelPoseAnalysis, setModelPoseAnalysis] = useState<{
    description: string;
    poses: string[];
  } | null>(null);
  const [modelPoseError, setModelPoseError] = useState<string>('');
  const [selectedPoseIndices, setSelectedPoseIndices] = useState<number[]>([]);
  const [modelPoseGenerating, setModelPoseGenerating] = useState(false);
  const [modelPoseDragging, setModelPoseDragging] = useState(false);
  const [modelPoseGeneratedImages, setModelPoseGeneratedImages] = useState<Array<{poseIndex: number, pose: string, imageUrl: string, enhancedUrl?: string, status: 'generating' | 'completed' | 'enhancing' | 'enhanced' | 'failed', error?: string}>>([]);
  const [modelHoldingPhone, setModelHoldingPhone] = useState(false);
  const [modelWearingMask, setModelWearingMask] = useState(false);
  const [modelPoseUseProModel, setModelPoseUseProModel] = useState(false);
  const [modelPoseAutoEnhance, setModelPoseAutoEnhance] = useState(true);
  const [showPresetPoses, setShowPresetPoses] = useState(false);

  // Outfit-Change-V2 tab states - 批量处理
  const [outfitV2OriginalFiles, setOutfitV2OriginalFiles] = useState<File[]>([]);
  const [outfitV2OriginalPreviews, setOutfitV2OriginalPreviews] = useState<string[]>([]);
  const [outfitV2OriginalUrls, setOutfitV2OriginalUrls] = useState<string[]>([]);

  // 批量提取的服装（对应每张原图）
  const [outfitV2ExtractedImages, setOutfitV2ExtractedImages] = useState<{
    [index: number]: { url: string; status: 'extracting' | 'completed' | 'failed'; error?: string };
  }>({});

  // 选中的服装索引（用于换装）
  const [outfitV2SelectedClothing, setOutfitV2SelectedClothing] = useState<Set<number>>(new Set());

  // 服装描述（对应每张提取的服装）
  const [outfitV2ClothingDescriptions, setOutfitV2ClothingDescriptions] = useState<{
    [index: number]: string;
  }>({});

  const [outfitV2ExtractingClothing, setOutfitV2ExtractingClothing] = useState(false);
  const [outfitV2ExtractProgress, setOutfitV2ExtractProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  // 批量换装结果（对应每个服装）
  const [outfitV2SelectedCharacters, setOutfitV2SelectedCharacters] = useState<string[]>([]);
  const [outfitV2GeneratedImages, setOutfitV2GeneratedImages] = useState<{
    [index: number]: {
      url: string;
      enhancedUrl?: string;
      status: 'generating' | 'completed' | 'enhancing' | 'enhanced' | 'failed';
      error?: string;
    };
  }>({});

  const [outfitV2Generating, setOutfitV2Generating] = useState(false);
  const [outfitV2GenerateProgress, setOutfitV2GenerateProgress] = useState<{
    completed: number;
    total: number;
  } | null>(null);

  const [outfitV2Error, setOutfitV2Error] = useState<string>('');
  const [outfitV2IsDragging, setOutfitV2IsDragging] = useState(false);
  const [outfitV2RecommendMatch, setOutfitV2RecommendMatch] = useState(false);
  const [outfitV2RecommendShirt, setOutfitV2RecommendShirt] = useState(false);
  const [outfitV2ExtractTopOnly, setOutfitV2ExtractTopOnly] = useState(false);
  const [outfitV2UnzipJacket, setOutfitV2UnzipJacket] = useState(false);
  const [outfitV2AdjustPose, setOutfitV2AdjustPose] = useState(false);
  const [outfitV2UseProModel, setOutfitV2UseProModel] = useState(false);
  const [outfitV2WearingMask, setOutfitV2WearingMask] = useState(true);
  const [outfitV2AutoEnhance, setOutfitV2AutoEnhance] = useState(true);

  // 当前阶段
  type OutfitV2Stage = 'upload' | 'extracting' | 'extracted' | 'generating' | 'completed';
  const [outfitV2Stage, setOutfitV2Stage] = useState<OutfitV2Stage>('upload');

  // Mimic-Reference tab states
  const [mimicRefFile, setMimicRefFile] = useState<File | null>(null);
  const [mimicRefPreview, setMimicRefPreview] = useState<string>('');
  const [mimicRefUploadedUrl, setMimicRefUploadedUrl] = useState<string>('');
  const [mimicRefAnalyzing, setMimicRefAnalyzing] = useState(false);
  const [mimicRefAnalysis, setMimicRefAnalysis] = useState<{
    sceneDescription: string;
  } | null>(null);
  const [mimicRefError, setMimicRefError] = useState<string>('');
  const [mimicRefIsDragging, setMimicRefIsDragging] = useState(false);
  const [mimicRefCharacter, setMimicRefCharacter] = useState<string>(DEFAULT_CHARACTER_ID);
  const [mimicRefGenerating, setMimicRefGenerating] = useState(false);
  const [mimicRefGeneratedImage, setMimicRefGeneratedImage] = useState<string | null>(null);

  // Copywriting tab states
  const [copywritingInput, setCopywritingInput] = useState<string>('');
  const [copywritingTargetAudience, setCopywritingTargetAudience] = useState<'male' | 'female'>('female');
  const [copywritingGenerating, setCopywritingGenerating] = useState(false);
  const [copywritingResults, setCopywritingResults] = useState<Array<{
    analysis: string;
    copywriting: string[];
  }> | null>(null);
  const [copywritingError, setCopywritingError] = useState<string>('');

  // Pants Closeup tab states (简化版)
  const [pantsCloseupFile, setPantsCloseupFile] = useState<File | null>(null);
  const [pantsCloseupPreview, setPantsCloseupPreview] = useState<string>('');
  const [pantsCloseupUploadedUrl, setPantsCloseupUploadedUrl] = useState<string>('');
  const [pantsCloseupAngle, setPantsCloseupAngle] = useState<'sitting' | 'overhead'>('sitting'); // 新增：角度选择
  const [pantsCloseupGenerating, setPantsCloseupGenerating] = useState(false);
  const [pantsCloseupGeneratedImage, setPantsCloseupGeneratedImage] = useState<string | null>(null);
  const [pantsCloseupError, setPantsCloseupError] = useState<string>('');
  const [pantsCloseupIsDragging, setPantsCloseupIsDragging] = useState(false);

  // Anime Cover tab states
  const [animeCoverFile, setAnimeCoverFile] = useState<File | null>(null);
  const [animeCoverPreview, setAnimeCoverPreview] = useState<string>('');
  const [animeCoverUploadedUrl, setAnimeCoverUploadedUrl] = useState<string>('');
  const [animeCoverTitle, setAnimeCoverTitle] = useState<string>('');
  const [animeCoverGenerating, setAnimeCoverGenerating] = useState(false);
  const [animeCoverGeneratedImage, setAnimeCoverGeneratedImage] = useState<string | null>(null);
  const [animeCoverError, setAnimeCoverError] = useState<string>('');
  const [animeCoverIsDragging, setAnimeCoverIsDragging] = useState(false);

  // Model generation tab states
  const [modelGenerationGender, setModelGenerationGender] = useState<ModelGender>('female');
  const [modelGenerationPrompt, setModelGenerationPrompt] = useState(MODEL_GENERATION_PROMPTS.female);
  const [modelGenerationStyle, setModelGenerationStyle] = useState<ModelStyle>(MODEL_STYLE_MAP.female[0]);
  const [modelGenerationGenerating, setModelGenerationGenerating] = useState(false);
  const [modelGenerationStatus, setModelGenerationStatus] = useState('');
  const [modelGenerationTaskId, setModelGenerationTaskId] = useState<string | null>(null);
  const [modelGenerationImageUrl, setModelGenerationImageUrl] = useState<string | null>(null);
  const [imageEnhanceUrl, setImageEnhanceUrl] = useState('');
  const [imageEnhancePreview, setImageEnhancePreview] = useState('');
  const [imageEnhanceModel, setImageEnhanceModel] = useState<ImageEnhanceModel>(IMAGE_ENHANCE_MODELS[0]);
  const [imageEnhanceUpscale, setImageEnhanceUpscale] = useState<ImageEnhanceUpscale>('2x');
  const [imageEnhanceFaceEnhancement, setImageEnhanceFaceEnhancement] = useState(true);
  const [imageEnhanceFaceStrength, setImageEnhanceFaceStrength] = useState(0.8);
  const [imageEnhanceFaceCreativity, setImageEnhanceFaceCreativity] = useState(0.5);
  const [imageEnhanceGenerating, setImageEnhanceGenerating] = useState(false);
  const [imageEnhanceUploading, setImageEnhanceUploading] = useState(false);
  const [imageEnhanceError, setImageEnhanceError] = useState('');
  const [imageEnhanceStatus, setImageEnhanceStatus] = useState('');
  const [imageEnhanceResultUrl, setImageEnhanceResultUrl] = useState<string | null>(null);
  const imageEnhanceFileInputRef = useRef<HTMLInputElement | null>(null);

  // 批量增强相关状态
  const [batchEnhanceImages, setBatchEnhanceImages] = useState<Array<{
    file: File;
    preview: string;
    uploadedUrl?: string;
    enhancedUrl?: string;
    status: 'pending' | 'uploading' | 'uploaded' | 'enhancing' | 'enhanced' | 'error';
    error?: string;
  }>>([]);
  const [batchEnhanceMode, setBatchEnhanceMode] = useState(false);
  const batchEnhanceFileInputRef = useRef<HTMLInputElement | null>(null);

  // Image Enhance V2 states (using local Python service)
  const [enhanceV2Files, setEnhanceV2Files] = useState<File[]>([]);
  const [enhanceV2Previews, setEnhanceV2Previews] = useState<string[]>([]);
  const [enhanceV2Results, setEnhanceV2Results] = useState<Array<{
    originalUrl: string;
    enhancedUrl?: string;
    status: 'pending' | 'enhancing' | 'enhanced' | 'error';
    error?: string;
  }>>([]);
  const [enhanceV2Processing, setEnhanceV2Processing] = useState(false);
  const [enhanceV2Error, setEnhanceV2Error] = useState('');
  const [enhanceV2SkipEsrgan, setEnhanceV2SkipEsrgan] = useState(false);
  const enhanceV2FileInputRef = useRef<HTMLInputElement | null>(null);

  // Image Enhance V3 states (using ilovepdf API)
  const [enhanceV3Files, setEnhanceV3Files] = useState<File[]>([]);
  const [enhanceV3Previews, setEnhanceV3Previews] = useState<string[]>([]);
  const [enhanceV3Results, setEnhanceV3Results] = useState<Array<{
    originalUrl: string;
    enhancedUrl?: string;
    status: 'pending' | 'enhancing' | 'enhanced' | 'error';
    error?: string;
  }>>([]);
  const [enhanceV3Processing, setEnhanceV3Processing] = useState(false);
  const [enhanceV3Error, setEnhanceV3Error] = useState('');
  const [enhanceV3Multiplier, setEnhanceV3Multiplier] = useState<2 | 4>(2);
  const [isDraggingEnhanceV3, setIsDraggingEnhanceV3] = useState(false);
  const enhanceV3FileInputRef = useRef<HTMLInputElement | null>(null);

  // ==================== Outfit Generation Auto ====================
  // File uploads
  const [outfitGenAutoFile, setOutfitGenAutoFile] = useState<File | null>(null);
  const [outfitGenAutoPreview, setOutfitGenAutoPreview] = useState<string>('');
  const [outfitGenAutoUrl, setOutfitGenAutoUrl] = useState<string>('');

  // Step results
  const [outfitGenAutoRemovedBgUrl, setOutfitGenAutoRemovedBgUrl] = useState<string>('');
  const [outfitGenAutoDescription, setOutfitGenAutoDescription] = useState<string>('');
  const [outfitGenAutoFinalUrl, setOutfitGenAutoFinalUrl] = useState<string>('');
  const [outfitGenAutoFinalTaskId, setOutfitGenAutoFinalTaskId] = useState<string>('');

  // Workflow state
  const [outfitGenAutoCurrentStep, setOutfitGenAutoCurrentStep] = useState<1 | 2 | 3 | 'idle'>('idle');
  const [outfitGenAutoGenerating, setOutfitGenAutoGenerating] = useState(false);
  const [outfitGenAutoError, setOutfitGenAutoError] = useState<string>('');
  const [outfitGenAutoDragging, setOutfitGenAutoDragging] = useState(false);
  const [outfitGenAutoSelectedCharacter, setOutfitGenAutoSelectedCharacter] = useState<string>('asian-girl-1');

  // Step status tracking
  const [outfitGenAutoStepStatus, setOutfitGenAutoStepStatus] = useState<{
    step1: 'idle' | 'processing' | 'completed' | 'failed';
    step2: 'idle' | 'processing' | 'completed' | 'failed';
    step3: 'idle' | 'processing' | 'completed' | 'failed';
  }>({ step1: 'idle', step2: 'idle', step3: 'idle' });

  // Smart matching toggle and results
  const [outfitGenAutoSmartMatchEnabled, setOutfitGenAutoSmartMatchEnabled] = useState<boolean>(false);
  const [outfitGenAutoMatchingSuggestions, setOutfitGenAutoMatchingSuggestions] = useState<string>('');

  // Image enhancement toggle and status
  const [outfitGenAutoEnhanceEnabled, setOutfitGenAutoEnhanceEnabled] = useState<boolean>(false);
  const [outfitGenAutoEnhancing, setOutfitGenAutoEnhancing] = useState<boolean>(false);
  const [outfitGenAutoEnhancedUrl, setOutfitGenAutoEnhancedUrl] = useState<string>('');

  // Outfit Summary tab states
  const [outfitSummaryFiles, setOutfitSummaryFiles] = useState<File[]>([]);
  const [outfitSummaryPreviews, setOutfitSummaryPreviews] = useState<string[]>([]);
  const [outfitSummaryUploadedUrls, setOutfitSummaryUploadedUrls] = useState<string[]>([]);
  const [outfitSummaryAnalyzing, setOutfitSummaryAnalyzing] = useState(false);
  const [outfitSummaryResult, setOutfitSummaryResult] = useState<import('@/lib/types').OutfitSummaryResult | null>(null);
  const [outfitSummaryError, setOutfitSummaryError] = useState('');
  const [isDraggingOutfitSummary, setIsDraggingOutfitSummary] = useState(false);
  const outfitSummaryFileInputRef = useRef<HTMLInputElement | null>(null);

  const clearMockProgressTimers = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }
  };

  const startMockProgress = () => {
    clearMockProgressTimers();
    setMockProgress(5);
    progressIntervalRef.current = setInterval(() => {
      setMockProgress(prev => {
        if (prev >= 90) {
          return prev;
        }
        const increment = Math.random() * 10 + 5;
        return Math.min(prev + increment, 90);
      });
    }, 600);
  };

  const completeMockProgress = () => {
    clearMockProgressTimers();
    setMockProgress(100);
    progressTimeoutRef.current = setTimeout(() => {
      setMockProgress(0);
      progressTimeoutRef.current = null;
    }, 800);
  };

  const resetMockProgress = () => {
    clearMockProgressTimers();
    setMockProgress(0);
  };

  const resetAddModelForm = () => {
    setNewModelName('');
    setNewModelFile(null);
    setNewModelPreview('');
    setAddModelError('');
  };

  const handleOpenAddModelModal = () => {
    setAddModelError('');
    setShowAddModelModal(true);
  };

  const handleCloseAddModelModal = () => {
    resetAddModelForm();
    setShowAddModelModal(false);
  };

  const handleNewModelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddModelError('');
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      setNewModelFile(null);
      setNewModelPreview('');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setAddModelError('请上传图片文件');
      setNewModelFile(null);
      setNewModelPreview('');
      return;
    }

    if (file.size > MAX_MODEL_FILE_SIZE) {
      setAddModelError('图片大小不能超过 10MB');
      setNewModelFile(null);
      setNewModelPreview('');
      return;
    }

    setNewModelFile(file);
    setNewModelPreview(URL.createObjectURL(file));
  };

  const saveCustomModel = (model: CharacterOption) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem('customModels');
      const parsed: CharacterOption[] = saved ? JSON.parse(saved) : [];
      const filtered = parsed.filter(item => item.id !== model.id);
      filtered.push({ ...model, isCustom: true });
      window.localStorage.setItem('customModels', JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to persist custom model:', error);
    }
  };

  const removeCustomModel = (modelId: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem('customModels');
      if (!saved) {
        return;
      }
      const parsed: CharacterOption[] = JSON.parse(saved);
      const filtered = parsed.filter(item => item.id !== modelId);
      window.localStorage.setItem('customModels', JSON.stringify(filtered));
    } catch (error) {
      console.error('Failed to remove custom model:', error);
    }
  };

  const handleAddModel = async () => {
    const trimmedName = newModelName.trim();

    if (!trimmedName || !newModelFile) {
      setAddModelError('请填写所有字段');
      return;
    }

    if (!MODEL_NAME_REGEX.test(trimmedName)) {
      setAddModelError('模特名字只能包含字母、数字和下划线');
      return;
    }

    if (newModelFile.size > MAX_MODEL_FILE_SIZE) {
      setAddModelError('图片大小不能超过 10MB');
      return;
    }

    if (characterOptions.some(option => option.id === trimmedName)) {
      setAddModelError('该模特已经存在');
      return;
    }

    setAddingModel(true);
    setAddModelError('');

    try {
      const formData = new FormData();
      formData.append('modelName', trimmedName);
      formData.append('modelImage', newModelFile);

      const response = await fetch('/api/add-model', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '上传失败');
      }

      const newModel: CharacterOption = {
        ...data.model,
        isCustom: true,
      };

      setCharacterOptions(prev => {
        const exists = prev.some(option => option.id === newModel.id);
        if (exists) {
          return prev.map(option => (option.id === newModel.id ? newModel : option));
        }
        return [...prev, newModel];
      });

      setCharacter(newModel.id);
      setOutfitV2SelectedCharacters([newModel.id]); // 添加新模特时默认选中它
      saveCustomModel(newModel);
      setShowAddModelModal(false);
      resetAddModelForm();

      if (typeof window !== 'undefined') {
        window.alert('模特添加成功！');
      }
    } catch (error) {
      setAddModelError(error instanceof Error ? error.message : '上传失败');
    } finally {
      setAddingModel(false);
    }
  };

  const handleDeleteModel = async (modelId: string, label: string) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`确定要删除模特「${label}」吗？`);
      if (!confirmed) {
        return;
      }
    }

    setDeletingModelId(modelId);

    try {
      const response = await fetch('/api/delete-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ modelName: modelId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '删除失败');
      }

      setCharacterOptions(prev => {
        const filtered = prev.filter(option => option.id !== modelId);
        const fallbackId = filtered[0]?.id ?? DEFAULT_CHARACTER_ID;
        const hasCharacter = filtered.some(option => option.id === character);

        if (!hasCharacter) {
          setCharacter(fallbackId);
        }

        // 清理多选列表中已删除的模特
        setOutfitV2SelectedCharacters(prev =>
          prev.filter(id => filtered.some(option => option.id === id))
        );

        // 如果多选列表为空，设置fallback
        if (outfitV2SelectedCharacters.length === 0 || !outfitV2SelectedCharacters.some(id => filtered.some(option => option.id === id))) {
          // 不自动设置，让用户手动选择
        }

        return filtered;
      });

      removeCustomModel(modelId);
      if (typeof window !== 'undefined') {
        window.alert('模特已删除');
      }
    } catch (error) {
      if (typeof window !== 'undefined') {
        window.alert(error instanceof Error ? error.message : '删除失败');
      }
    } finally {
      setDeletingModelId(null);
    }
  };

  // Auto-upload when files are selected
  const uploadFile = async (fileWithStatus: FileWithStatus, index: number) => {
    // Update status to uploading
    setFilesWithStatus(prev => prev.map((f, i) =>
      i === index ? { ...f, status: 'uploading' as const, progress: 0 } : f
    ));

    try {
      const formData = new FormData();
      formData.append('files', fileWithStatus.file);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setFilesWithStatus(prev => prev.map((f, i) =>
            i === index ? { ...f, progress: percentComplete } : f
          ));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          if (data.uploaded && data.uploaded.length > 0) {
            setFilesWithStatus(prev => prev.map((f, i) =>
              i === index ? {
                ...f,
                status: 'uploaded' as const,
                progress: 100,
                uploadedInfo: data.uploaded[0]
              } : f
            ));
          }
        } else {
          setFilesWithStatus(prev => prev.map((f, i) =>
            i === index ? {
              ...f,
              status: 'error' as const,
              error: 'Upload failed'
            } : f
          ));
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        setFilesWithStatus(prev => prev.map((f, i) =>
          i === index ? {
            ...f,
            status: 'error' as const,
            error: 'Network error'
          } : f
        ));
      });

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (error) {
      setFilesWithStatus(prev => prev.map((f, i) =>
        i === index ? {
          ...f,
          status: 'error' as const,
          error: String(error)
        } : f
      ));
    }
  };

  const processFiles = async (files: FileList | null) => {
    if (files && files.length > 0) {
      const filesArray = Array.from(files);
      const newFiles: FileWithStatus[] = [];

      // Read all files and create preview URLs
      for (const file of filesArray) {
        try {
          const preview = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          newFiles.push({
            file,
            preview,
            status: 'pending',
            progress: 0,
          });
        } catch (error) {
          console.error('Error reading file:', error);
        }
      }

      // Add to state
      setFilesWithStatus(prev => [...prev, ...newFiles]);

      // Auto-upload each file
      const startIndex = filesWithStatus.length;
      newFiles.forEach((fileWithStatus, i) => {
        uploadFile(fileWithStatus, startIndex + i);
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    processFiles(files);
  };

  // 画质增强V3 拖拽处理函数
  const handleEnhanceV3DragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnhanceV3(true);
  };

  const handleEnhanceV3DragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnhanceV3(false);
  };

  const handleEnhanceV3DragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleEnhanceV3Drop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnhanceV3(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      setEnhanceV3Files(imageFiles);
      const previews = imageFiles.map(file => URL.createObjectURL(file));
      setEnhanceV3Previews(previews);
      setEnhanceV3Results(imageFiles.map(() => ({ originalUrl: '', status: 'pending' as const })));
    }
  };

  const removeFile = (index: number) => {
    setFilesWithStatus(prev => prev.filter((_, i) => i !== index));
  };

  const clearAllFiles = () => {
    setFilesWithStatus([]);
    setGenerateStatus('');
    setGeneratedImages([]);
  };

  const fetchGeneratedImages = async () => {
    try {
      const response = await fetch('/api/results');
      const data = await response.json();

      if (response.ok && Array.isArray(data.images)) {
        const mapped: GeneratedImage[] = data.images.map((item: GeneratedImageSummary) => ({
          imageUrl: item.path,
          imageKey: item.name,
          metadataUrl: item.metadataUrl ?? '',
          xiaohongshuTitle: item.xiaohongshuTitle,
          analysis: item.analysis,
          createdAt: new Date(item.timestamp).toISOString(),
          source: item.source,
          character: item.character ?? '',
        }));

        setGeneratedImages(mapped.slice(0, 10));
      }
    } catch (error) {
      console.error('Error fetching generated images:', error);
    }
  };

  useEffect(() => {
    fetchGeneratedImages();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const saved = window.localStorage.getItem('customModels');
      if (!saved) {
        return;
      }

      const parsed: CharacterOption[] = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        return;
      }

      setCharacterOptions(prev => {
        const existingIds = new Set(prev.map(model => model.id));
        const normalized = parsed
          .filter(model => model?.id)
          .map(model => ({
            ...model,
            isCustom: true,
          }));
        const additions = normalized.filter(model => !existingIds.has(model.id));
        return additions.length ? [...prev, ...additions] : prev;
      });
    } catch (error) {
      console.error('Failed to load custom models:', error);
    }
  }, []);

  useEffect(() => {
    if (!newModelPreview) {
      return;
    }

    return () => {
      URL.revokeObjectURL(newModelPreview);
    };
  }, [newModelPreview]);

  useEffect(() => {
    return () => {
      clearMockProgressTimers();
    };
  }, []);

  const handleGenerate = async () => {
    const uploadedFiles = filesWithStatus.filter(f => f.status === 'uploaded' && f.uploadedInfo);

    if (uploadedFiles.length === 0) {
      setGenerateStatus('Please wait for images to finish uploading to R2 first.');
      return;
    }

    setGenerating(true);
    setGenerateStatus('Generating images... This may take a while.');
    setGeneratedImages([]);
    startMockProgress();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character,
          uploads: uploadedFiles.map(f => f.uploadedInfo),
          extractTopOnly,
          wearMask,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const { generated: newImages = [], errors = [] } = data as {
          generated?: GeneratedImage[];
          errors?: Array<{ error: string }>;
        };

        setGeneratedImages(newImages);

        const successCount = newImages.length;
        const errorCount = errors?.length ?? 0;
        const lines: string[] = [
          `Generation finished for ${character}.`,
          `✅ Success: ${successCount}`,
        ];

        if (errorCount > 0) {
          lines.push(`⚠️ Failed: ${errorCount}`);
        }

        setGenerateStatus(lines.join('\n'));
        completeMockProgress();
      } else {
        setGenerateStatus(`Generation failed: ${data.error ?? 'Unknown error'}`);
        resetMockProgress();
      }
    } catch (error) {
      setGenerateStatus(`Generation error: ${error}`);
      resetMockProgress();
    } finally {
      setGenerating(false);
    }
  };

  const uploadedCount = filesWithStatus.filter(f => f.status === 'uploaded').length;
  const uploadingCount = filesWithStatus.filter(f => f.status === 'uploading').length;

  // Scene-Pose tab handlers
  const handleScenePoseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScenePoseFile(file);
    setScenePoseError('');
    setScenePoseAnalysis(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setScenePosePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleScenePoseAnalyze = async () => {
    if (!scenePoseFile) {
      setScenePoseError('请先上传图片');
      return;
    }

    setScenePoseAnalyzing(true);
    setScenePoseError('');

    try {
      // Upload to R2 first
      const formData = new FormData();
      formData.append('files', scenePoseFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('上传图片失败');
      }

      const uploadData = await uploadResponse.json();
      const uploadedUrl = uploadData.uploaded[0].url;
      setScenePoseUploadedUrl(uploadedUrl);

      // Analyze the image
      const analyzeResponse = await fetch('/api/analyze-scene-pose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl: uploadedUrl }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || '分析失败');
      }

      const result = await analyzeResponse.json();
      setScenePoseAnalysis(result);
      setSelectedSuggestionIndex(null);
      setScenePoseGeneratedImage(null);
    } catch (error) {
      setScenePoseError(error instanceof Error ? error.message : '分析失败');
    } finally {
      setScenePoseAnalyzing(false);
    }
  };

  const clearScenePose = () => {
    setScenePoseFile(null);
    setScenePosePreview('');
    setScenePoseUploadedUrl('');
    setScenePoseAnalysis(null);
    setScenePoseError('');
    setSelectedSuggestionIndex(null);
    setScenePoseGeneratedImage(null);
  };

  const handleScenePoseGenerate = async () => {
    if (selectedSuggestionIndex === null || !scenePoseAnalysis) {
      setScenePoseError('请先选择一个场景+姿势建议');
      return;
    }

    if (!scenePoseUploadedUrl) {
      setScenePoseError('图片未上传');
      return;
    }

    setScenePoseGenerating(true);
    setScenePoseError('');
    setScenePoseGeneratedImage(null);

    try {
      const selectedSuggestion = scenePoseAnalysis.suggestions[selectedSuggestionIndex];

      const response = await fetch('/api/generate-scene-pose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalImageUrl: scenePoseUploadedUrl,
          scene: selectedSuggestion.scene,
          pose: selectedSuggestion.pose,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '生成失败');
      }

      const result = await response.json();
      setScenePoseGeneratedImage(result.imageUrl);
    } catch (error) {
      setScenePoseError(error instanceof Error ? error.message : '生成失败');
    } finally {
      setScenePoseGenerating(false);
    }
  };

  // Model-Pose tab handlers
  const handleModelPoseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setModelPoseFile(file);
    setModelPoseError('');
    setModelPoseAnalysis(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setModelPosePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleModelPoseDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setModelPoseDragging(true);
  };

  const handleModelPoseDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setModelPoseDragging(false);
  };

  const handleModelPoseDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setModelPoseDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check if it's an image
      if (!file.type.startsWith('image/')) {
        setModelPoseError('请上传图片文件');
        return;
      }

      setModelPoseFile(file);
      setModelPoseError('');
      setModelPoseAnalysis(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setModelPosePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModelPoseAnalyze = async () => {
    if (!modelPoseFile) {
      setModelPoseError('请先选择一张图片');
      return;
    }

    setModelPoseAnalyzing(true);
    setModelPoseError('');

    try {
      // Upload to R2 first
      const formData = new FormData();
      formData.append('files', modelPoseFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('图片上传失败');
      }

      const uploadData = await uploadResponse.json();
      const uploadedUrl = uploadData.uploaded[0].url;
      setModelPoseUploadedUrl(uploadedUrl);

      // Analyze the image
      const analyzeResponse = await fetch('/api/generate-pose-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: uploadedUrl,
          wearingMask: modelWearingMask
        }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.error || 'AI 分析失败');
      }

      const result = await analyzeResponse.json();
      setModelPoseAnalysis(result);
    } catch (error) {
      setModelPoseError(error instanceof Error ? error.message : 'AI 分析失败');
    } finally {
      setModelPoseAnalyzing(false);
    }
  };

  const clearModelPose = () => {
    setModelPoseFile(null);
    setModelPosePreview('');
    setModelPoseUploadedUrl('');
    setModelPoseAnalysis(null);
    setModelPoseError('');
    setSelectedPoseIndices([]);
    setModelPoseGeneratedImages([]);
  };

  // 添加预设姿势到当前姿势列表
  const addPresetPoses = (poses: string[]) => {
    setModelPoseAnalysis(prev => {
      if (prev) {
        // 追加到已有列表，去重
        const existingPoses = new Set(prev.poses);
        const newPoses = poses.filter(p => !existingPoses.has(p));
        return {
          ...prev,
          poses: [...prev.poses, ...newPoses],
        };
      } else {
        // 没有AI分析结果时，直接创建
        return {
          description: '使用预设姿势库',
          poses: [...poses],
        };
      }
    });
    setShowPresetPoses(false);
  };

  // 添加单个预设姿势
  const addSinglePresetPose = (pose: string) => {
    setModelPoseAnalysis(prev => {
      if (prev) {
        if (prev.poses.includes(pose)) return prev;
        return {
          ...prev,
          poses: [...prev.poses, pose],
        };
      } else {
        return {
          description: '使用预设姿势库',
          poses: [pose],
        };
      }
    });
  };

  // 添加整个分类的预设姿势
  const addPresetCategory = (categoryIndex: number) => {
    addPresetPoses(PRESET_POSE_CATEGORIES[categoryIndex].poses);
  };

  // 添加全部预设姿势
  const addAllPresetPoses = () => {
    const allPoses = PRESET_POSE_CATEGORIES.flatMap(c => c.poses);
    addPresetPoses(allPoses);
  };

  // 切换姿势选择状态
  const togglePoseSelection = (index: number) => {
    setSelectedPoseIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (!modelPoseAnalysis) return;

    if (selectedPoseIndices.length === modelPoseAnalysis.poses.length) {
      setSelectedPoseIndices([]);
    } else {
      setSelectedPoseIndices(modelPoseAnalysis.poses.map((_, index) => index));
    }
  };

  const handleModelPoseGenerate = async () => {
    if (selectedPoseIndices.length === 0 || !modelPoseAnalysis) {
      setModelPoseError('请先选择至少一个姿势');
      return;
    }

    // 如果使用预设姿势库但图片尚未上传，先上传图片
    let uploadedUrl = modelPoseUploadedUrl;
    if (!uploadedUrl) {
      if (!modelPoseFile) {
        setModelPoseError('请先上传一张服装图片');
        return;
      }
      try {
        const formData = new FormData();
        formData.append('files', modelPoseFile);
        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!uploadResponse.ok) throw new Error('图片上传失败');
        const uploadData = await uploadResponse.json();
        uploadedUrl = uploadData.uploaded[0].url;
        setModelPoseUploadedUrl(uploadedUrl);
      } catch (error) {
        setModelPoseError('图片上传失败，请重试');
        return;
      }
    }

    setModelPoseGenerating(true);
    setModelPoseError('');

    // 初始化生成结果数组
    const initialResults = selectedPoseIndices.map(index => ({
      poseIndex: index,
      pose: modelPoseAnalysis.poses[index],
      imageUrl: '',
      status: 'generating' as const,
    }));
    setModelPoseGeneratedImages(initialResults);

    try {
      // 为每个选中的姿势创建任务
      const tasks = selectedPoseIndices.map(async (poseIndex) => {
        const selectedPose = modelPoseAnalysis.poses[poseIndex];

        try {
          // 创建 KIE 任务
          const createResponse = await fetch('/api/generate-model-pose-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              originalImageUrl: uploadedUrl,
              pose: selectedPose,
              description: modelPoseAnalysis.description,
              holdingPhone: modelHoldingPhone,
              wearingMask: modelWearingMask,
              useProModel: modelPoseUseProModel,
            }),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || 'Task creation failed');
          }

          const { taskId } = await createResponse.json();
          console.log(`Task created for pose ${poseIndex}:`, taskId);

          // 轮询任务状态（PRO 模型需要更长时间）
          const maxAttempts = modelPoseUseProModel ? 120 : 40; // PRO 模型最长等待约10分钟，普通模型约3.3分钟
          const pollInterval = 5000; // 5秒轮询一次，减少服务器压力

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const statusResponse = await fetch(`/api/task-status?taskId=${taskId}`);

            if (!statusResponse.ok) {
              console.warn('Failed to fetch task status, retrying...');
              continue;
            }

            const statusData = await statusResponse.json();
            console.log(`Task status for pose ${poseIndex} (attempt ${attempt + 1}):`, statusData.status);

            if (statusData.status === 'completed' && statusData.resultUrls?.[0]) {
              // 更新该姿势的生成结果
              setModelPoseGeneratedImages(prev =>
                prev.map(item =>
                  item.poseIndex === poseIndex
                    ? { ...item, imageUrl: statusData.resultUrls[0], status: 'completed' as const }
                    : item
                )
              );
              console.log(`✅ Image generation completed for pose ${poseIndex}`);
              return { poseIndex, success: true, imageUrl: statusData.resultUrls[0] };
            }

            if (statusData.status === 'failed') {
              throw new Error('Image generation failed');
            }
          }

          throw new Error('Image generation timeout');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Generation failed';
          console.error(`❌ Error generating pose ${poseIndex}:`, errorMessage);

          // 更新该姿势的失败状态
          setModelPoseGeneratedImages(prev =>
            prev.map(item =>
              item.poseIndex === poseIndex
                ? { ...item, status: 'failed' as const, error: errorMessage }
                : item
            )
          );
          return { poseIndex, success: false, error: errorMessage };
        }
      });

      // 等待所有任务完成
      const results = await Promise.all(tasks);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount > 0) {
        setModelPoseError(`批量生成完成：${successCount} 个成功，${failCount} 个失败`);
      }

      console.log('✅ Batch generation completed:', { successCount, failCount });

      // 如果开启了自动增强，对成功生成的图片进行增强
      if (modelPoseAutoEnhance && successCount > 0) {
        console.log('🔄 Starting auto-enhancement for generated images...');
        setModelPoseError(`批量生成完成，正在自动增强 ${successCount} 张图片...`);

        const successResults = results.filter(r => r.success && r.imageUrl);

        // 先将所有成功的图片状态更新为增强中
        setModelPoseGeneratedImages(prev =>
          prev.map(item => {
            const isInSuccessResults = successResults.some(r => r.poseIndex === item.poseIndex);
            return isInSuccessResults
              ? { ...item, status: 'enhancing' as const }
              : item;
          })
        );

        try {
          // 使用 iLoveIMG API 批量增强图片
          const enhanceResponse = await fetch('/api/enhance-ilovepdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              images: successResults.map(r => ({ imageUrl: r.imageUrl })),
              multiplier: 2 // 默认使用2x增强
            })
          });

          if (!enhanceResponse.ok) {
            const errorData = await enhanceResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Batch enhancement failed');
          }

          const enhanceData = await enhanceResponse.json();

          // 根据返回结果更新每个图片的状态
          if (enhanceData.results && Array.isArray(enhanceData.results)) {
            enhanceData.results.forEach((result: { success: boolean; originalUrl: string; enhancedUrl?: string; error?: string }, index: number) => {
              const originalResult = successResults[index];
              if (!originalResult) return;

              setModelPoseGeneratedImages(prev =>
                prev.map(item => {
                  if (item.poseIndex === originalResult.poseIndex) {
                    if (result.success && result.enhancedUrl) {
                      console.log(`✅ Enhancement completed for pose ${originalResult.poseIndex}`);
                      return { ...item, enhancedUrl: result.enhancedUrl, status: 'enhanced' as const };
                    } else {
                      console.error(`❌ Enhancement failed for pose ${originalResult.poseIndex}:`, result.error);
                      return { ...item, status: 'completed' as const };
                    }
                  }
                  return item;
                })
              );
            });

            const enhanceSuccessCount = enhanceData.summary?.success || 0;
            const enhanceFailCount = enhanceData.summary?.failed || 0;

            if (enhanceFailCount > 0) {
              setModelPoseError(
                `批量生成完成：${successCount} 个成功，${failCount} 个失败。` +
                `自动增强：${enhanceSuccessCount} 个成功，${enhanceFailCount} 个失败`
              );
            } else {
              setModelPoseError(`批量生成和增强完成：${enhanceSuccessCount} 张图片已自动增强`);
            }

            console.log('✅ Auto-enhancement completed:', { enhanceSuccessCount, enhanceFailCount });
          } else {
            throw new Error('Invalid enhancement response format');
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Enhancement failed';
          console.error('❌ Batch enhancement failed:', errorMessage);

          // 增强失败，将所有图片状态恢复为completed
          setModelPoseGeneratedImages(prev =>
            prev.map(item => {
              const isInSuccessResults = successResults.some(r => r.poseIndex === item.poseIndex);
              return isInSuccessResults && item.status === 'enhancing'
                ? { ...item, status: 'completed' as const }
                : item;
            })
          );

          setModelPoseError(
            `批量生成完成：${successCount} 个成功，${failCount} 个失败。` +
            `自动增强失败：${errorMessage}`
          );
        }
      }
    } catch (error) {
      setModelPoseError(error instanceof Error ? error.message : 'Batch generation failed');
    } finally {
      setModelPoseGenerating(false);
    }
  };

  // Outfit-Change-V2 tab handlers - 批量处理
  const processOutfitV2Files = async (files: File[]) => {
    setOutfitV2OriginalFiles(files);
    setOutfitV2Error('');
    setOutfitV2ExtractedImages({});
    setOutfitV2GeneratedImages({});
    setOutfitV2OriginalUrls([]);
    setOutfitV2Stage('upload');

    // Create previews for all files
    const previewPromises = files.map((file) => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      });
    });

    const previews = await Promise.all(previewPromises);
    setOutfitV2OriginalPreviews(previews);
  };

  const handleOutfitV2FileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    processOutfitV2Files(fileArray);
  };

  const handleOutfitV2DragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOutfitV2IsDragging(true);
  };

  const handleOutfitV2DragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOutfitV2IsDragging(false);
  };

  const handleOutfitV2DragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleOutfitV2Drop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setOutfitV2IsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (fileArray.length > 0) {
        processOutfitV2Files(fileArray);
      } else {
        setOutfitV2Error('请上传图片文件（JPEG、PNG、GIF）');
      }
    }
  };

  // 通用轮询函数
  const pollTaskStatus = async (taskId: string, maxAttempts = 40): Promise<string> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5秒轮询一次

      const statusResponse = await fetch(`/api/task-status?taskId=${taskId}`);

      if (!statusResponse.ok) {
        console.warn('Failed to fetch task status, retrying...');
        continue;
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'completed' && statusData.resultUrls?.[0]) {
        return statusData.resultUrls[0];
      }

      if (statusData.status === 'failed') {
        throw new Error(`任务失败: ${taskId}`);
      }
    }

    throw new Error(`任务超时: ${taskId}`);
  };

  // 批量提取服装（并行处理）
  const handleOutfitV2ExtractClothing = async () => {
    if (outfitV2OriginalFiles.length === 0) {
      setOutfitV2Error('请先上传图片');
      return;
    }

    setOutfitV2ExtractingClothing(true);
    setOutfitV2Error('');
    setOutfitV2ExtractedImages({});
    setOutfitV2Stage('extracting');

    try {
      // Step 1: 上传所有图片到R2
      const formData = new FormData();
      outfitV2OriginalFiles.forEach(file => {
        formData.append('files', file);
      });

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('图片上传失败');
      }

      const uploadData = await uploadResponse.json();
      const uploadedUrls = uploadData.uploaded.map((item: { url: string }) => item.url);
      setOutfitV2OriginalUrls(uploadedUrls);

      // Step 2: 并行创建所有提取任务
      console.log(`🚀 Creating ${uploadedUrls.length} extraction tasks in parallel...`);

      const createTaskPromises = uploadedUrls.map(async (url: string, index: number) => {
        // 标记为提取中
        setOutfitV2ExtractedImages(prev => ({
          ...prev,
          [index]: { url: '', status: 'extracting' }
        }));

        const extractResponse = await fetch('/api/extract-clothing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: url,
            recommendMatch: outfitV2RecommendMatch,
            recommendShirt: outfitV2RecommendShirt,
            extractTopOnly: outfitV2ExtractTopOnly,
            unzipJacket: outfitV2UnzipJacket
          }),
        });

        if (!extractResponse.ok) {
          throw new Error(`图片 ${index + 1} 提取任务创建失败`);
        }

        const { taskId } = await extractResponse.json();
        console.log(`✅ Task ${index + 1} created: ${taskId}`);
        return { index, taskId };
      });

      const tasks = await Promise.all(createTaskPromises);

      // Step 3: 并行轮询所有任务
      setOutfitV2ExtractProgress({ completed: 0, total: tasks.length });

      const pollPromises = tasks.map(async ({ index, taskId }) => {
        try {
          const extractedUrl = await pollTaskStatus(taskId);

          // 更新状态为完成
          setOutfitV2ExtractedImages(prev => ({
            ...prev,
            [index]: { url: extractedUrl, status: 'completed' }
          }));

          // 更新进度
          setOutfitV2ExtractProgress(prev =>
            prev ? { ...prev, completed: prev.completed + 1 } : null
          );

          console.log(`✅ Extraction ${index + 1} completed`);
          return { index, success: true, extractedUrl };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '提取失败';

          // 更新状态为失败
          setOutfitV2ExtractedImages(prev => ({
            ...prev,
            [index]: { url: '', status: 'failed', error: errorMessage }
          }));

          // 更新进度
          setOutfitV2ExtractProgress(prev =>
            prev ? { ...prev, completed: prev.completed + 1 } : null
          );

          console.error(`❌ Extraction ${index + 1} failed:`, errorMessage);
          return { index, success: false, error: errorMessage };
        }
      });

      const results = await Promise.all(pollPromises);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      console.log('✅ Batch extraction completed:', { successCount, failCount });

      // Step 4: 并行分析所有成功提取的服装
      if (successCount > 0) {
        console.log('🔍 开始分析提取的服装...');
        const analyzePromises = results
          .filter(r => r.success && r.extractedUrl)
          .map(async (r) => {
            try {
              const response = await fetch('/api/analyze-clothing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageUrl: r.extractedUrl,
                  extractTopOnly: outfitV2ExtractTopOnly
                })
              });

              if (!response.ok) {
                throw new Error('分析失败');
              }

              const data = await response.json();
              console.log(`✅ 服装 ${r.index + 1} 分析完成`);
              return { index: r.index, description: data.analysis || '' };
            } catch (error) {
              console.error(`❌ 分析服装 ${r.index + 1} 失败:`, error);
              return { index: r.index, description: '' };
            }
          });

        const descriptions = await Promise.all(analyzePromises);
        const descriptionsMap: { [key: number]: string } = {};
        descriptions.forEach(d => {
          descriptionsMap[d.index] = d.description;
        });
        setOutfitV2ClothingDescriptions(descriptionsMap);
        console.log('✅ 服装分析全部完成');
      }

      setOutfitV2Stage('extracted');
      setOutfitV2ExtractProgress(null);

      // 自动选中所有成功提取的服装
      const successIndexes = results
        .filter(r => r.success)
        .map(r => r.index);
      setOutfitV2SelectedClothing(new Set(successIndexes));

      if (failCount > 0) {
        setOutfitV2Error(`批量提取完成：${successCount} 个成功，${failCount} 个失败`);
      }
    } catch (error) {
      setOutfitV2Error(error instanceof Error ? error.message : '批量提取失败');
      setOutfitV2Stage('upload');
    } finally {
      setOutfitV2ExtractingClothing(false);
    }
  };

  // 切换服装选择状态
  const toggleOutfitV2ClothingSelection = (index: number) => {
    setOutfitV2SelectedClothing(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // 全选/全不选服装
  const toggleOutfitV2SelectAllClothing = () => {
    const completedIndexes = Object.entries(outfitV2ExtractedImages)
      .filter(([_, data]) => data.status === 'completed')
      .map(([index, _]) => parseInt(index, 10));

    if (outfitV2SelectedClothing.size === completedIndexes.length) {
      // 当前全选，则全不选
      setOutfitV2SelectedClothing(new Set());
    } else {
      // 否则全选
      setOutfitV2SelectedClothing(new Set(completedIndexes));
    }
  };

  // 实时增强单张换装图片
  const enhanceOutfitV2Image = async (index: number, imageUrl: string) => {
    console.log(`🔄 Starting enhancement for outfit #${index + 1}: ${imageUrl}`);

    // 更新状态为增强中
    setOutfitV2GeneratedImages(prev => ({
      ...prev,
      [index]: { ...prev[index], status: 'enhancing' }
    }));

    try {
      const enhanceResponse = await fetch('/api/enhance-ilovepdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [{ imageUrl }],
          multiplier: 2
        })
      });

      if (!enhanceResponse.ok) {
        const errorData = await enhanceResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Enhancement failed');
      }

      const enhanceData = await enhanceResponse.json();

      if (enhanceData.results?.[0]?.success && enhanceData.results[0].enhancedUrl) {
        // 增强成功
        const enhancedUrl = enhanceData.results[0].enhancedUrl;
        console.log(`✅ Enhancement completed for outfit #${index + 1}: ${enhancedUrl}`);

        setOutfitV2GeneratedImages(prev => ({
          ...prev,
          [index]: {
            ...prev[index],
            enhancedUrl,
            status: 'enhanced'
          }
        }));
      } else {
        throw new Error(enhanceData.results?.[0]?.error || 'Enhancement failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Enhancement failed';
      console.error(`❌ Enhancement failed for outfit #${index + 1}:`, errorMessage);

      // 增强失败，恢复为completed状态（保留原图）
      setOutfitV2GeneratedImages(prev => ({
        ...prev,
        [index]: {
          ...prev[index],
          status: 'completed'
        }
      }));
    }
  };

  const handleOutfitV2Generate = async () => {
    // 检查是否有选中的服装
    const selectedClothingIndexes = Array.from(outfitV2SelectedClothing);
    const selectedClothing = selectedClothingIndexes
      .map(index => [index.toString(), outfitV2ExtractedImages[index]] as [string, typeof outfitV2ExtractedImages[number]])
      .filter(([_, data]) => data && data.status === 'completed');

    if (selectedClothing.length === 0) {
      setOutfitV2Error('请先选择要换装的服装');
      return;
    }

    if (outfitV2SelectedCharacters.length === 0) {
      setOutfitV2Error('请先选择至少一个模特');
      return;
    }

    setOutfitV2Generating(true);
    setOutfitV2Error('');

    // 初始化生成进度（只针对选中的服装）
    setOutfitV2GenerateProgress({ total: selectedClothing.length, completed: 0 });

    // 初始化所有选中的服装项为 generating 状态
    const initialGeneratedImages = selectedClothing.reduce((acc, [indexStr, _]) => {
      const index = parseInt(indexStr, 10);
      acc[index] = { url: '', status: 'generating' };
      return acc;
    }, {} as typeof outfitV2GeneratedImages);
    setOutfitV2GeneratedImages(initialGeneratedImages);

    try {
      console.log(`开始批量换装，共 ${selectedClothing.length} 张服装图片`);

      // 第一步：并行创建所有任务（快速完成，每个 <5 秒）
      const createTaskPromises = selectedClothing.map(async ([indexStr, data]) => {
        const index = parseInt(indexStr, 10);
        try {
          const createResponse = await fetch('/api/outfit-change-v2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clothingImageUrl: data.url,
              character: outfitV2SelectedCharacters[0], // 使用第一个选中的模特
              adjustPose: outfitV2AdjustPose, // 模特动作微调
              useProModel: outfitV2UseProModel,
              wearingMask: outfitV2WearingMask, // 模特佩戴白色口罩
            }),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || '任务创建失败');
          }

          const { taskId } = await createResponse.json();
          console.log(`✅ 服装 #${index + 1} 任务创建成功: ${taskId}`);
          return { index, taskId, success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '任务创建失败';
          console.error(`❌ 服装 #${index + 1} 任务创建失败:`, errorMessage);

          // 立即标记为失败
          setOutfitV2GeneratedImages(prev => ({
            ...prev,
            [index]: { url: '', status: 'failed', error: errorMessage }
          }));

          return { index, taskId: '', success: false, error: errorMessage };
        }
      });

      const taskResults = await Promise.all(createTaskPromises);
      const successfulTasks = taskResults.filter(t => t.success);
      console.log(`任务创建完成: ${successfulTasks.length}/${selectedClothing.length} 个成功`);

      if (successfulTasks.length === 0) {
        throw new Error('所有任务创建失败');
      }

      // 第二步：并行轮询所有成功创建的任务
      const pollPromises = successfulTasks.map(async ({ index, taskId }) => {
        try {
          const maxAttempts = outfitV2UseProModel ? 180 : 60; // PRO 模型最长等待约6分钟
          const generatedUrl = await pollTaskStatus(taskId, maxAttempts);

          // 更新成功状态
          setOutfitV2GeneratedImages(prev => ({
            ...prev,
            [index]: { url: generatedUrl, status: 'completed' }
          }));

          // 更新进度
          setOutfitV2GenerateProgress(prev => ({
            total: prev?.total || 0,
            completed: (prev?.completed || 0) + 1
          }));

          console.log(`✅ 服装 #${index + 1} 换装完成`);

          // 如果开启了自动增强，立即触发增强
          if (outfitV2AutoEnhance) {
            enhanceOutfitV2Image(index, generatedUrl).catch(err => {
              console.error(`Enhancement error for outfit #${index + 1}:`, err);
            });
          }

          return { index, success: true, url: generatedUrl };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '换装失败';
          console.error(`❌ 服装 #${index + 1} 换装失败:`, errorMessage);

          // 更新失败状态
          setOutfitV2GeneratedImages(prev => ({
            ...prev,
            [index]: { url: '', status: 'failed', error: errorMessage }
          }));

          // 即使失败也更新进度
          setOutfitV2GenerateProgress(prev => ({
            total: prev?.total || 0,
            completed: (prev?.completed || 0) + 1
          }));

          return { index, success: false, error: errorMessage };
        }
      });

      const pollResults = await Promise.all(pollPromises);
      const finalSuccessCount = pollResults.filter(r => r.success).length;
      const finalFailCount = pollResults.filter(r => !r.success).length;

      if (finalFailCount > 0) {
        setOutfitV2Error(`批量换装完成：${finalSuccessCount} 个成功，${finalFailCount} 个失败`);
      }

      console.log('✅ 批量换装全部完成:', { successCount: finalSuccessCount, failCount: finalFailCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '批量换装失败';
      setOutfitV2Error(errorMessage);
      console.error('❌ 批量换装错误:', errorMessage);
    } finally {
      setOutfitV2Generating(false);
    }
  };

  // 切换模特选择状态
  const toggleOutfitV2CharacterSelection = (characterId: string) => {
    setOutfitV2SelectedCharacters(prev => {
      if (prev.includes(characterId)) {
        return prev.filter(id => id !== characterId);
      } else {
        return [...prev, characterId];
      }
    });
  };

  // 全选/取消全选模特
  const toggleOutfitV2SelectAll = () => {
    if (outfitV2SelectedCharacters.length === characterOptions.length) {
      setOutfitV2SelectedCharacters([]);
    } else {
      setOutfitV2SelectedCharacters(characterOptions.map(c => c.id));
    }
  };

  const clearOutfitV2 = () => {
    setOutfitV2OriginalFiles([]);
    setOutfitV2OriginalPreviews([]);
    setOutfitV2ExtractedImages({});
    setOutfitV2ClothingDescriptions({});
    setOutfitV2GeneratedImages({});
    setOutfitV2SelectedCharacters([]);
    setOutfitV2SelectedClothing(new Set());
    setOutfitV2ExtractProgress({ total: 0, completed: 0 });
    setOutfitV2GenerateProgress({ total: 0, completed: 0 });
    setOutfitV2Error('');
    setOutfitV2Stage('upload');
  };

  // Mimic Reference handlers
  const handleMimicRefFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await processMimicRefFile(files[0]);
    }
  };

  const handleMimicRefDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setMimicRefIsDragging(true);
  };

  const handleMimicRefDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setMimicRefIsDragging(false);
  };

  const handleMimicRefDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  const handleMimicRefDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setMimicRefIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      processMimicRefFile(files[0]);
    }
  };

  const processMimicRefFile = async (file: File) => {
    const preview = URL.createObjectURL(file);
    setMimicRefFile(file);
    setMimicRefPreview(preview);
    setMimicRefAnalysis(null);
    setMimicRefError('');

    // Upload to R2
    try {
      const formData = new FormData();
      formData.append('files', file);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('File upload failed');
      }

      const uploadData = await uploadResponse.json();
      if (uploadData.uploaded && uploadData.uploaded[0]) {
        setMimicRefUploadedUrl(uploadData.uploaded[0].url);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMimicRefError('图片上传失败，请重试');
    }
  };

  const handleMimicRefAnalyze = async () => {
    if (!mimicRefUploadedUrl) {
      setMimicRefError('请先上传图片');
      return;
    }

    setMimicRefAnalyzing(true);
    setMimicRefError('');
    setMimicRefAnalysis(null);

    try {
      const response = await fetch('/api/analyze-mimic-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: mimicRefUploadedUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      setMimicRefAnalysis(data);
    } catch (error) {
      console.error('Analysis error:', error);
      setMimicRefError(error instanceof Error ? error.message : '分析失败，请重试');
    } finally {
      setMimicRefAnalyzing(false);
    }
  };

  const clearMimicRef = () => {
    setMimicRefFile(null);
    setMimicRefPreview('');
    setMimicRefUploadedUrl('');
    setMimicRefAnalysis(null);
    setMimicRefError('');
    setMimicRefGeneratedImage(null);
  };

  const handleMimicRefGenerate = async () => {
    if (!mimicRefAnalysis) {
      setMimicRefError('请先分析参考图片');
      return;
    }

    setMimicRefGenerating(true);
    setMimicRefError('');
    setMimicRefGeneratedImage(null);

    try {
      // Only use scene description as the prompt
      const prompt = mimicRefAnalysis.sceneDescription;

      // Call the generation API
      const createResponse = await fetch('/api/generate-mimic-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          character: mimicRefCharacter,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Task creation failed');
      }

      const { taskId } = await createResponse.json();
      console.log('Mimic reference generation task created:', taskId);

      // Poll for task status
      const maxAttempts = 40; // 最长等待约3.3分钟
      const pollInterval = 5000; // 5秒轮询一次，减少服务器压力

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const statusResponse = await fetch(`/api/task-status?taskId=${taskId}`);

        if (!statusResponse.ok) {
          console.warn('Failed to fetch task status, retrying...');
          continue;
        }

        const statusData = await statusResponse.json();
        console.log(`Task status (attempt ${attempt + 1}):`, statusData.status);

        if (statusData.status === 'completed' && statusData.resultUrls?.[0]) {
          setMimicRefGeneratedImage(statusData.resultUrls[0]);
          console.log('Generation completed:', statusData.resultUrls[0]);
          break;
        } else if (statusData.status === 'failed') {
          throw new Error('Generation task failed');
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      setMimicRefError(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setMimicRefGenerating(false);
    }
  };

  // Copywriting handlers
  const handleCopywritingGenerate = async () => {
    if (!copywritingInput.trim()) {
      setCopywritingError('请输入文案内容');
      return;
    }

    setCopywritingGenerating(true);
    setCopywritingError('');
    setCopywritingResults(null);

    try {
      const response = await fetch('/api/generate-similar-copywriting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCopy: copywritingInput,
          targetAudience: copywritingTargetAudience
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成失败');
      }

      const data = await response.json();
      setCopywritingResults([{
        analysis: data.analysis,
        copywriting: data.similarCopywriting
      }]);
    } catch (error) {
      console.error('生成文案失败:', error);
      setCopywritingError(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setCopywritingGenerating(false);
    }
  };

  // Pants Closeup handlers
  // Anime Cover tab event handlers
  const handleAnimeCoverFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAnimeCoverFile(file);
      setAnimeCoverPreview(URL.createObjectURL(file));
      setAnimeCoverError('');
      setAnimeCoverGeneratedImage(null);
    }
  };

  const handleAnimeCoverDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setAnimeCoverIsDragging(true);
  };

  const handleAnimeCoverDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setAnimeCoverIsDragging(false);
  };

  const handleAnimeCoverDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setAnimeCoverIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setAnimeCoverFile(file);
      setAnimeCoverPreview(URL.createObjectURL(file));
      setAnimeCoverError('');
      setAnimeCoverGeneratedImage(null);
    }
  };

  const handleAnimeCoverGenerate = async () => {
    if (!animeCoverFile) {
      setAnimeCoverError('请先上传图片');
      return;
    }

    if (!animeCoverTitle.trim()) {
      setAnimeCoverError('请输入封面标题');
      return;
    }

    setAnimeCoverGenerating(true);
    setAnimeCoverError('');

    try {
      // 1. 上传图片到 R2
      let imageUrl = animeCoverUploadedUrl;
      if (!imageUrl) {
        const formData = new FormData();
        formData.append('files', animeCoverFile);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('上传图片失败');
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.uploaded || uploadData.uploaded.length === 0) {
          throw new Error('上传失败，未返回图片URL');
        }
        imageUrl = uploadData.uploaded[0].url;
        setAnimeCoverUploadedUrl(imageUrl);
        console.log('[anime-cover] Uploaded URL:', imageUrl);
      }

      // 2. 创建生成任务
      const response = await fetch('/api/generate-anime-cover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          title: animeCoverTitle.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成失败');
      }

      const data = await response.json();
      if (!data.taskId) {
        throw new Error('任务创建失败，请稍后重试');
      }

      console.log('Anime cover task created:', data.taskId);

      // 3. 轮询任务状态
      const maxAttempts = 40;
      const pollInterval = 5000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const statusResponse = await fetch(`/api/task-status?taskId=${data.taskId}`);

        if (!statusResponse.ok) {
          console.warn('Failed to fetch task status, retrying...');
          continue;
        }

        const statusData = await statusResponse.json();
        console.log(`Anime cover task status (attempt ${attempt + 1}):`, statusData.status);

        if (statusData.status === 'completed' && statusData.resultUrls?.[0]) {
          setAnimeCoverGeneratedImage(statusData.resultUrls[0]);
          console.log('✅ Anime cover generation completed:', statusData.resultUrls[0]);
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('生成任务失败');
        }
      }

      throw new Error('生成超时，请稍后重试');
    } catch (error) {
      console.error('生成动漫封面失败:', error);
      setAnimeCoverError(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setAnimeCoverGenerating(false);
    }
  };

  const handlePantsCloseupFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPantsCloseupFile(file);
      setPantsCloseupPreview(URL.createObjectURL(file));
      setPantsCloseupError('');
      setPantsCloseupGeneratedImage(null);
    }
  };

  const handlePantsCloseupDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setPantsCloseupIsDragging(true);
  };

  const handlePantsCloseupDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setPantsCloseupIsDragging(false);
  };

  const handlePantsCloseupDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setPantsCloseupIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setPantsCloseupFile(file);
      setPantsCloseupPreview(URL.createObjectURL(file));
      setPantsCloseupError('');
      setPantsCloseupGeneratedImage(null);
    }
  };

  // 简化后的生成函数：上传 + 直接生成
  const handlePantsCloseupGenerate = async () => {
    if (!pantsCloseupFile) {
      setPantsCloseupError('请先上传图片');
      return;
    }

    setPantsCloseupGenerating(true);
    setPantsCloseupError('');

    try {
      // 1. 上传图片到 R2（如果还没上传）
      let imageUrl = pantsCloseupUploadedUrl;
      if (!imageUrl) {
        const formData = new FormData();
        formData.append('files', pantsCloseupFile);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('上传图片失败');
        }

        const uploadData = await uploadResponse.json();
        if (!uploadData.uploaded || uploadData.uploaded.length === 0) {
          throw new Error('上传失败，未返回图片URL');
        }
        imageUrl = uploadData.uploaded[0].url;
        setPantsCloseupUploadedUrl(imageUrl);
        console.log('[pants-closeup] Uploaded URL:', imageUrl);
      }

      // 2. 直接创建生成任务（不需要分析步骤）
      const response = await fetch('/api/generate-pants-closeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrl,
          angle: pantsCloseupAngle, // 传递角度选择
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '生成失败');
      }

      const data = await response.json();
      if (!data.taskId) {
        throw new Error('任务创建失败，请稍后重试');
      }

      console.log('Task created:', data.taskId);

      // 3. 轮询任务状态
      const maxAttempts = 40;
      const pollInterval = 5000;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));

        const statusResponse = await fetch(`/api/task-status?taskId=${data.taskId}`);

        if (!statusResponse.ok) {
          console.warn('Failed to fetch task status, retrying...');
          continue;
        }

        const statusData = await statusResponse.json();
        console.log(`Task status (attempt ${attempt + 1}):`, statusData.status);

        if (statusData.status === 'completed' && statusData.resultUrls?.[0]) {
          setPantsCloseupGeneratedImage(statusData.resultUrls[0]);
          console.log('✅ Generation completed:', statusData.resultUrls[0]);
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('生成任务失败');
        }
      }

      throw new Error('生成超时，请稍后重试');
    } catch (error) {
      console.error('生成裤子特写失败:', error);
      setPantsCloseupError(error instanceof Error ? error.message : '生成失败，请重试');
    } finally {
      setPantsCloseupGenerating(false);
    }
  };

  const handleModelGenerationGenderChange = (gender: ModelGender) => {
    if (gender === modelGenerationGender) {
      return;
    }
    setModelGenerationGender(gender);
    setModelGenerationPrompt(MODEL_GENERATION_PROMPTS[gender]);
    setModelGenerationStyle(MODEL_STYLE_MAP[gender][0]);
  };

  const handleModelGeneration = async () => {
    const trimmedPrompt = modelGenerationPrompt.trim();

    if (!trimmedPrompt) {
      setModelGenerationStatus('请输入模特描述');
      return;
    }

    setModelGenerationGenerating(true);
    setModelGenerationImageUrl(null);
    setModelGenerationTaskId(null);
    setModelGenerationStatus(`正在提交 ${modelGenerationStyle} 风格模特生成任务，请稍候...`);

    try {
      const response = await fetch('/api/generate-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          style: modelGenerationStyle,
          gender: modelGenerationGender,
          aspectRatio: '9:16'
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || '生成失败');
      }

      const data = await response.json();
      if (!data.taskId) {
        throw new Error('任务创建失败，请稍后重试');
      }

      setModelGenerationTaskId(data.taskId);
      setModelGenerationStatus(`任务已创建（ID: ${data.taskId}），正在生成模特图片...`);

      const maxAttempts = 60;
      const imageUrl = await pollTaskStatus(data.taskId, maxAttempts);
      setModelGenerationImageUrl(imageUrl);
      setModelGenerationStatus('模特生成完成，可下载或保存图片。');
    } catch (error) {
      console.error('模特生成失败:', error);
      setModelGenerationStatus(error instanceof Error ? error.message : '生成失败，请稍后重试');
    } finally {
      setModelGenerationGenerating(false);
    }
  };

  const handleImageEnhanceUploadClick = () => {
    imageEnhanceFileInputRef.current?.click();
  };

  const handleImageEnhanceFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImageEnhanceUploading(true);
    setImageEnhanceError('');
    setImageEnhanceStatus('');
    setImageEnhanceResultUrl(null);

    try {
      const previewReader = new FileReader();
      previewReader.onloadend = () => {
        setImageEnhancePreview(previewReader.result as string);
      };
      previewReader.readAsDataURL(file);

      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || '上传失败');
      }

      const data = await response.json();
      const uploaded = data.uploaded?.[0];
      if (!uploaded?.url) {
        throw new Error('上传失败，请稍后重试');
      }

      setImageEnhanceUrl(uploaded.url);
      setImageEnhanceStatus('图片上传成功，可开始画质增强。');
    } catch (error) {
      console.error('图片上传失败:', error);
      setImageEnhanceError(error instanceof Error ? error.message : '上传失败，请稍后重试');
    } finally {
      setImageEnhanceUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleImageEnhanceGenerate = async () => {
    if (!imageEnhanceUrl) {
      setImageEnhanceError('请先上传或输入图片地址');
      return;
    }

    setImageEnhanceGenerating(true);
    setImageEnhanceError('');
    setImageEnhanceResultUrl(null);
    setImageEnhanceStatus('正在增强图像，请稍候...');

    try {
      const response = await fetch('/api/enhance-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageEnhanceUrl,
          enhanceModel: imageEnhanceModel,
          outputFormat: 'jpg',
          upscaleFactor: imageEnhanceUpscale,
          faceEnhancement: imageEnhanceFaceEnhancement,
          subjectDetection: 'Foreground',
          faceEnhancementStrength: imageEnhanceFaceStrength,
          faceEnhancementCreativity: imageEnhanceFaceCreativity
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || '增强失败');
      }

      const data = await response.json();
      if (!data.url) {
        throw new Error('未获取到增强后的图片');
      }

      setImageEnhanceResultUrl(data.url);
      setImageEnhanceStatus('增强完成，可下载或查看结果。');
    } catch (error) {
      console.error('图像增强失败:', error);
      setImageEnhanceError(error instanceof Error ? error.message : '增强失败，请稍后重试');
      setImageEnhanceStatus('');
    } finally {
      setImageEnhanceGenerating(false);
    }
  };

  // 批量上传图片
  const handleBatchEnhanceFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const fileArray = Array.from(files);
    const newImages = fileArray.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending' as const
    }));

    setBatchEnhanceImages(prev => [...prev, ...newImages]);

    // 批量上传到 R2
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      const index = batchEnhanceImages.length + i;

      try {
        // 更新状态为上传中
        setBatchEnhanceImages(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], status: 'uploading' };
          return updated;
        });

        const formData = new FormData();
        formData.append('files', image.file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error('上传失败');
        }

        const data = await response.json();
        const uploaded = data.uploaded?.[0];
        if (!uploaded?.url) {
          throw new Error('上传失败，未获取到 URL');
        }

        // 更新状态为已上传
        setBatchEnhanceImages(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: 'uploaded',
            uploadedUrl: uploaded.url
          };
          return updated;
        });
      } catch (error) {
        console.error('上传失败:', error);
        setBatchEnhanceImages(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            status: 'error',
            error: error instanceof Error ? error.message : '上传失败'
          };
          return updated;
        });
      }
    }

    // 清空 input
    if (event.target) {
      event.target.value = '';
    }
  };

  // 批量增强
  const handleBatchEnhance = async () => {
    const imagesToEnhance = batchEnhanceImages.filter(img => img.status === 'uploaded' && img.uploadedUrl);

    if (imagesToEnhance.length === 0) {
      setImageEnhanceError('没有可以增强的图片');
      return;
    }

    setImageEnhanceGenerating(true);
    setImageEnhanceError('');
    setImageEnhanceStatus(`正在批量增强 ${imagesToEnhance.length} 张图片...`);

    try {
      const response = await fetch('/api/enhance-images-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: imagesToEnhance.map(img => ({
            imageUrl: img.uploadedUrl
          })),
          enhanceModel: imageEnhanceModel,
          outputFormat: 'jpg',
          upscaleFactor: imageEnhanceUpscale,
          faceEnhancement: imageEnhanceFaceEnhancement,
          subjectDetection: 'Foreground',
          faceEnhancementStrength: imageEnhanceFaceStrength,
          faceEnhancementCreativity: imageEnhanceFaceCreativity
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.error || '批量增强失败');
      }

      const data = await response.json();
      const results = data.results || [];

      // 更新每张图片的增强状态
      setBatchEnhanceImages(prev => {
        const updated = [...prev];
        results.forEach((result: { success: boolean; originalUrl: string; enhancedUrl?: string; error?: string }) => {
          const index = updated.findIndex(img => img.uploadedUrl === result.originalUrl);
          if (index !== -1) {
            if (result.success && result.enhancedUrl) {
              updated[index] = {
                ...updated[index],
                status: 'enhanced',
                enhancedUrl: result.enhancedUrl
              };
            } else {
              updated[index] = {
                ...updated[index],
                status: 'error',
                error: result.error || '增强失败'
              };
            }
          }
        });
        return updated;
      });

      setImageEnhanceStatus(
        `批量增强完成：${data.summary?.success || 0} 张成功，${data.summary?.failed || 0} 张失败`
      );
    } catch (error) {
      console.error('批量增强失败:', error);
      setImageEnhanceError(error instanceof Error ? error.message : '批量增强失败，请稍后重试');
      setImageEnhanceStatus('');
    } finally {
      setImageEnhanceGenerating(false);
    }
  };

  // 删除批量增强列表中的图片
  const handleRemoveBatchImage = (index: number) => {
    setBatchEnhanceImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // 清空批量增强列表
  const handleClearBatchImages = () => {
    batchEnhanceImages.forEach(img => URL.revokeObjectURL(img.preview));
    setBatchEnhanceImages([]);
  };


  // ==================== Outfit Generation Auto Handlers ====================
  const handleOutfitGenAutoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setOutfitGenAutoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setOutfitGenAutoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOutfitGenAutoDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setOutfitGenAutoDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setOutfitGenAutoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setOutfitGenAutoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearOutfitGenAuto = () => {
    setOutfitGenAutoFile(null);
    setOutfitGenAutoPreview('');
    setOutfitGenAutoUrl('');
    setOutfitGenAutoRemovedBgUrl('');
    setOutfitGenAutoDescription('');
    setOutfitGenAutoFinalUrl('');
    setOutfitGenAutoFinalTaskId('');
    setOutfitGenAutoCurrentStep('idle');
    setOutfitGenAutoGenerating(false);
    setOutfitGenAutoError('');
    setOutfitGenAutoStepStatus({ step1: 'idle', step2: 'idle', step3: 'idle' });
    setOutfitGenAutoMatchingSuggestions('');
  };

  // Helper function to parse and render matching suggestions
  const parseMatchingSuggestions = (suggestions: string) => {
    const lines = suggestions.split('\n').filter(line => line.trim());
    return (
      <div className="space-y-2">
        {lines.map((line, idx) => {
          if (line.startsWith('【') || line.startsWith('**')) {
            // Section headers
            return (
              <p key={idx} className="font-semibold text-purple-700 mt-3">
                {line.replace(/\*\*/g, '').replace(/【|】/g, '')}
              </p>
            );
          } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
            // Bullet points
            return (
              <p key={idx} className="pl-4 text-gray-700">
                {line}
              </p>
            );
          } else {
            return (
              <p key={idx} className="text-gray-700">
                {line}
              </p>
            );
          }
        })}
      </div>
    );
  };

  const handleOutfitGenAutoGenerate = async () => {
    if (!outfitGenAutoFile) {
      setOutfitGenAutoError('请先上传服装图片');
      return;
    }

    setOutfitGenAutoGenerating(true);
    setOutfitGenAutoError('');
    setOutfitGenAutoCurrentStep(1);
    setOutfitGenAutoEnhancedUrl(''); // Reset enhanced URL for new generation

    try {
      // STEP 1: Upload + Remove Background
      console.log('📤 Step 1: Uploading and removing background...');
      setOutfitGenAutoStepStatus(prev => ({ ...prev, step1: 'processing' }));

      // Upload to R2
      const formData = new FormData();
      formData.append('files', outfitGenAutoFile);
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      if (!uploadResponse.ok) throw new Error('Upload failed');
      const uploadData = await uploadResponse.json();
      const uploadedUrl = uploadData.uploaded[0].url;
      setOutfitGenAutoUrl(uploadedUrl);

      // Remove background
      const bgRemoveResponse = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: uploadedUrl }),
      });
      if (!bgRemoveResponse.ok) throw new Error('Background removal failed');
      const bgRemoveData = await bgRemoveResponse.json();
      setOutfitGenAutoRemovedBgUrl(bgRemoveData.resultUrl);
      setOutfitGenAutoStepStatus(prev => ({ ...prev, step1: 'completed' }));

      // STEP 2: Generate Description (+ Smart Matching if enabled)
      console.log('📝 Step 2: Generating description...');
      setOutfitGenAutoCurrentStep(2);
      setOutfitGenAutoStepStatus(prev => ({ ...prev, step2: 'processing' }));

      const describeResponse = await fetch('/api/describe-clothing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: bgRemoveData.resultUrl,
          enableSmartMatch: outfitGenAutoSmartMatchEnabled
        }),
      });
      if (!describeResponse.ok) throw new Error('Description generation failed');
      const describeData = await describeResponse.json();
      setOutfitGenAutoDescription(describeData.description);

      // Handle smart matching suggestions if enabled
      if (outfitGenAutoSmartMatchEnabled && describeData.matchingSuggestions) {
        setOutfitGenAutoMatchingSuggestions(describeData.matchingSuggestions);
      }

      setOutfitGenAutoStepStatus(prev => ({ ...prev, step2: 'completed' }));

      // STEP 3: Generate Final Outfit
      console.log('🎭 Step 3: Generating outfit...');
      setOutfitGenAutoCurrentStep(3);
      setOutfitGenAutoStepStatus(prev => ({ ...prev, step3: 'processing' }));

      const generateResponse = await fetch('/api/generate-outfit-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clothingImageUrl: bgRemoveData.resultUrl,
          description: describeData.description,
          character: outfitGenAutoSelectedCharacter,
          matchingSuggestions: outfitGenAutoSmartMatchEnabled ? describeData.matchingSuggestions : undefined,
        }),
      });
      if (!generateResponse.ok) throw new Error('Outfit generation failed');
      const generateData = await generateResponse.json();
      setOutfitGenAutoFinalTaskId(generateData.taskId);

      // Poll for completion
      console.log('⏳ Polling for task completion...');
      const maxAttempts = 90; // 90 attempts * 2 seconds = 3 minutes timeout
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const statusResponse = await fetch(`/api/task-status?taskId=${generateData.taskId}`);
        const statusData = await statusResponse.json();

        if (statusData.status === 'completed' && statusData.resultUrls?.[0]) {
          const generatedImageUrl = statusData.resultUrls[0];
          setOutfitGenAutoFinalUrl(generatedImageUrl);
          setOutfitGenAutoStepStatus(prev => ({ ...prev, step3: 'completed' }));
          console.log('✅ Generation completed!');

          // Image enhancement if enabled
          if (outfitGenAutoEnhanceEnabled) {
            console.log('🔄 Starting image enhancement...');
            setOutfitGenAutoEnhancing(true);
            try {
              const enhanceResponse = await fetch('/api/enhance-ilovepdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  images: [{ imageUrl: generatedImageUrl }],
                  multiplier: 2
                }),
              });
              const enhanceData = await enhanceResponse.json();
              if (enhanceData.success && enhanceData.results?.[0]?.success) {
                setOutfitGenAutoEnhancedUrl(enhanceData.results[0].enhancedUrl);
                console.log('✅ Image enhancement completed!');
              } else {
                console.warn('⚠️ Image enhancement failed:', enhanceData.results?.[0]?.error);
              }
            } catch (enhanceError) {
              console.error('❌ Enhancement error:', enhanceError);
            } finally {
              setOutfitGenAutoEnhancing(false);
            }
          }

          setOutfitGenAutoCurrentStep('idle');
          console.log('✅ All steps completed!');
          break;
        }

        if (statusData.status === 'failed') {
          throw new Error('Generation task failed');
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成失败';
      setOutfitGenAutoError(errorMessage);
      console.error('❌ Generation error:', errorMessage);

      // Mark current step as failed
      if (outfitGenAutoCurrentStep === 1) {
        setOutfitGenAutoStepStatus(prev => ({ ...prev, step1: 'failed' }));
      } else if (outfitGenAutoCurrentStep === 2) {
        setOutfitGenAutoStepStatus(prev => ({ ...prev, step2: 'failed' }));
      } else if (outfitGenAutoCurrentStep === 3) {
        setOutfitGenAutoStepStatus(prev => ({ ...prev, step3: 'failed' }));
      }
    } finally {
      setOutfitGenAutoGenerating(false);
      setOutfitGenAutoCurrentStep('idle');
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800 text-center md:text-left">
            AI Fashion Image Generator
          </h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/analysis"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-white font-semibold shadow-lg hover:from-pink-600 hover:to-purple-700 transition-colors"
            >
              <span className="text-xl">📊</span>
              爆款总结
            </a>
            <button
              onClick={handleOpenAddModelModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 px-6 py-3 text-white font-semibold shadow-lg hover:from-purple-500 hover:to-blue-400 transition-colors"
            >
              <span className="text-xl">👤</span>
              添加模特
            </button>
          </div>
        </div>

        {/* Global Header with Tabs */}
        <div className="bg-white rounded-t-lg shadow-lg">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('model-generation')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'model-generation'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">🧍</span>
                <span>模特生成</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('outfit-change-v2')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'outfit-change-v2'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">✨</span>
                <span>模特换装V2</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('model-pose')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'model-pose'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">💃</span>
                <span>生成模特姿势</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('image-enhance')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'image-enhance'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">🪄</span>
                <span>图像画质增强</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('image-enhance-v3')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'image-enhance-v3'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">🔥</span>
                <span>画质增强V3</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('outfit-gen-auto')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'outfit-gen-auto'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">🎨</span>
                <span>自动换装</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('mimic-reference')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'mimic-reference'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">📸</span>
                <span>模仿参考图片</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('copywriting')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'copywriting'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">✍️</span>
                <span>生成类似文案</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('pants-closeup')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'pants-closeup'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">👖</span>
                <span>裤子特写</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('anime-cover')}
              className={`flex-1 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === 'anime-cover'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-lg">📚</span>
                <span>生成动漫封面</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-lg shadow-lg p-8 space-y-6">
          {/* Outfit Change Tab Content */}
          {activeTab === 'outfit-change' && (
            <>
              {/* File Upload Section */}
              <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-700">
                1. Select Images ({filesWithStatus.length} files, {uploadedCount} uploaded)
              </h2>
              {filesWithStatus.length > 0 && (
                <button
                  onClick={clearAllFiles}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  CLEAR QUEUE
                </button>
              )}
            </div>

            {/* Upload Area */}
            <div
              className="flex flex-col items-center justify-center w-full"
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <label
                htmlFor="file-upload"
                className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50 scale-105'
                    : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className={`w-16 h-16 mb-4 transition-colors ${
                      isDragging ? 'text-blue-500' : 'text-gray-400'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <div className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      UPLOAD FILES
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    JPEG, PNG, GIF, PDF supported
                  </p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />
              </label>
            </div>

            {/* File Grid */}
            {filesWithStatus.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                {filesWithStatus.map((fileWithStatus, index) => (
                  <div
                    key={index}
                    className="relative border-2 border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 z-10 bg-gray-900 bg-opacity-75 hover:bg-opacity-100 text-white rounded-full p-1.5 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {/* Image preview */}
                    <div className="relative h-40 w-full bg-gray-100">
                      <Image
                        src={fileWithStatus.uploadedInfo?.url || fileWithStatus.preview}
                        alt={fileWithStatus.file.name}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                        unoptimized
                      />

                      {/* Upload overlay */}
                      {fileWithStatus.status === 'uploading' && (
                        <div className="absolute inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center">
                          <svg
                            className="w-12 h-12 text-white mb-3 animate-bounce"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                          <p className="text-white font-semibold text-lg">UPLOADING</p>
                          <p className="text-white text-sm mt-1">Generate Videos</p>
                          <div className="w-4/5 bg-gray-300 rounded-full h-2 mt-3">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${fileWithStatus.progress}%` }}
                            />
                          </div>
                          <p className="text-blue-300 text-xs mt-1">
                            {Math.round(fileWithStatus.progress)}% of {(fileWithStatus.file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      )}

                      {/* Error overlay */}
                      {fileWithStatus.status === 'error' && (
                        <div className="absolute inset-0 bg-red-500 bg-opacity-90 flex flex-col items-center justify-center">
                          <svg className="w-12 h-12 text-white mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-white font-semibold">FAILED</p>
                          <p className="text-white text-xs mt-1 px-2 text-center">{fileWithStatus.error}</p>
                        </div>
                      )}

                      {/* Success check */}
                      {fileWithStatus.status === 'uploaded' && (
                        <div className="absolute top-2 left-2 bg-green-500 rounded-full p-1">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="p-3 bg-gray-50">
                      <p className="text-xs font-medium text-gray-700 truncate">
                        {fileWithStatus.file.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(fileWithStatus.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload status bar */}
            {uploadingCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-blue-700 font-medium">
                      Uploading {uploadingCount} file(s) to Cloudflare R2...
                    </span>
                  </div>
                  <span className="text-blue-600 text-sm">
                    {uploadedCount} / {filesWithStatus.length} completed
                  </span>
                </div>
              </div>
            )}

            {/* Extract Top Only Option */}
            {filesWithStatus.length > 0 && (
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4 border border-orange-200">
                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={extractTopOnly}
                      onChange={(e) => setExtractTopOnly(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-focus:ring-4 peer-focus:ring-orange-300 transition-all"></div>
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👕</span>
                      <span className="font-semibold text-gray-800">只提取上装</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      开启后，AI 只会分析和提取上传图片中的上装（上衣、外套等），完全忽略下装、鞋子和配饰
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Character Selection Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-700">
              2. Select Character
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {characterOptions.map(({ id, label, image, isCustom }) => {
                const isActive = character === id;
                const isDeleting = deletingModelId === id;
                return (
                  <div key={id} className="relative">
                    <button
                      onClick={() => setCharacter(id)}
                      className={`w-full rounded-xl border-2 transition-all text-left pb-3 ${
                        isActive
                          ? 'border-purple-500 bg-purple-50 shadow-lg'
                          : 'border-transparent bg-gray-100 hover:border-purple-200'
                      }`}
                    >
                      {image && (
                        <div
                          className="relative w-full overflow-hidden rounded-t-lg bg-gray-200"
                          style={{ aspectRatio: '9 / 16' }}
                        >
                          <Image
                            src={image}
                            alt={`Preview of ${label}`}
                            fill
                            sizes="(min-width: 768px) 25vw, 50vw"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="px-4 pt-3">
                        <p
                          className={`text-sm font-semibold tracking-wide ${
                            isActive ? 'text-purple-700' : 'text-gray-700'
                          }`}
                        >
                          {label}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 break-all">
                          {id}
                        </p>
                      </div>
                    </button>
                    {isCustom && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteModel(id, label);
                        }}
                        disabled={isDeleting}
                        className="absolute -top-2 -right-2 rounded-full bg-white p-2 shadow-lg text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-60"
                        aria-label={`删除模特 ${label}`}
                      >
                        {isDeleting ? (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></span>
                        ) : (
                          '🗑️'
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Generate Section */}
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-gray-700">
              3. Generate Images
            </h2>

            {/* Wear Mask Option */}
            <div className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg p-4 border border-teal-200">
              <label className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={wearMask}
                    onChange={(e) => setWearMask(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-teal-500 peer-focus:ring-4 peer-focus:ring-teal-300 transition-all"></div>
                  <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                </div>
                <div className="ml-3 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">😷</span>
                    <span className="font-semibold text-gray-800">模特佩戴白色口罩</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    开启后，生成的图片中模特将佩戴纯白色医用外科口罩（标准样式）
                  </p>
                </div>
              </label>
            </div>

            <button
              onClick={handleGenerate}
              disabled={uploadedCount === 0 || generating}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
            >
              {generating ? 'Generating... Please wait' : `Generate Images (${uploadedCount} ready)`}
            </button>

            {generateStatus && (
              <div
                className={`p-4 rounded-lg ${
                  generateStatus.toLowerCase().includes('generation finished')
                    ? 'bg-green-100 text-green-800'
                    : generateStatus.toLowerCase().includes('generating')
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {generateStatus}
              </div>
            )}
            {mockProgress > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-sm font-medium text-purple-700">
                  <span>AI pipeline running…</span>
                  <span>{Math.min(100, Math.round(mockProgress))}%</span>
                </div>
                <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${Math.min(mockProgress, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Generated Results Section */}
          {generatedImages.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-700">
                Generated Results ({generatedImages.length} images)
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {generatedImages.map((image, index) => (
                  <div
                    key={index}
                    className="relative group border-2 border-gray-200 rounded-lg overflow-hidden hover:border-green-400 transition-colors shadow-md"
                  >
                    <div className="relative h-64 w-full bg-gray-50">
                      <Image
                        src={image.imageUrl}
                        alt={image.imageKey}
                        fill
                        className="object-contain"
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        unoptimized
                      />
                    </div>
                    {image.xiaohongshuTitle && (
                      <div className="p-3 bg-white">
                        <div className="bg-gradient-to-r from-pink-50 to-red-50 p-3 rounded-lg border border-pink-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">📝</span>
                            <span className="text-xs font-semibold text-pink-600">小红书标题</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                            {image.xiaohongshuTitle}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      <a
                        href={`/api/download?key=${encodeURIComponent(image.imageKey)}`}
                        download={image.imageKey.split('/').pop() ?? image.imageKey}
                        className="bg-white hover:bg-green-50 text-green-600 p-2 rounded-full shadow-lg transition-colors"
                        title="Download image"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

              {/* Info Section */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">How it works:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                  <li>Select fashion images - they automatically upload to Cloudflare R2</li>
                  <li>Select a character model (lin, Qiao, qiao_mask, mature_woman)</li>
                  <li>Click Generate to create AI-powered fashion images</li>
                  <li>The service analyzes your reference images and generates new outfits</li>
                  <li>Download generated images with Xiaohongshu-ready titles</li>
                </ol>
              </div>
            </>
          )}

          {/* Scene + Pose Tab Content */}
          {activeTab === 'scene-pose' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    上传服装图片
                  </h2>
                  {scenePoseFile && (
                    <button
                      onClick={clearScenePose}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      清除
                    </button>
                  )}
                </div>

                {/* Upload Area */}
                {!scenePoseFile ? (
                  <label
                    htmlFor="scene-pose-upload"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all border-gray-300 bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className="w-16 h-16 mb-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <div className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          上传服装图片
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        支持 JPEG、PNG、GIF 格式
                      </p>
                    </div>
                    <input
                      id="scene-pose-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleScenePoseFileChange}
                    />
                  </label>
                ) : (
                  <div className="space-y-4">
                    {/* Image Preview */}
                    {scenePosePreview && (
                      <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={scenePosePreview}
                          alt="上传的服装图片"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}

                    {/* Analyze Button */}
                    <button
                      onClick={handleScenePoseAnalyze}
                      disabled={scenePoseAnalyzing}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                    >
                      {scenePoseAnalyzing ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>AI 分析中...</span>
                        </div>
                      ) : (
                        '开始 AI 分析'
                      )}
                    </button>

                    {/* Error Message */}
                    {scenePoseError && (
                      <div className="p-4 rounded-lg bg-red-100 text-red-800">
                        {scenePoseError}
                      </div>
                    )}

                    {/* Analysis Results */}
                    {scenePoseAnalysis && (
                      <div className="space-y-4">
                        {/* Description */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <h3 className="font-semibold text-blue-900 mb-2">服装描述：</h3>
                          <p className="text-blue-800 whitespace-pre-line">
                            {scenePoseAnalysis.description}
                          </p>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-3">
                          <h3 className="text-xl font-semibold text-gray-700">
                            场景+姿势建议 ({scenePoseAnalysis.suggestions.length} 个)
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {scenePoseAnalysis.suggestions.map((suggestion, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedSuggestionIndex(index)}
                                className={`bg-gradient-to-br from-purple-50 to-pink-50 border-2 rounded-lg p-4 space-y-3 text-left transition-all ${
                                  selectedSuggestionIndex === index
                                    ? 'border-purple-500 shadow-lg ring-2 ring-purple-300'
                                    : 'border-purple-200 hover:border-purple-400'
                                }`}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl">🎭</span>
                                    <span className="font-semibold text-purple-900">
                                      建议 {index + 1}
                                    </span>
                                  </div>
                                  {selectedSuggestionIndex === index && (
                                    <div className="bg-purple-500 rounded-full p-1">
                                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-sm font-semibold text-purple-800">场景：</span>
                                    <p className="text-sm text-gray-700 mt-1">
                                      {suggestion.scene}
                                    </p>
                                  </div>
                                  <div>
                                    <span className="text-sm font-semibold text-pink-800">姿势：</span>
                                    <p className="text-sm text-gray-700 mt-1">
                                      {suggestion.pose}
                                    </p>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Generate Button */}
                        {selectedSuggestionIndex !== null && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <button
                              onClick={handleScenePoseGenerate}
                              disabled={scenePoseGenerating}
                              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                            >
                              {scenePoseGenerating ? (
                                <div className="flex items-center justify-center gap-3">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                  <span>生成中...</span>
                                </div>
                              ) : (
                                '生成图片'
                              )}
                            </button>
                          </div>
                        )}

                        {/* Generated Image Result */}
                        {scenePoseGeneratedImage && (
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                            <h3 className="text-xl font-semibold text-gray-700 mb-3">生成的图片：</h3>
                            <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                              <Image
                                src={scenePoseGeneratedImage}
                                alt="生成的场景+姿势图片"
                                fill
                                className="object-contain"
                                unoptimized
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Model-Pose Tab Content */}
          {activeTab === 'model-pose' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    上传图片生成模特姿势列表
                  </h2>
                  {modelPoseFile && (
                    <button
                      onClick={clearModelPose}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      清除
                    </button>
                  )}
                </div>

                {/* Upload Area */}
                {!modelPoseFile ? (
                  <div
                    onDragOver={handleModelPoseDragOver}
                    onDragLeave={handleModelPoseDragLeave}
                    onDrop={handleModelPoseDrop}
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                      modelPoseDragging
                        ? 'border-purple-500 bg-purple-50 scale-105'
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <label
                      htmlFor="model-pose-upload"
                      className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg
                          className={`w-16 h-16 mb-4 transition-colors ${
                            modelPoseDragging ? 'text-purple-500' : 'text-gray-400'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <div className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            {modelPoseDragging ? '松开鼠标上传' : '上传服装图片'}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">
                          {modelPoseDragging
                            ? '松开鼠标即可上传'
                            : '点击上传或拖拽图片到此处'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          支持 JPEG、PNG、GIF 格式
                        </p>
                      </div>
                    </label>
                    <input
                      id="model-pose-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleModelPoseFileChange}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Image Preview */}
                    {modelPosePreview && (
                      <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={modelPosePreview}
                          alt="上传的服装图片"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    )}

                    {/* Phone Holding Option */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={modelHoldingPhone}
                            onChange={(e) => setModelHoldingPhone(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 peer-focus:ring-4 peer-focus:ring-blue-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📱</span>
                            <span className="font-semibold text-gray-800">模特一只手举着手机</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            开启后，生成的姿势将包含&ldquo;模特一只手举着手机&rdquo;的动作
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* White Mask Option */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={modelWearingMask}
                            onChange={(e) => setModelWearingMask(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-purple-500 peer-focus:ring-4 peer-focus:ring-purple-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">😷</span>
                            <span className="font-semibold text-gray-800">模特带白色口罩</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            开启后，AI分析和生成的每个姿势都将包含纯白色医用外科口罩（标准样式）
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* PRO Model Option */}
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-4 border border-orange-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={modelPoseUseProModel}
                            onChange={(e) => setModelPoseUseProModel(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-orange-500 peer-focus:ring-4 peer-focus:ring-orange-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🚀</span>
                            <span className="font-semibold text-gray-800">使用 PRO 模型</span>
                            <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">PRO</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            开启后，使用 nano-banana-pro 高级模型生成，质量更高但速度较慢（约2-6分钟）
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Auto Enhance Option */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={modelPoseAutoEnhance}
                            onChange={(e) => setModelPoseAutoEnhance(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 peer-focus:ring-4 peer-focus:ring-green-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            <span className="font-semibold text-gray-800">自动图像增强</span>
                            <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">推荐</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            生成完成后自动进行图像增强，提升画质和细节
                          </p>
                        </div>
                      </label>

                      {/* Enhancement Info */}
                      {modelPoseAutoEnhance && (
                        <div className="mt-4 pt-4 border-t border-green-200">
                          <div className="bg-green-50 rounded-lg p-3 border border-green-300">
                            <p className="text-sm text-green-800">
                              <span className="font-semibold">增强方式：</span>
                              iLoveIMG 画质增强 V3（2x 超分辨率）
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              使用 iLoveIMG 专业图像增强服务，自动提升画质和细节清晰度
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Analyze Button + Preset Pose Library */}
                    <div className="flex gap-3">
                      <button
                        onClick={handleModelPoseAnalyze}
                        disabled={modelPoseAnalyzing}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                      >
                        {modelPoseAnalyzing ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>AI 分析中...</span>
                          </div>
                        ) : (
                          '开始 AI 分析'
                        )}
                      </button>
                      <button
                        onClick={() => setShowPresetPoses(!showPresetPoses)}
                        className={`px-6 py-4 font-bold rounded-lg transition-all transform hover:scale-105 ${
                          showPresetPoses
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                            : 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-2 border-amber-300 hover:from-amber-200 hover:to-orange-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📚</span>
                          <span>预设姿势库</span>
                        </div>
                      </button>
                    </div>

                    {/* Preset Pose Library Panel */}
                    {showPresetPoses && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-bold text-amber-900 flex items-center gap-2">
                            <span className="text-xl">📚</span>
                            <span>预设姿势库（从真实拍摄参考提取）</span>
                          </h3>
                          <button
                            onClick={addAllPresetPoses}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all text-sm"
                          >
                            添加全部姿势
                          </button>
                        </div>
                        <p className="text-sm text-amber-700">
                          点击分类名称可批量添加该分类所有姿势，或点击单个姿势逐个添加。添加后会出现在下方姿势列表中供选择生成。
                        </p>
                        {PRESET_POSE_CATEGORIES.map((category, catIdx) => (
                          <div key={catIdx} className="space-y-2">
                            <button
                              onClick={() => addPresetCategory(catIdx)}
                              className="flex items-center gap-2 text-amber-900 font-semibold hover:text-orange-700 transition-colors group"
                            >
                              <span className="text-base">{
                                catIdx === 0 ? '📱' : catIdx === 1 ? '💃' : catIdx === 2 ? '🧎' : catIdx === 3 ? '🪑' : '🤳'
                              }</span>
                              <span className="group-hover:underline">{category.name}</span>
                              <span className="text-xs text-amber-600 bg-amber-200 px-2 py-0.5 rounded-full">{category.poses.length} 个</span>
                              <span className="text-xs text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">点击批量添加</span>
                            </button>
                            <div className="space-y-1.5 ml-7">
                              {category.poses.map((pose, poseIdx) => (
                                <button
                                  key={poseIdx}
                                  onClick={() => addSinglePresetPose(pose)}
                                  className="w-full text-left p-3 bg-white/70 hover:bg-white border border-amber-100 hover:border-amber-300 rounded-lg text-sm text-gray-700 transition-all hover:shadow-sm group"
                                >
                                  <div className="flex items-start gap-2">
                                    <span className="text-amber-400 group-hover:text-amber-600 flex-shrink-0 mt-0.5">+</span>
                                    <span className="leading-relaxed">{pose}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Error Message */}
                    {modelPoseError && (
                      <div className="p-4 rounded-lg bg-red-100 text-red-800">
                        {modelPoseError}
                      </div>
                    )}

                    {/* Analysis Results */}
                    {modelPoseAnalysis && (
                      <div className="space-y-4">
                        {/* Description */}
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <span className="text-xl">👔</span>
                            <span>服装和场景描述：</span>
                          </h3>
                          <p className="text-blue-800 whitespace-pre-line">
                            {modelPoseAnalysis.description}
                          </p>
                        </div>

                        {/* Poses List */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                              <span className="text-2xl">💃</span>
                              <span>模特姿势建议 ({modelPoseAnalysis.poses.length} 个) - 多选批量生成</span>
                            </h3>
                            <button
                              onClick={toggleSelectAll}
                              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all text-sm"
                            >
                              {selectedPoseIndices.length === modelPoseAnalysis.poses.length ? '取消全选' : '全选'}
                            </button>
                          </div>
                          {selectedPoseIndices.length > 0 && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-blue-800 text-sm font-medium">
                                已选择 {selectedPoseIndices.length} 个姿势
                              </p>
                            </div>
                          )}
                          <div className="space-y-3">
                            {modelPoseAnalysis.poses.map((pose, index) => (
                              <div
                                key={index}
                                onClick={() => togglePoseSelection(index)}
                                className={`w-full bg-gradient-to-br from-purple-50 to-pink-50 border-2 rounded-lg p-4 transition-all cursor-pointer ${
                                  selectedPoseIndices.includes(index)
                                    ? 'border-purple-500 shadow-lg ring-2 ring-purple-300'
                                    : 'border-purple-200 hover:border-purple-400 hover:shadow-md'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedPoseIndices.includes(index)}
                                      onChange={() => togglePoseSelection(index)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-5 h-5 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500 cursor-pointer"
                                    />
                                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                      {index + 1}
                                    </div>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      {pose}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Generate Button */}
                        {selectedPoseIndices.length > 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <button
                              onClick={handleModelPoseGenerate}
                              disabled={modelPoseGenerating}
                              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                            >
                              {modelPoseGenerating ? (
                                <div className="flex items-center justify-center gap-3">
                                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                  <span>批量生成中... (共 {selectedPoseIndices.length} 个)</span>
                                </div>
                              ) : (
                                `批量生成图片 (${selectedPoseIndices.length} 个)`
                              )}
                            </button>
                          </div>
                        )}

                        {/* Generated Images Result */}
                        {modelPoseGeneratedImages.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-xl font-semibold text-gray-700">生成结果：</h3>
                              <div className="flex gap-2 items-center">
                                <div className="flex gap-2 text-sm">
                                  {modelPoseGeneratedImages.filter(img => img.status === 'enhanced').length > 0 && (
                                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-medium flex items-center gap-1">
                                      <span>✨</span>
                                      <span>已增强: {modelPoseGeneratedImages.filter(img => img.status === 'enhanced').length}</span>
                                    </span>
                                  )}
                                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                                    已生成: {modelPoseGeneratedImages.filter(img => img.status === 'completed').length}
                                  </span>
                                  {modelPoseGeneratedImages.filter(img => img.status === 'enhancing').length > 0 && (
                                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                                      增强中: {modelPoseGeneratedImages.filter(img => img.status === 'enhancing').length}
                                    </span>
                                  )}
                                  {modelPoseGeneratedImages.filter(img => img.status === 'generating').length > 0 && (
                                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                                      生成中: {modelPoseGeneratedImages.filter(img => img.status === 'generating').length}
                                    </span>
                                  )}
                                  {modelPoseGeneratedImages.filter(img => img.status === 'failed').length > 0 && (
                                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                                      失败: {modelPoseGeneratedImages.filter(img => img.status === 'failed').length}
                                    </span>
                                  )}
                                </div>
                                {(modelPoseGeneratedImages.filter(img => img.status === 'completed' || img.status === 'enhanced').length > 0) && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={async () => {
                                        const completedImages = modelPoseGeneratedImages.filter(img => img.status === 'completed' || img.status === 'enhanced');

                                        if (completedImages.length === 0) {
                                          alert('没有可下载的图片');
                                          return;
                                        }

                                        try {
                                          const dirName = `${downloadDirPrefix}_${character}`;

                                          console.log(`📦 开始打包下载 ${completedImages.length} 张图片...`);

                                          // 调用后端API打包下载
                                          const response = await fetch('/api/download-pose-images', {
                                            method: 'POST',
                                            headers: {
                                              'Content-Type': 'application/json',
                                            },
                                            body: JSON.stringify({
                                              images: completedImages,
                                              dirName: dirName
                                            }),
                                          });

                                          if (!response.ok) {
                                            const errorData = await response.json();
                                            throw new Error(errorData.error || `下载失败: ${response.status}`);
                                          }

                                          // 获取统计信息
                                          const successCount = parseInt(response.headers.get('X-Success-Count') || '0');
                                          const failedCount = parseInt(response.headers.get('X-Failed-Count') || '0');
                                          const failedImages = response.headers.get('X-Failed-Images') || '';

                                          // 显示统计信息
                                          if (failedCount > 0) {
                                            console.warn(`⚠️ 下载统计: ${successCount} 成功, ${failedCount} 失败`);
                                            console.warn(`失败的图片: ${failedImages}`);
                                            if (!confirm(`成功: ${successCount} 张\n失败: ${failedCount} 张\n失败的图片编号: ${failedImages}\n\n是否继续下载？`)) {
                                              return;
                                            }
                                          }

                                          // 下载 ZIP 文件
                                          const blob = await response.blob();
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `${dirName}_批量下载.zip`;
                                          document.body.appendChild(a);
                                          a.click();
                                          document.body.removeChild(a);
                                          URL.revokeObjectURL(url);

                                          console.log(`✅ 下载完成! ${successCount} 张图片`);
                                        } catch (error) {
                                          console.error('❌ 下载失败:', error);
                                          alert(`下载失败: ${error instanceof Error ? error.message : '未知错误'}\n\n请检查网络连接或稍后重试`);
                                        }
                                      }}
                                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                      一键下载ZIP ({downloadDirPrefix}_{character})
                                    </button>
                                    <button
                                      onClick={() => setShowDownloadSettings(!showDownloadSettings)}
                                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"
                                      title="下载设置"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                    </button>
                                  </div>
                                )}
                                {showDownloadSettings && (
                                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-200 space-y-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      下载设置
                                    </div>
                                    <div className="space-y-2">
                                      <label className="text-sm text-gray-600">文件名前缀：</label>
                                      <input
                                        type="text"
                                        value={downloadDirPrefix}
                                        onChange={(e) => setDownloadDirPrefix(e.target.value)}
                                        placeholder="例如：模特姿势、展示图"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                      />
                                      <p className="text-xs text-gray-500">
                                        文件将命名为：<span className="font-mono text-purple-600">{downloadDirPrefix}_{character}_姿势X.png</span>
                                      </p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => setDownloadDirPrefix('模特姿势')}
                                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                                      >
                                        默认
                                      </button>
                                      <button
                                        onClick={() => setDownloadDirPrefix('展示图')}
                                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                                      >
                                        展示图
                                      </button>
                                      <button
                                        onClick={() => setDownloadDirPrefix('产品图')}
                                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
                                      >
                                        产品图
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {modelPoseGeneratedImages.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={`border-2 rounded-lg p-4 transition-all ${
                                    item.status === 'enhanced'
                                      ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-300 shadow-lg'
                                      : item.status === 'completed'
                                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                                      : item.status === 'enhancing'
                                      ? 'bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-300'
                                      : item.status === 'generating'
                                      ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                                      : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                      {item.poseIndex + 1}
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-xs text-gray-600 line-clamp-2">{item.pose}</p>
                                    </div>
                                    {item.status === 'enhanced' && (
                                      <div className="flex-shrink-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full px-2 py-1 flex items-center gap-1">
                                        <span className="text-white text-xs">✨</span>
                                        <span className="text-white text-xs font-bold">已增强</span>
                                      </div>
                                    )}
                                    {item.status === 'completed' && (
                                      <div className="flex-shrink-0 bg-green-500 rounded-full p-1">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      </div>
                                    )}
                                    {item.status === 'enhancing' && (
                                      <div className="flex items-center gap-1">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                        <span className="text-xs text-blue-600 font-medium">增强中</span>
                                      </div>
                                    )}
                                    {item.status === 'generating' && (
                                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                                    )}
                                    {item.status === 'failed' && (
                                      <div className="flex-shrink-0 bg-red-500 rounded-full p-1">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>

                                  {(item.status === 'completed' || item.status === 'enhanced') && item.imageUrl && (
                                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                                      <Image
                                        src={item.enhancedUrl || item.imageUrl}
                                        alt={`姿势 ${item.poseIndex + 1}`}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                      />
                                      {item.status === 'enhanced' && (
                                        <div className="absolute top-2 right-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                                          <span>✨</span>
                                          <span>增强版</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {item.status === 'enhancing' && item.imageUrl && (
                                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                                      <Image
                                        src={item.imageUrl}
                                        alt={`姿势 ${item.poseIndex + 1}`}
                                        fill
                                        className="object-contain opacity-60"
                                        unoptimized
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20 backdrop-blur-sm">
                                        <div className="text-center bg-white/90 rounded-lg p-4 shadow-lg">
                                          <div className="animate-spin rounded-full h-10 w-10 border-b-3 border-blue-500 mx-auto mb-2"></div>
                                          <p className="text-blue-600 font-medium text-sm">正在增强画质...</p>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {item.status === 'generating' && (
                                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                      <div className="text-center">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto mb-3"></div>
                                        <p className="text-blue-600 font-medium">生成中...</p>
                                      </div>
                                    </div>
                                  )}

                                  {item.status === 'failed' && (
                                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                                      <div className="text-center text-red-600 p-4">
                                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="font-medium mb-1">生成失败</p>
                                        {item.error && <p className="text-xs text-gray-600">{item.error}</p>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'model-generation' && (
            <div className="space-y-8">
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-gray-700">模特性别</h3>
                <div className="flex gap-3">
                  {([
                    { id: 'female', label: '女' },
                    { id: 'male', label: '男' }
                  ] as Array<{ id: ModelGender; label: string }>).map((option) => {
                    const isActive = option.id === modelGenerationGender;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`flex-1 px-4 py-2 rounded-xl border font-semibold transition ${
                          isActive
                            ? 'bg-purple-600 text-white border-purple-600 shadow'
                            : 'border-gray-300 text-gray-700 hover:border-purple-400'
                        }`}
                        onClick={() => handleModelGenerationGenderChange(option.id)}
                      >
                        {option.label}模特
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-700">模特描述</h2>
                  <p className="text-gray-500 text-sm">
                    基于 NanoBanana 设计蓝图模板：角色 → 面部细节 → 发型 → 服装 → 姿态 → 场景光线 → 相机风格。描述越精细，生成效果越接近目标。
                  </p>
                </div>
                <textarea
                  value={modelGenerationPrompt}
                  onChange={(event) => setModelGenerationPrompt(event.target.value)}
                  rows={6}
                  className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3 text-gray-800 focus:border-purple-500 focus:bg-white focus:outline-none transition"
                  placeholder={MODEL_GENERATION_PROMPTS[modelGenerationGender]}
                />
              </div>

              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-gray-700">模特风格</h3>
                <div className="flex flex-wrap gap-3">
                  {MODEL_STYLE_MAP[modelGenerationGender].map((style) => {
                    const isActive = style === modelGenerationStyle;
                    return (
                      <button
                        key={style}
                        type="button"
                        className={`px-4 py-2 rounded-full border transition ${
                          isActive
                            ? 'bg-purple-600 text-white border-purple-600 shadow'
                            : 'border-gray-300 text-gray-700 hover:border-purple-400'
                        }`}
                        onClick={() => setModelGenerationStyle(style)}
                      >
                        {style}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  onClick={handleModelGeneration}
                  disabled={modelGenerationGenerating}
                  className={`inline-flex items-center justify-center gap-3 rounded-xl px-6 py-3 font-semibold text-white transition ${
                    modelGenerationGenerating
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400'
                  }`}
                >
                  <span role="img" aria-hidden="true">
                    🧬
                  </span>
                  {modelGenerationGenerating ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      生成中...
                    </span>
                  ) : (
                    '生成模特'
                  )}
                </button>
              </div>

              {modelGenerationGenerating && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500 border-t-transparent" />
                  <div>
                    <p className="text-blue-900 font-semibold">
                      {modelGenerationStatus || '正在生成模特，请稍候...'}
                    </p>
                    {modelGenerationTaskId && (
                      <p className="text-sm text-blue-700 mt-1">任务 ID：{modelGenerationTaskId}</p>
                    )}
                  </div>
                </div>
              )}

              {!modelGenerationGenerating && modelGenerationStatus && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700" aria-live="polite">
                  <p>{modelGenerationStatus}</p>
                  {modelGenerationTaskId && (
                    <p className="text-xs text-gray-500 mt-1">任务 ID：{modelGenerationTaskId}</p>
                  )}
                </div>
              )}

              {modelGenerationImageUrl && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <h3 className="text-xl font-semibold text-gray-800">生成结果</h3>
                  </div>
                  <div className="relative w-full h-[500px] bg-gray-100 rounded-2xl overflow-hidden">
                    <Image
                      src={modelGenerationImageUrl}
                      alt="生成模特结果"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`/api/download?url=${encodeURIComponent(modelGenerationImageUrl)}&filename=model-generation.png`}
                      className="inline-flex items-center gap-2 rounded-xl bg-purple-600 text-white px-5 py-2.5 font-semibold shadow hover:bg-purple-500 transition"
                    >
                      下载图片
                    </a>
                    <a
                      href={modelGenerationImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:border-purple-400 transition"
                    >
                      在新标签页打开
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'image-enhance' && (
            <div className="space-y-8">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={batchEnhanceFileInputRef}
                onChange={handleBatchEnhanceFilesChange}
              />

              {/* 上传区域 */}
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-gray-700">1. 上传图片</h2>
                <p className="text-sm text-gray-500">
                  支持拖拽上传多张图片，或点击按钮选择图片进行批量增强。
                </p>

                {/* 拖拽上传区域 */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-purple-400', 'bg-purple-50');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-purple-400', 'bg-purple-50');
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0) {
                      const imageFiles = files.filter(file => file.type.startsWith('image/'));
                      if (imageFiles.length > 0) {
                        const event = {
                          target: {
                            files: imageFiles
                          }
                        } as unknown as React.ChangeEvent<HTMLInputElement>;
                        handleBatchEnhanceFilesChange(event);
                      }
                    }
                  }}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-purple-400 hover:bg-purple-50 transition cursor-pointer"
                  onClick={() => batchEnhanceFileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-6xl">📤</div>
                    <div className="text-lg font-semibold text-gray-700">
                      拖拽图片到此处，或点击选择
                    </div>
                    <div className="text-sm text-gray-500">
                      支持 JPG、PNG、WebP 等格式，可一次选择多张图片
                    </div>
                  </div>
                </div>

                {/* 图片列表和操作按钮 */}
                {batchEnhanceImages.length > 0 && (
                  <div className="flex gap-3 mt-4">
                    <button
                      type="button"
                      onClick={() => batchEnhanceFileInputRef.current?.click()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 transition"
                    >
                      <span role="img" aria-hidden="true">➕</span>
                      添加更多图片
                    </button>
                    <button
                      type="button"
                      onClick={handleClearBatchImages}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-gray-700 bg-gray-200 hover:bg-gray-300 transition"
                    >
                      <span role="img" aria-hidden="true">🗑️</span>
                      清空列表 ({batchEnhanceImages.length})
                    </button>
                  </div>
                )}

                {batchEnhanceImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4">
                    {batchEnhanceImages.map((image, index) => (
                      <div key={index} className="relative bg-white rounded-lg border border-gray-200 p-2 shadow-sm hover:shadow-md transition">
                        <div className="relative w-full h-32 bg-gray-100 rounded overflow-hidden mb-2">
                          <Image
                            src={image.enhancedUrl || image.preview}
                            alt={`图片 ${index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`px-2 py-1 rounded font-medium ${
                            image.status === 'pending' ? 'bg-gray-200 text-gray-700' :
                            image.status === 'uploading' ? 'bg-blue-200 text-blue-700' :
                            image.status === 'uploaded' ? 'bg-green-200 text-green-700' :
                            image.status === 'enhancing' ? 'bg-yellow-200 text-yellow-700' :
                            image.status === 'enhanced' ? 'bg-purple-200 text-purple-700' :
                            'bg-red-200 text-red-700'
                          }`}>
                            {image.status === 'pending' && '待上传'}
                            {image.status === 'uploading' && '上传中'}
                            {image.status === 'uploaded' && '已上传'}
                            {image.status === 'enhancing' && '增强中'}
                            {image.status === 'enhanced' && '✓ 已完成'}
                            {image.status === 'error' && '失败'}
                          </span>
                          <div className="flex gap-1">
                            {image.enhancedUrl && (
                              <a
                                href={`/api/download?url=${encodeURIComponent(image.enhancedUrl)}&filename=enhanced-${index + 1}.jpg`}
                                className="p-1 text-purple-600 hover:text-purple-700"
                                title="下载"
                              >
                                ⬇️
                              </a>
                            )}
                            <button
                              onClick={() => handleRemoveBatchImage(index)}
                              className="p-1 text-red-600 hover:text-red-700"
                              title="删除"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                        {image.error && (
                          <div className="text-xs text-red-600 mt-1 break-words">{image.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-700">增强模型</h3>
                    <div className="flex flex-wrap gap-3 mt-3">
                      {IMAGE_ENHANCE_MODELS.map((model) => {
                        const isActive = model === imageEnhanceModel;
                        return (
                          <button
                            key={model}
                            type="button"
                            className={`px-4 py-2 rounded-full border transition ${
                              isActive
                                ? 'bg-purple-600 text-white border-purple-600 shadow'
                                : 'border-gray-300 text-gray-700 hover:border-purple-400'
                            }`}
                            onClick={() => setImageEnhanceModel(model)}
                          >
                            {model}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-gray-700">放大倍数</h3>
                    <div className="flex gap-3 mt-3">
                      {IMAGE_ENHANCE_UPSCALE_OPTIONS.map((option) => {
                        const isActive = option === imageEnhanceUpscale;
                        return (
                          <button
                            key={option}
                            type="button"
                            className={`px-4 py-2 rounded-lg border font-semibold transition ${
                              isActive
                                ? 'bg-blue-600 text-white border-blue-600 shadow'
                                : 'border-gray-300 text-gray-700 hover:border-blue-400'
                            }`}
                            onClick={() => setImageEnhanceUpscale(option)}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-700">面部增强</h3>
                      <p className="text-sm text-gray-500">自动检测面部并优化细节</p>
                    </div>
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={imageEnhanceFaceEnhancement}
                        onChange={(event) => setImageEnhanceFaceEnhancement(event.target.checked)}
                      />
                      <span className="w-12 h-6 bg-gray-300 rounded-full relative transition peer-checked:bg-purple-200">
                        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition peer-checked:translate-x-6 peer-checked:bg-purple-600" />
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>面部增强强度</span>
                      <span>{imageEnhanceFaceStrength.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={imageEnhanceFaceStrength}
                      onChange={(event) => setImageEnhanceFaceStrength(parseFloat(event.target.value))}
                      className="w-full accent-purple-600"
                      disabled={!imageEnhanceFaceEnhancement}
                    />
                  </div>

                  <div>
                    <label className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>面部细节创意</span>
                      <span>{imageEnhanceFaceCreativity.toFixed(1)}</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.1}
                      value={imageEnhanceFaceCreativity}
                      onChange={(event) => setImageEnhanceFaceCreativity(parseFloat(event.target.value))}
                      className="w-full accent-purple-600"
                      disabled={!imageEnhanceFaceEnhancement}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleBatchEnhance}
                  disabled={imageEnhanceGenerating || batchEnhanceImages.filter(img => img.status === 'uploaded').length === 0}
                  className={`w-full inline-flex items-center justify-center gap-3 rounded-xl px-6 py-4 text-lg font-bold text-white transition shadow-lg ${
                    imageEnhanceGenerating || batchEnhanceImages.filter(img => img.status === 'uploaded').length === 0
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 hover:shadow-xl'
                  }`}
                >
                  <span role="img" aria-hidden="true" className="text-2xl">⚡</span>
                  {imageEnhanceGenerating ? (
                    <span className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      正在增强图片...
                    </span>
                  ) : (
                    `开始增强 ${batchEnhanceImages.filter(img => img.status === 'uploaded').length > 0 ? `(${batchEnhanceImages.filter(img => img.status === 'uploaded').length} 张)` : ''}`
                  )}
                </button>

                {batchEnhanceImages.length === 0 && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl p-4 text-sm">
                    💡 请先上传图片再进行增强
                  </div>
                )}

                {imageEnhanceError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                    ❌ {imageEnhanceError}
                  </div>
                )}

                {imageEnhanceStatus && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700" aria-live="polite">
                    {imageEnhanceStatus}
                  </div>
                )}

                {/* 处理进度统计 */}
                {batchEnhanceImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-700">{batchEnhanceImages.length}</div>
                      <div className="text-xs text-gray-600">总数</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{batchEnhanceImages.filter(img => img.status === 'uploaded').length}</div>
                      <div className="text-xs text-gray-600">待增强</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">{batchEnhanceImages.filter(img => img.status === 'enhancing').length}</div>
                      <div className="text-xs text-gray-600">进行中</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{batchEnhanceImages.filter(img => img.status === 'enhanced').length}</div>
                      <div className="text-xs text-gray-600">已完成</div>
                    </div>
                  </div>
                )}
              </div>

              {/* 批量下载按钮 */}
              {batchEnhanceImages.filter(img => img.status === 'enhanced').length > 0 && (
                <div className="space-y-4 p-6 bg-gradient-to-r from-purple-50 to-green-50 rounded-xl border border-purple-200">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✅</span>
                    <h3 className="text-xl font-semibold text-gray-800">
                      增强完成 ({batchEnhanceImages.filter(img => img.status === 'enhanced').length} / {batchEnhanceImages.length})
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {batchEnhanceImages.filter(img => img.enhancedUrl).length === 1 && (
                      <a
                        href={`/api/download?url=${encodeURIComponent(batchEnhanceImages.find(img => img.enhancedUrl)?.enhancedUrl || '')}&filename=enhanced-image.jpg`}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-600 text-white px-5 py-2.5 font-semibold shadow hover:bg-purple-500 transition"
                      >
                        ⬇️ 下载增强图片
                      </a>
                    )}
                    <a
                      href={batchEnhanceImages.find(img => img.enhancedUrl)?.enhancedUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-5 py-2.5 font-semibold text-gray-700 hover:border-purple-400 transition"
                    >
                      🔗 在新标签页打开
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Outfit-Change-V2 Tab Content */}
          {activeTab === 'outfit-change-v2' && (
            <div className="space-y-6">
              {/* Step 1: Upload & Extract Clothing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    步骤 1：批量上传图片并提取服装
                  </h2>
                  {outfitV2OriginalFiles.length > 0 && (
                    <button
                      onClick={clearOutfitV2}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      清除全部
                    </button>
                  )}
                </div>

                {/* Upload Area */}
                {outfitV2OriginalFiles.length === 0 ? (
                  <label
                    htmlFor="outfit-v2-upload"
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                      outfitV2IsDragging
                        ? 'border-purple-500 bg-purple-50 scale-105'
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onDragEnter={handleOutfitV2DragEnter}
                    onDragLeave={handleOutfitV2DragLeave}
                    onDragOver={handleOutfitV2DragOver}
                    onDrop={handleOutfitV2Drop}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className={`w-16 h-16 mb-4 transition-colors ${
                          outfitV2IsDragging ? 'text-purple-500' : 'text-gray-400'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          批量上传包含服装的图片
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        支持 JPEG、PNG、GIF 格式，可一次上传多张图片
                      </p>
                    </div>
                    <input
                      id="outfit-v2-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleOutfitV2FileChange}
                    />
                  </label>
                ) : (
                  <div className="space-y-6">
                    {/* Options Section */}
                    <div className="space-y-3">
                      {/* Extract Top Only Option */}
                      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={outfitV2ExtractTopOnly}
                              onChange={(e) => setOutfitV2ExtractTopOnly(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 peer-focus:ring-4 peer-focus:ring-blue-300 transition-all"></div>
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🧥</span>
                              <span className="font-semibold text-gray-800">只提取外套</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              开启后，只提取最外层的外套，不包含内搭、下装等（依然去除模特）
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Recommend Match Option */}
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={outfitV2RecommendMatch}
                              onChange={(e) => setOutfitV2RecommendMatch(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-indigo-500 peer-focus:ring-4 peer-focus:ring-indigo-300 transition-all"></div>
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">👔👖</span>
                              <span className="font-semibold text-gray-800">推荐搭配的裤子/上衣</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              开启后，AI 会根据提取的服装智能推荐搭配的裤子或上衣
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Recommend Shirt for Outerwear Option */}
                      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg p-4 border border-pink-200">
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={outfitV2RecommendShirt}
                              onChange={(e) => setOutfitV2RecommendShirt(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-pink-500 peer-focus:ring-4 peer-focus:ring-pink-300 transition-all"></div>
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">👔🧥</span>
                              <span className="font-semibold text-gray-800">推荐外套对应的搭配衬衣</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              开启后，提取外套时 AI 会智能推荐搭配的内搭衬衣
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Unzip Jacket Option */}
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                        <label className="flex items-center cursor-pointer group">
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={outfitV2UnzipJacket}
                              onChange={(e) => setOutfitV2UnzipJacket(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 peer-focus:ring-4 peer-focus:ring-green-300 transition-all"></div>
                            <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🧥</span>
                              <span className="font-semibold text-gray-800">外套敞开不拉拉链</span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              开启后，提取生成的服装图片中外套会是敞开状态，不会扣上或拉上拉链
                            </p>
                          </div>
                        </label>
                      </div>

                      <button
                        onClick={handleOutfitV2ExtractClothing}
                        disabled={outfitV2ExtractingClothing || Object.keys(outfitV2ExtractedImages).length > 0}
                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                      >
                        {outfitV2ExtractingClothing ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>批量提取中... ({outfitV2ExtractProgress?.completed || 0}/{outfitV2ExtractProgress?.total || 0})</span>
                          </div>
                        ) : Object.keys(outfitV2ExtractedImages).length > 0 ? (
                          `✅ 已提取 ${Object.keys(outfitV2ExtractedImages).length} 张服装`
                        ) : (
                          `批量提取服装 (${outfitV2OriginalFiles.length} 张图片)`
                        )}
                      </button>
                    </div>

                    {/* Selection Controls - Show after extraction */}
                    {Object.keys(outfitV2ExtractedImages).length > 0 && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-800">
                              已选择 {outfitV2SelectedClothing.size} / {Object.values(outfitV2ExtractedImages).filter(img => img.status === 'completed').length} 张服装
                            </span>
                          </div>
                          <button
                            onClick={toggleOutfitV2SelectAllClothing}
                            className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                          >
                            {outfitV2SelectedClothing.size === Object.values(outfitV2ExtractedImages).filter(img => img.status === 'completed').length
                              ? '全不选'
                              : '全选'}
                          </button>
                        </div>
                        <p className="text-xs text-blue-600 mt-2">
                          💡 点击服装图片可以选择或取消选择，只有选中的服装会用于换装
                        </p>
                      </div>
                    )}

                    {/* Images Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {outfitV2OriginalPreviews.map((preview, index) => (
                        <div key={index} className="space-y-2">
                          <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200" style={{ aspectRatio: '3 / 4' }}>
                            <Image
                              src={preview}
                              alt={`原图 ${index + 1}`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                              #{index + 1}
                            </div>
                          </div>

                          {/* Extraction Status */}
                          {outfitV2ExtractedImages[index] && (
                            <div
                              className={`relative w-full bg-gray-100 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                                outfitV2ExtractedImages[index].status === 'completed'
                                  ? outfitV2SelectedClothing.has(index)
                                    ? 'border-blue-500 ring-4 ring-blue-200'
                                    : 'border-green-500 hover:border-blue-400'
                                  : 'border-green-500'
                              }`}
                              style={{ aspectRatio: '3 / 4' }}
                              onClick={() => {
                                if (outfitV2ExtractedImages[index].status === 'completed') {
                                  toggleOutfitV2ClothingSelection(index);
                                }
                              }}
                            >
                              {outfitV2ExtractedImages[index].status === 'extracting' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                              )}
                              {outfitV2ExtractedImages[index].status === 'completed' && (
                                <>
                                  <Image
                                    src={outfitV2ExtractedImages[index].url}
                                    alt={`提取的服装 ${index + 1}`}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                  />
                                  {/* Selection Checkbox */}
                                  <div className="absolute top-2 right-2">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                      outfitV2SelectedClothing.has(index)
                                        ? 'bg-blue-500 border-blue-500'
                                        : 'bg-white border-gray-300'
                                    }`}>
                                      {outfitV2SelectedClothing.has(index) && (
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </div>
                                  </div>
                                  <div className="absolute bottom-2 left-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                                    ✅ 已提取
                                  </div>
                                </>
                              )}
                              {outfitV2ExtractedImages[index].status === 'failed' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-600 text-xs p-2 text-center">
                                  ❌ {outfitV2ExtractedImages[index].error || '提取失败'}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Clothing Description */}
                          {outfitV2ExtractedImages[index]?.status === 'completed' && outfitV2ClothingDescriptions[index] && (
                            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs text-gray-700 line-clamp-2">
                                {outfitV2ClothingDescriptions[index]}
                              </p>
                            </div>
                          )}

                          {/* Generation Status */}
                          {outfitV2GeneratedImages[index] && (
                            <div className={`relative w-full bg-gray-100 rounded-lg overflow-hidden border-2 ${
                              outfitV2GeneratedImages[index].status === 'enhanced' ? 'border-emerald-500' :
                              outfitV2GeneratedImages[index].status === 'enhancing' ? 'border-blue-500' :
                              outfitV2GeneratedImages[index].status === 'completed' ? 'border-purple-500' :
                              'border-gray-300'
                            }`} style={{ aspectRatio: '3 / 4' }}>
                              {/* Generating state */}
                              {outfitV2GeneratedImages[index].status === 'generating' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                                </div>
                              )}

                              {/* Enhancing state */}
                              {outfitV2GeneratedImages[index].status === 'enhancing' && (
                                <>
                                  <Image
                                    src={outfitV2GeneratedImages[index].url}
                                    alt={`换装结果 ${index + 1}`}
                                    fill
                                    className="object-cover opacity-50 blur-sm"
                                    unoptimized
                                  />
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-500/20">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                    <div className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                                      正在增强画质...
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* Enhanced state */}
                              {outfitV2GeneratedImages[index].status === 'enhanced' && (
                                <>
                                  <Image
                                    src={outfitV2GeneratedImages[index].enhancedUrl || outfitV2GeneratedImages[index].url}
                                    alt={`换装结果 ${index + 1} (增强版)`}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                  <div className="absolute top-2 left-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded font-medium flex items-center gap-1">
                                    <span>✨</span>
                                    <span>增强版</span>
                                  </div>
                                  <div className="absolute bottom-2 left-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded">
                                    ✅ 已换装 + 已增强
                                  </div>
                                  {/* Download button - downloads enhanced version */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const a = document.createElement('a');
                                      const downloadUrl = `/api/download?url=${encodeURIComponent(outfitV2GeneratedImages[index].enhancedUrl || outfitV2GeneratedImages[index].url)}&filename=outfit-v2-enhanced-${index + 1}.png`;
                                      a.href = downloadUrl;
                                      a.download = `outfit-v2-enhanced-${index + 1}.png`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                    }}
                                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 hover:text-emerald-600 rounded-full p-1.5 shadow-md transition-all"
                                    title="下载增强版图片"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </button>
                                </>
                              )}

                              {/* Completed state (not enhanced or enhancement failed) */}
                              {outfitV2GeneratedImages[index].status === 'completed' && (
                                <>
                                  <Image
                                    src={outfitV2GeneratedImages[index].url}
                                    alt={`换装结果 ${index + 1}`}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                  <div className="absolute bottom-2 left-2 bg-purple-500 text-white text-xs px-2 py-1 rounded">
                                    ✅ 已换装
                                  </div>
                                  {/* Download button - downloads original */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const a = document.createElement('a');
                                      const downloadUrl = `/api/download?url=${encodeURIComponent(outfitV2GeneratedImages[index].url)}&filename=outfit-v2-${index + 1}.png`;
                                      a.href = downloadUrl;
                                      a.download = `outfit-v2-${index + 1}.png`;
                                      document.body.appendChild(a);
                                      a.click();
                                      document.body.removeChild(a);
                                    }}
                                    className="absolute top-2 right-2 bg-white/90 hover:bg-white text-gray-700 hover:text-purple-600 rounded-full p-1.5 shadow-md transition-all"
                                    title="下载图片"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </button>
                                </>
                              )}

                              {/* Failed state */}
                              {outfitV2GeneratedImages[index].status === 'failed' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-red-100 text-red-600 text-xs p-2 text-center">
                                  ❌ {outfitV2GeneratedImages[index].error || '换装失败'}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {outfitV2Error && !outfitV2Generating && !outfitV2ExtractingClothing && (
                  <div className="p-4 rounded-lg bg-red-100 text-red-800">
                    {outfitV2Error}
                  </div>
                )}
              </div>

              {/* Step 2: Select Model & Generate */}
              {Object.keys(outfitV2ExtractedImages).length > 0 && (
                <>
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-semibold text-gray-700">
                        步骤 2：选择模特 - 多选批量生成
                      </h2>
                      <button
                        onClick={toggleOutfitV2SelectAll}
                        className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all text-sm"
                      >
                        {outfitV2SelectedCharacters.length === characterOptions.length ? '取消全选' : '全选'}
                      </button>
                    </div>

                    {outfitV2SelectedCharacters.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 text-sm font-medium">
                          已选择 {outfitV2SelectedCharacters.length} 个模特
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {characterOptions.map(({ id, label, image, isCustom }) => {
                        const isActive = outfitV2SelectedCharacters.includes(id);
                        const isDeleting = deletingModelId === id;
                        return (
                          <div key={id} className="relative">
                            <button
                              onClick={() => toggleOutfitV2CharacterSelection(id)}
                              className={`w-full rounded-xl border-2 transition-all text-left pb-3 ${
                                isActive
                                  ? 'border-purple-500 bg-purple-50 shadow-lg ring-2 ring-purple-300'
                                  : 'border-transparent bg-gray-100 hover:border-purple-200'
                              }`}
                            >
                              {isActive && (
                                <div className="absolute top-2 left-2 z-10 bg-purple-500 rounded-full p-1">
                                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                              {image && (
                                <div
                                  className="relative w-full overflow-hidden rounded-t-lg bg-gray-200"
                                  style={{ aspectRatio: '9 / 16' }}
                                >
                                  <Image
                                    src={image}
                                    alt={`Preview of ${label}`}
                                    fill
                                    sizes="(min-width: 768px) 25vw, 50vw"
                                    className="object-cover"
                                  />
                                </div>
                              )}
                              <div className="px-4 pt-3">
                                <p
                                  className={`text-sm font-semibold tracking-wide ${
                                    isActive ? 'text-purple-700' : 'text-gray-700'
                                  }`}
                                >
                                  {label}
                                </p>
                                <p className="text-xs text-gray-500 mt-1 break-all">
                                  {id}
                                </p>
                              </div>
                            </button>
                            {isCustom && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleDeleteModel(id, label);
                                }}
                                disabled={isDeleting}
                                className="absolute -top-2 -right-2 rounded-full bg-white p-2 shadow-lg text-gray-500 hover:text-red-600 hover:bg-red-50 disabled:opacity-60"
                                aria-label={`删除模特 ${label}`}
                              >
                                {isDeleting ? (
                                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></span>
                                ) : (
                                  '🗑️'
                                )}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h2 className="text-2xl font-semibold text-gray-700">
                      步骤 3：批量生成换装图片
                    </h2>

                    {/* Adjust Pose Option */}
                    <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg p-4 border border-pink-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={outfitV2AdjustPose}
                            onChange={(e) => setOutfitV2AdjustPose(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-pink-500 peer-focus:ring-4 peer-focus:ring-pink-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💃</span>
                            <span className="font-semibold text-gray-800">模特动作微调</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            开启后,图片里的模特的动作会根据之前的状态发生微调,避免生成的图片的动作完全一致
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Pro Model Option */}
                    <div className="bg-gradient-to-r from-purple-50 to-fuchsia-50 rounded-lg p-4 border border-purple-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={outfitV2UseProModel}
                            onChange={(e) => setOutfitV2UseProModel(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-purple-600 peer-focus:ring-4 peer-focus:ring-purple-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🚀</span>
                            <span className="font-semibold text-gray-800">PRO 模型</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            开启后使用 KIE 的 nano-banana-pro 模型生成，画面更精细但速度略慢
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Wearing Mask Option */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 border border-blue-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={outfitV2WearingMask}
                            onChange={(e) => setOutfitV2WearingMask(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 peer-focus:ring-4 peer-focus:ring-blue-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">😷</span>
                            <span className="font-semibold text-gray-800">模特佩戴白色口罩</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            开启后，生成的换装图片中模特将佩戴纯白色医用外科口罩（标准样式）
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* 自动图像增强开关 */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={outfitV2AutoEnhance}
                            onChange={(e) => setOutfitV2AutoEnhance(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-500 peer-focus:ring-4 peer-focus:ring-green-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            <span className="font-semibold text-gray-800">自动图像增强</span>
                            <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">推荐</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            每张换装图生成完成后立即自动增强，提升画质和细节清晰度
                          </p>
                        </div>
                      </label>

                      {outfitV2AutoEnhance && (
                        <div className="mt-4 pt-4 border-t border-green-200">
                          <div className="bg-green-50 rounded-lg p-3 border border-green-300">
                            <p className="text-sm text-green-800">
                              <span className="font-semibold">增强方式：</span>
                              iLoveIMG 画质增强 V3（2x 超分辨率）
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              实时增强：每张图生成完成后立即增强，无需等待所有图片生成完毕
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {outfitV2SelectedCharacters.length > 0 ? (
                      <button
                        onClick={handleOutfitV2Generate}
                        disabled={outfitV2Generating}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                      >
                        {outfitV2Generating ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>批量换装中... ({outfitV2GenerateProgress?.completed || 0}/{outfitV2GenerateProgress?.total || 0} 张服装)</span>
                          </div>
                        ) : (
                          `批量生成换装图片 (${Object.values(outfitV2ExtractedImages).filter(img => img.status === 'completed').length} 张服装)`
                        )}
                      </button>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                        <p className="text-yellow-800 text-sm font-medium">
                          请先选择至少一个模特
                        </p>
                      </div>
                    )}

                    {/* Progress Summary */}
                    {Object.keys(outfitV2GeneratedImages).length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-700">生成进度：</h3>
                          <div className="flex gap-2 text-sm flex-wrap">
                            {/* 已增强 */}
                            {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'enhanced').length > 0 && (
                              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-medium flex items-center gap-1">
                                <span>✨</span>
                                <span>已增强: {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'enhanced').length}</span>
                              </span>
                            )}
                            {/* 已生成（未增强或增强失败） */}
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                              已生成: {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'completed').length}
                            </span>
                            {/* 增强中 */}
                            {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'enhancing').length > 0 && (
                              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
                                增强中: {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'enhancing').length}
                              </span>
                            )}
                            {/* 生成中 */}
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                              生成中: {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'generating').length}
                            </span>
                            {/* 失败 */}
                            {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'failed').length > 0 && (
                              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                                失败: {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'failed').length}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Download All Button */}
                        {Object.values(outfitV2GeneratedImages).filter(img => img.status === 'completed' || img.status === 'enhanced').length > 0 && (
                          <div className="mt-4 pt-4 border-t border-blue-200">
                            <button
                              onClick={async () => {
                                const completedImages = Object.entries(outfitV2GeneratedImages)
                                  .filter(([, img]) => img.status === 'completed' || img.status === 'enhanced')
                                  .map(([index, img]) => ({
                                    index: Number(index),
                                    url: img.enhancedUrl || img.url,  // 优先使用增强版
                                    isEnhanced: !!img.enhancedUrl
                                  }));

                                for (const { index, url, isEnhanced } of completedImages) {
                                  const a = document.createElement('a');
                                  const filename = isEnhanced
                                    ? `outfit-v2-enhanced-${index + 1}.png`
                                    : `outfit-v2-${index + 1}.png`;
                                  const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${filename}`;
                                  a.href = downloadUrl;
                                  a.download = filename;
                                  document.body.appendChild(a);
                                  a.click();
                                  document.body.removeChild(a);
                                  // 添加小延迟避免浏览器阻止多个下载
                                  await new Promise(resolve => setTimeout(resolve, 300));
                                }
                              }}
                              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>一键下载全部图片 ({Object.values(outfitV2GeneratedImages).filter(img => img.status === 'completed' || img.status === 'enhanced').length} 张)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Info Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <span className="text-lg">ℹ️</span>
                  <span>批量换装工作流程说明：</span>
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                  <li>批量上传多张包含人物和服装的图片（支持一次上传多张）</li>
                  <li>点击&ldquo;批量提取服装&rdquo;按钮，AI 会并行处理所有图片，自动移除人物，只保留服装</li>
                  <li>从模特库中选择一个目标模特</li>
                  <li>点击&ldquo;批量生成换装图片&rdquo;，AI 会将所有提取的服装并行换装到选定的模特身上</li>
                  <li>整个过程使用并行处理技术，大幅提升批量处理速度，并确保服装细节和模特特征都得到完整保留</li>
                </ol>
              </div>
            </div>
          )}

          {/* Mimic-Reference Tab Content */}
          {activeTab === 'mimic-reference' && (
            <div className="space-y-6">
              {/* Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    上传参考图片
                  </h2>
                  {mimicRefFile && (
                    <button
                      onClick={clearMimicRef}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      🗑️ 清空
                    </button>
                  )}
                </div>

                {/* Upload Area */}
                <label
                  onDragEnter={handleMimicRefDragEnter}
                  onDragLeave={handleMimicRefDragLeave}
                  onDragOver={handleMimicRefDragOver}
                  onDrop={handleMimicRefDrop}
                  className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all ${
                    mimicRefIsDragging
                      ? 'border-purple-500 bg-purple-100'
                      : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  <div className="text-center space-y-2">
                    <div className="text-5xl">📸</div>
                    <p className="text-lg font-semibold text-gray-700">
                      {mimicRefFile ? '重新上传图片' : '上传参考图片'}
                    </p>
                    <p className="text-sm text-gray-500">
                      点击选择或拖拽图片到此区域
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                    onChange={handleMimicRefFileChange}
                    className="hidden"
                  />
                </label>

                {/* Preview */}
                {mimicRefPreview && (
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border-2 border-purple-200">
                    <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                      <span className="text-xl">🖼️</span>
                      <span>参考图片预览：</span>
                    </h3>
                    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={mimicRefPreview}
                        alt="参考图片预览"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>
                  </div>
                )}

                {/* Analyze Button */}
                {mimicRefFile && (
                  <button
                    onClick={handleMimicRefAnalyze}
                    disabled={mimicRefAnalyzing || !mimicRefUploadedUrl}
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-lg font-semibold text-white shadow-lg hover:from-blue-500 hover:to-purple-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                  >
                    {mimicRefAnalyzing ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        <span>AI 分析中...</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-xl">🤖</span>
                        <span>AI 分析场景环境</span>
                      </>
                    )}
                  </button>
                )}

                {/* Error Message */}
                {mimicRefError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    ⚠️ {mimicRefError}
                  </div>
                )}

                {/* Analysis Result */}
                {mimicRefAnalysis && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-6 space-y-6">
                    <h3 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                      <span className="text-2xl">✨</span>
                      <span>分析结果：</span>
                    </h3>

                    {/* Scene Description */}
                    <div className="bg-white rounded-lg p-5 space-y-3">
                      <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <span className="text-xl">🎬</span>
                        <span>场景环境描述：</span>
                      </h4>
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {mimicRefAnalysis.sceneDescription}
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 text-center">
                        ✅ 场景分析完成！点击下方&quot;上传图片生成&quot;按钮，可以将模特放到此场景中（保持模特原有姿势和身材）
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Character Selection and Generate Section */}
              {mimicRefAnalysis && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    选择模特并生成图片（保持模特姿势，只换背景）
                  </h2>

                  {/* Character Selection */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {characterOptions.map(({ id, label, image }) => {
                      const isActive = mimicRefCharacter === id;
                      return (
                        <div key={id} className="relative">
                          <button
                            onClick={() => setMimicRefCharacter(id)}
                            className={`w-full rounded-xl border-2 transition-all text-left pb-3 ${
                              isActive
                                ? 'border-purple-500 bg-purple-50 shadow-lg'
                                : 'border-transparent bg-gray-100 hover:border-purple-200'
                            }`}
                          >
                            {image && (
                              <div
                                className="relative w-full overflow-hidden rounded-t-lg bg-gray-200"
                                style={{ aspectRatio: '9 / 16' }}
                              >
                                <Image
                                  src={image}
                                  alt={`Preview of ${label}`}
                                  fill
                                  sizes="(min-width: 768px) 25vw, 50vw"
                                  className="object-cover"
                                />
                              </div>
                            )}
                            <div className="px-4 pt-3">
                              <p
                                className={`text-sm font-semibold tracking-wide ${
                                  isActive ? 'text-purple-700' : 'text-gray-700'
                                }`}
                              >
                                {label}
                              </p>
                            </div>
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleMimicRefGenerate}
                    disabled={mimicRefGenerating}
                    className="w-full rounded-xl bg-gradient-to-r from-green-600 to-teal-600 px-6 py-4 text-lg font-semibold text-white shadow-lg hover:from-green-500 hover:to-teal-500 disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3"
                  >
                    {mimicRefGenerating ? (
                      <div className="flex items-center gap-3">
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                        <span>AI 生成中...</span>
                      </div>
                    ) : (
                      <>
                        <span className="text-xl">✨</span>
                        <span>生成图片（保持姿势换背景）</span>
                      </>
                    )}
                  </button>

                  {/* Generated Image Result */}
                  {mimicRefGeneratedImage && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-6">
                      <h3 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <span className="text-2xl">🎉</span>
                        <span>生成的图片：</span>
                      </h3>
                      <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                        <Image
                          src={mimicRefGeneratedImage}
                          alt="生成的图片"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="mt-4 bg-white p-4 rounded-lg">
                        <p className="text-sm text-gray-600 text-center">
                          ✅ 生成完成！模特已按照参考图片的场景和姿势生成新图片
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <span className="text-lg">ℹ️</span>
                  <span>功能说明：</span>
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                  <li>上传一张包含模特姿势和场景的参考图片</li>
                  <li>点击&ldquo;AI 分析场景和姿势&rdquo;按钮</li>
                  <li>AI 会详细分析图片中的场景环境特征（背景、光线、氛围等）</li>
                  <li>AI 会详细描述模特的姿势和动作细节</li>
                  <li>您可以使用这些详细描述在图像生成工具中重现相似的场景和姿势</li>
                </ol>
              </div>
            </div>
          )}

          {/* Copywriting Tab Content */}
          {activeTab === 'copywriting' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-6 border border-pink-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-3xl">✍️</span>
                  <span>生成类似爆款文案</span>
                </h2>
                <p className="text-gray-600">
                  输入商品描述或现有文案，AI 将结合内容特点，生成 3 个专业的营销文案，帮助您更好地推广商品。
                </p>
              </div>

              {/* Input Area */}
              <div className="space-y-4">
                <label className="block">
                  <span className="text-lg font-semibold text-gray-700 mb-2 block">
                    输入原始文案：
                  </span>
                  <textarea
                    value={copywritingInput}
                    onChange={(e) => setCopywritingInput(e.target.value)}
                    placeholder="请输入您想要分析和模仿的文案内容..."
                    className="w-full h-40 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none text-gray-800"
                  />
                </label>

                {/* Target Audience Selection */}
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                  <label className="block">
                    <span className="text-base font-semibold text-gray-700 mb-3 block flex items-center gap-2">
                      <span className="text-xl">🎯</span>
                      <span>目标群体：</span>
                    </span>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setCopywritingTargetAudience('female')}
                        className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                          copywritingTargetAudience === 'female'
                            ? 'bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg transform scale-105'
                            : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-purple-400'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-xl">👧</span>
                          <span>女生</span>
                        </span>
                      </button>
                      <button
                        onClick={() => setCopywritingTargetAudience('male')}
                        className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                          copywritingTargetAudience === 'male'
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg transform scale-105'
                            : 'bg-white text-gray-600 border-2 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-xl">👦</span>
                          <span>男生</span>
                        </span>
                      </button>
                    </div>
                  </label>
                </div>

                {/* Generate Button */}
                <button
                  onClick={handleCopywritingGenerate}
                  disabled={copywritingGenerating || !copywritingInput.trim()}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 shadow-lg"
                >
                  {copywritingGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                      AI 正在分析并生成文案...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-xl">✨</span>
                      生成类似文案
                    </span>
                  )}
                </button>
              </div>

              {/* Error Message */}
              {copywritingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 font-medium">{copywritingError}</p>
                </div>
              )}

              {/* Results */}
              {copywritingResults && copywritingResults.length > 0 && (
                <div className="space-y-6">
                  {/* Analysis */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
                      <span className="text-2xl">📊</span>
                      <span>爆款分析：</span>
                    </h3>
                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {copywritingResults[0].analysis}
                    </div>
                  </div>

                  {/* Generated Copywriting */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-2xl">🎯</span>
                      <span>生成文案：</span>
                    </h3>
                    <div className="space-y-4">
                      {copywritingResults[0].copywriting.map((copy, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-lg p-5 border-2 border-green-200 hover:border-green-400 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                                {copy}
                              </p>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(copy);
                                  alert('文案已复制到剪贴板！');
                                }}
                                className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                复制文案
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Instructions */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📖 使用说明：</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>在输入框中粘贴或输入您想要分析的爆款文案</li>
                  <li>点击&ldquo;生成类似文案&rdquo;按钮，AI 将分析文案的爆款要素</li>
                  <li>AI 会生成 3 个风格相似的文案，每个文案都包含相关的 hashtag</li>
                  <li>点击&ldquo;复制文案&rdquo;按钮即可快速复制到剪贴板使用</li>
                </ol>
              </div>
            </div>
          )}

          {/* Pants Closeup Tab Content */}
          {activeTab === 'pants-closeup' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-3xl">👖</span>
                  <span>裤子特写镜头生成</span>
                </h2>
                <p className="text-gray-600">
                  上传一张图片，选择拍摄角度，AI 将生成第一人称视角的特写镜头照片。
                </p>
              </div>

              {/* Upload Area */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">1. 上传图片</h3>
                <div
                  onDragOver={handlePantsCloseupDragOver}
                  onDragLeave={handlePantsCloseupDragLeave}
                  onDrop={handlePantsCloseupDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${
                    pantsCloseupIsDragging
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:border-blue-400 bg-gray-50'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePantsCloseupFileSelect}
                    className="hidden"
                    id="pants-closeup-file-input"
                  />
                  <label
                    htmlFor="pants-closeup-file-input"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-3xl">📁</span>
                    </div>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      点击上传或拖拽图片到这里
                    </p>
                    <p className="text-sm text-gray-500">支持 JPG、PNG 格式</p>
                  </label>
                </div>

                {/* Preview */}
                {pantsCloseupPreview && (
                  <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
                    <Image
                      src={pantsCloseupPreview}
                      alt="Pants preview"
                      width={400}
                      height={600}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Angle Selection */}
              {pantsCloseupFile && (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    选择拍摄角度：
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setPantsCloseupAngle('sitting')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        pantsCloseupAngle === 'sitting'
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">🪑</div>
                      <div className="font-semibold">坐姿角度</div>
                      <div className="text-xs mt-1 opacity-75">从坐姿俯视视角</div>
                    </button>
                    <button
                      onClick={() => setPantsCloseupAngle('overhead')}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        pantsCloseupAngle === 'overhead'
                          ? 'border-purple-600 bg-purple-50 text-purple-700'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">👀</div>
                      <div className="font-semibold">俯视角度</div>
                      <div className="text-xs mt-1 opacity-75">从站立俯视视角</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {pantsCloseupError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 font-medium">{pantsCloseupError}</p>
                </div>
              )}

              {/* Generate Button */}
              {pantsCloseupFile && !pantsCloseupGeneratedImage && (
                <button
                  onClick={handlePantsCloseupGenerate}
                  disabled={pantsCloseupGenerating}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 shadow-lg"
                >
                  {pantsCloseupGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                      AI 正在生成特写镜头...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-xl">✨</span>
                      生成特写镜头
                    </span>
                  )}
                </button>
              )}

              {/* Generated Image */}
              {pantsCloseupGeneratedImage && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 border border-purple-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-2xl">🎨</span>
                      <span>生成结果：</span>
                    </h3>
                    <div className="relative rounded-lg overflow-hidden border-2 border-purple-300">
                      <Image
                        src={pantsCloseupGeneratedImage}
                        alt="Generated pants closeup"
                        width={600}
                        height={900}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                    <div className="mt-4 flex gap-3">
                      <a
                        href={`/api/download?url=${encodeURIComponent(pantsCloseupGeneratedImage)}&filename=pants-closeup.png`}
                        download
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-lg transition-all text-center"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-xl">💾</span>
                          下载图片
                        </span>
                      </a>
                      <button
                        onClick={() => {
                          setPantsCloseupFile(null);
                          setPantsCloseupPreview('');
                          setPantsCloseupGeneratedImage(null);
                          setPantsCloseupError('');
                        }}
                        className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-xl">🔄</span>
                          重新开始
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Instructions */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📖 使用说明：</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>上传一张图片（建议使用包含裤子的清晰照片）</li>
                  <li>选择拍摄角度：坐姿角度（腿部交叉坐姿）或俯视角度（站立俯视）</li>
                  <li>点击&ldquo;生成特写镜头&rdquo;按钮，AI 将生成第一人称视角的特写照片</li>
                  <li>生成完成后，可以下载图片或重新开始</li>
                </ol>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>💡 提示：</strong>不同角度呈现不同效果 - 坐姿角度展示交叉双腿的优雅姿态，俯视角度展示站立时的完整下半身视角。
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'anime-cover' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-6 border border-pink-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-3xl">📚</span>
                  <span>生成动漫封面</span>
                </h2>
                <p className="text-gray-600">
                  上传一张图片，输入标题文案，AI 将生成一个动漫风格的封面图。模特动作不变（一定要举着手机挡着脸），显示全身照，图片最上面显示文案。
                </p>
              </div>

              {/* Upload Area */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">1. 上传图片</h3>
                <div
                  onDragOver={handleAnimeCoverDragOver}
                  onDragLeave={handleAnimeCoverDragLeave}
                  onDrop={handleAnimeCoverDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 transition-all ${
                    animeCoverIsDragging
                      ? 'border-pink-500 bg-pink-50'
                      : 'border-gray-300 hover:border-pink-400 bg-gray-50'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAnimeCoverFileSelect}
                    className="hidden"
                    id="anime-cover-file-input"
                  />
                  <label
                    htmlFor="anime-cover-file-input"
                    className="flex flex-col items-center justify-center cursor-pointer"
                  >
                    <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-4">
                      <span className="text-3xl">📁</span>
                    </div>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      点击上传或拖拽图片到这里
                    </p>
                    <p className="text-sm text-gray-500">支持 JPG、PNG 格式</p>
                  </label>
                </div>

                {/* Preview */}
                {animeCoverPreview && (
                  <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
                    <Image
                      src={animeCoverPreview}
                      alt="Anime cover preview"
                      width={400}
                      height={600}
                      className="w-full h-auto object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Title Input */}
              {animeCoverFile && (
                <div className="space-y-3">
                  <label className="block text-lg font-semibold text-gray-700">
                    2. 输入封面标题
                  </label>
                  <input
                    type="text"
                    value={animeCoverTitle}
                    onChange={(e) => setAnimeCoverTitle(e.target.value)}
                    placeholder="请输入要在封面上显示的文案标题..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-pink-500 focus:outline-none text-gray-700 text-lg"
                  />
                </div>
              )}

              {/* Error Message */}
              {animeCoverError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 font-medium">{animeCoverError}</p>
                </div>
              )}

              {/* Generate Button */}
              {animeCoverFile && animeCoverTitle && !animeCoverGeneratedImage && (
                <button
                  onClick={handleAnimeCoverGenerate}
                  disabled={animeCoverGenerating}
                  className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 shadow-lg"
                >
                  {animeCoverGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                      AI 正在生成动漫封面...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-xl">✨</span>
                      生成动漫封面
                    </span>
                  )}
                </button>
              )}

              {/* Generated Image */}
              {animeCoverGeneratedImage && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-6 border border-pink-200">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <span className="text-2xl">🎨</span>
                      <span>生成结果：</span>
                    </h3>
                    <div className="relative rounded-lg overflow-hidden border-2 border-pink-300">
                      <Image
                        src={animeCoverGeneratedImage}
                        alt="Generated anime cover"
                        width={600}
                        height={900}
                        className="w-full h-auto object-contain"
                      />
                    </div>
                    <div className="mt-4 flex gap-3">
                      <a
                        href={`/api/download?url=${encodeURIComponent(animeCoverGeneratedImage)}&filename=anime-cover.png`}
                        download
                        className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold py-3 px-6 rounded-lg transition-all text-center"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-xl">💾</span>
                          下载图片
                        </span>
                      </a>
                      <button
                        onClick={() => {
                          setAnimeCoverFile(null);
                          setAnimeCoverPreview('');
                          setAnimeCoverTitle('');
                          setAnimeCoverGeneratedImage(null);
                          setAnimeCoverError('');
                        }}
                        className="flex-1 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
                      >
                        <span className="flex items-center justify-center gap-2">
                          <span className="text-xl">🔄</span>
                          重新开始
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Instructions */}
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">📖 使用说明：</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>上传一张图片（建议使用模特举着手机挡脸的照片）</li>
                  <li>输入要在封面上显示的文案标题</li>
                  <li>点击&ldquo;生成动漫封面&rdquo;按钮，AI 将生成动漫风格的封面</li>
                  <li>生成完成后，可以下载图片或重新开始</li>
                </ol>
                <div className="mt-4 p-4 bg-pink-50 rounded-lg border border-pink-200">
                  <p className="text-sm text-pink-800">
                    <strong>💡 提示：</strong>生成的图片将采用柔和的动漫风格，保持模特动作不变，并在图片顶部显示您输入的文案标题。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Image Enhance V2 Tab Content */}
          {activeTab === 'image-enhance-v2' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-3xl">✨</span>
                  <span>图像画质增强 V2</span>
                  <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">本地增强</span>
                </h2>
                <p className="text-gray-700 mb-3">
                  使用本地 Python 服务进行图像增强，支持人脸修复（GFPGAN）和超分辨率（Real-ESRGAN）
                </p>
                <div className="bg-white rounded-lg p-4 border border-green-300">
                  <h3 className="font-semibold text-green-800 mb-2">增强特性：</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✅ 人脸修复与美化（GFPGAN）</li>
                    <li>✅ 超分辨率放大（Real-ESRGAN）</li>
                    <li>✅ 批量处理支持</li>
                    <li>✅ 本地处理，数据安全</li>
                  </ul>
                </div>
              </div>

              {/* Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-700">上传图片</h3>
                  {enhanceV2Files.length > 0 && (
                    <button
                      onClick={() => {
                        setEnhanceV2Files([]);
                        setEnhanceV2Previews([]);
                        setEnhanceV2Results([]);
                        setEnhanceV2Error('');
                      }}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      清除所有
                    </button>
                  )}
                </div>

                {/* File Upload Area */}
                {enhanceV2Files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-all">
                    <label
                      htmlFor="enhance-v2-upload"
                      className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg
                          className="w-16 h-16 mb-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <div className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            上传图片
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">点击上传或拖拽图片到此处</p>
                        <p className="text-xs text-gray-400 mt-1">支持批量上传，最大10MB/张</p>
                      </div>
                    </label>
                    <input
                      id="enhance-v2-upload"
                      ref={enhanceV2FileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          setEnhanceV2Files(files);
                          const previews = files.map(file => URL.createObjectURL(file));
                          setEnhanceV2Previews(previews);
                          setEnhanceV2Results(files.map(() => ({ originalUrl: '', status: 'pending' as const })));
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Preview Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {enhanceV2Previews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                            <Image
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div className="mt-2 text-xs text-gray-600 truncate">
                            {enhanceV2Files[index]?.name}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Skip ESRGAN Option */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                      <label className="flex items-center cursor-pointer group">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={enhanceV2SkipEsrgan}
                            onChange={(e) => setEnhanceV2SkipEsrgan(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 peer-focus:ring-4 peer-focus:ring-blue-300 transition-all"></div>
                          <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⚡</span>
                            <span className="font-semibold text-gray-800">仅人脸修复（跳过超分辨率）</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            开启后仅使用 GFPGAN 进行人脸修复，速度更快但不放大分辨率
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Process Button */}
                    <button
                      onClick={async () => {
                        setEnhanceV2Processing(true);
                        setEnhanceV2Error('');

                        try {
                          // Process each image
                          for (let i = 0; i < enhanceV2Files.length; i++) {
                            const file = enhanceV2Files[i];

                            // Update status to enhancing
                            setEnhanceV2Results(prev =>
                              prev.map((r, idx) =>
                                idx === i ? { ...r, status: 'enhancing' as const } : r
                              )
                            );

                            // Send to enhancement API
                            const formData = new FormData();
                            formData.append('file', file);
                            formData.append('skipEsrgan', enhanceV2SkipEsrgan ? 'true' : 'false');

                            const enhanceResponse = await fetch('/api/enhance-local', {
                              method: 'POST',
                              body: formData,
                            });

                            if (!enhanceResponse.ok) {
                              const errorData = await enhanceResponse.json().catch(() => ({}));
                              throw new Error(errorData.error || 'Enhancement failed');
                            }

                            const enhanceData = await enhanceResponse.json();

                            if (enhanceData.success && enhanceData.downloadUrl) {
                              // Download enhanced image
                              const downloadResponse = await fetch(enhanceData.downloadUrl);
                              if (!downloadResponse.ok) {
                                throw new Error('Failed to download enhanced image');
                              }

                              const blob = await downloadResponse.blob();
                              const enhancedFile = new File([blob], enhanceData.filename, { type: 'image/png' });

                              // Upload to R2
                              const uploadFormData = new FormData();
                              uploadFormData.append('files', enhancedFile);

                              const uploadResponse = await fetch('/api/upload', {
                                method: 'POST',
                                body: uploadFormData,
                              });

                              if (!uploadResponse.ok) {
                                throw new Error('Failed to upload enhanced image to R2');
                              }

                              const uploadData = await uploadResponse.json();
                              const enhancedUrl = uploadData.uploads?.[0]?.url;

                              if (enhancedUrl) {
                                // Update result
                                setEnhanceV2Results(prev =>
                                  prev.map((r, idx) =>
                                    idx === i
                                      ? {
                                          originalUrl: enhanceV2Previews[i],
                                          enhancedUrl: enhancedUrl,
                                          status: 'enhanced' as const,
                                        }
                                      : r
                                  )
                                );
                              } else {
                                throw new Error('No enhanced URL returned');
                              }
                            } else {
                              throw new Error(enhanceData.error || 'Enhancement failed');
                            }
                          }
                        } catch (error) {
                          const errorMessage = error instanceof Error ? error.message : 'Processing failed';
                          setEnhanceV2Error(errorMessage);
                          console.error('Enhancement V2 error:', error);
                        } finally {
                          setEnhanceV2Processing(false);
                        }
                      }}
                      disabled={enhanceV2Processing}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                    >
                      {enhanceV2Processing ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>处理中...</span>
                        </div>
                      ) : (
                        `开始增强 (${enhanceV2Files.length} 张图片)`
                      )}
                    </button>

                    {/* Error Message */}
                    {enhanceV2Error && (
                      <div className="p-4 rounded-lg bg-red-100 text-red-800">
                        {enhanceV2Error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Results Section */}
              {enhanceV2Results.some(r => r.enhancedUrl) && (
                <div className="space-y-4">
                  <h3 className="text-xl font-semibold text-gray-700">增强结果</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {enhanceV2Results.map((result, index) => (
                      result.enhancedUrl && (
                        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                          <h4 className="font-semibold text-gray-700">图片 {index + 1}</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {/* Original */}
                            <div>
                              <p className="text-xs text-gray-500 mb-2">原图</p>
                              <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                                <Image
                                  src={result.originalUrl}
                                  alt="Original"
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            </div>
                            {/* Enhanced */}
                            <div>
                              <p className="text-xs text-gray-500 mb-2">增强后 ✨</p>
                              <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                                <Image
                                  src={result.enhancedUrl}
                                  alt="Enhanced"
                                  fill
                                  className="object-cover"
                                  unoptimized
                                />
                              </div>
                            </div>
                          </div>
                          <a
                            href={result.enhancedUrl}
                            download
                            className="block w-full text-center bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                          >
                            下载增强图片
                          </a>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'image-enhance-v3' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-6 border border-orange-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span className="text-3xl">🔥</span>
                  <span>图像画质增强 V3</span>
                  <span className="px-2 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">ilovepdf</span>
                </h2>
                <p className="text-gray-700 mb-3">
                  使用 ilovepdf 专业 API 进行图像超清放大，支持 2x 和 4x 倍数选择
                </p>
                <div className="bg-white rounded-lg p-4 border border-orange-300">
                  <h3 className="font-semibold text-orange-800 mb-2">增强特性：</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>✅ 2x/4x 超高清放大</li>
                    <li>✅ 专业级画质增强</li>
                    <li>✅ 批量处理支持</li>
                    <li>✅ 快速云端处理</li>
                  </ul>
                </div>
              </div>

              {/* Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-700">上传图片</h3>
                  {enhanceV3Files.length > 0 && (
                    <button
                      onClick={() => {
                        setEnhanceV3Files([]);
                        setEnhanceV3Previews([]);
                        setEnhanceV3Results([]);
                        setEnhanceV3Error('');
                      }}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      清除所有
                    </button>
                  )}
                </div>

                {/* File Upload Area */}
                {enhanceV3Files.length === 0 ? (
                  <div
                    className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg transition-all ${
                      isDraggingEnhanceV3
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onDragEnter={handleEnhanceV3DragEnter}
                    onDragLeave={handleEnhanceV3DragLeave}
                    onDragOver={handleEnhanceV3DragOver}
                    onDrop={handleEnhanceV3Drop}
                  >
                    <label
                      htmlFor="enhance-v3-upload"
                      className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg
                          className="w-16 h-16 mb-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <div className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
                          <div className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            上传图片
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">点击上传或拖拽图片到此处</p>
                        <p className="text-xs text-gray-400 mt-1">支持批量上传，推荐每张不超过10MB</p>
                      </div>
                    </label>
                    <input
                      id="enhance-v3-upload"
                      ref={enhanceV3FileInputRef}
                      type="file"
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          setEnhanceV3Files(files);
                          const previews = files.map(file => URL.createObjectURL(file));
                          setEnhanceV3Previews(previews);
                          setEnhanceV3Results(files.map(() => ({ originalUrl: '', status: 'pending' as const })));
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Preview Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {enhanceV3Previews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                            <Image
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div className="mt-2 text-xs text-gray-600 truncate">
                            {enhanceV3Files[index]?.name}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Multiplier Selector */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
                      <h3 className="font-semibold text-gray-800 mb-3">选择放大倍数</h3>
                      <div className="flex gap-4">
                        <label className="flex-1">
                          <input
                            type="radio"
                            name="multiplier"
                            value={2}
                            checked={enhanceV3Multiplier === 2}
                            onChange={() => setEnhanceV3Multiplier(2)}
                            className="sr-only peer"
                          />
                          <div className="cursor-pointer border-2 rounded-lg p-4 text-center transition-all peer-checked:border-purple-500 peer-checked:bg-purple-100 hover:border-purple-300 border-gray-300">
                            <div className="text-2xl font-bold text-purple-600">2x</div>
                            <div className="text-sm text-gray-600">标准增强</div>
                          </div>
                        </label>
                        <label className="flex-1">
                          <input
                            type="radio"
                            name="multiplier"
                            value={4}
                            checked={enhanceV3Multiplier === 4}
                            onChange={() => setEnhanceV3Multiplier(4)}
                            className="sr-only peer"
                          />
                          <div className="cursor-pointer border-2 rounded-lg p-4 text-center transition-all peer-checked:border-purple-500 peer-checked:bg-purple-100 hover:border-purple-300 border-gray-300">
                            <div className="text-2xl font-bold text-purple-600">4x</div>
                            <div className="text-sm text-gray-600">超清增强</div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Process Button */}
                    <button
                      onClick={async () => {
                        setEnhanceV3Processing(true);
                        setEnhanceV3Error('');

                        try {
                          // Upload all files to R2 first
                          const uploadPromises = enhanceV3Files.map(async (file) => {
                            const formData = new FormData();
                            formData.append('files', file);
                            const response = await fetch('/api/upload', { method: 'POST', body: formData });
                            const data = await response.json();

                            if (!response.ok) {
                              throw new Error(data.error || '上传失败');
                            }

                            const firstUpload = data.uploaded?.[0];
                            if (!firstUpload?.url) {
                              throw new Error('上传结果缺少 URL');
                            }

                            return firstUpload.url as string;
                          });

                          const uploadedUrls = await Promise.all(uploadPromises);

                          // Update results with original URLs
                          setEnhanceV3Results(prev =>
                            prev.map((r, idx) => ({
                              ...r,
                              originalUrl: enhanceV3Previews[idx],
                              status: 'enhancing' as const
                            }))
                          );

                          // Call enhance API
                          const response = await fetch('/api/enhance-ilovepdf', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              images: uploadedUrls.map(url => ({ imageUrl: url })),
                              multiplier: enhanceV3Multiplier
                            })
                          });

                          if (!response.ok) {
                            const errorData = await response.json().catch(() => ({}));
                            throw new Error(errorData.error || '增强失败');
                          }

                          const data = await response.json();

                          // Update results
                          setEnhanceV3Results(data.results.map((r: { success: boolean; originalUrl: string; enhancedUrl?: string; error?: string }, i: number) => ({
                            originalUrl: enhanceV3Previews[i],
                            enhancedUrl: r.enhancedUrl,
                            status: r.success ? 'enhanced' as const : 'error' as const,
                            error: r.error
                          })));

                        } catch (error) {
                          const errorMessage = error instanceof Error ? error.message : 'Processing failed';
                          setEnhanceV3Error(errorMessage);
                          console.error('Enhancement V3 error:', error);
                        } finally {
                          setEnhanceV3Processing(false);
                        }
                      }}
                      disabled={enhanceV3Processing}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                    >
                      {enhanceV3Processing ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>处理中...</span>
                        </div>
                      ) : (
                        `增强图片 (${enhanceV3Files.length} 张 · ${enhanceV3Multiplier}x)`
                      )}
                    </button>

                    {/* Error Message */}
                    {enhanceV3Error && (
                      <div className="p-4 rounded-lg bg-red-100 text-red-800">
                        {enhanceV3Error}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Results Section */}
              {enhanceV3Results.some(r => r.enhancedUrl) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-gray-700">增强结果</h3>
                    <div className="flex gap-2 text-sm">
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                        成功: {enhanceV3Results.filter(r => r.status === 'enhanced').length}
                      </span>
                      {enhanceV3Results.some(r => r.status === 'error') && (
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                          失败: {enhanceV3Results.filter(r => r.status === 'error').length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {enhanceV3Results.map((result, index) => (
                      (result.enhancedUrl || result.error) && (
                        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-gray-700">图片 {index + 1}</h4>
                            {result.status === 'enhanced' && (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                {enhanceV3Multiplier}x 增强
                              </span>
                            )}
                            {result.status === 'error' && (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                                失败
                              </span>
                            )}
                          </div>
                          {result.enhancedUrl ? (
                            <>
                              <div className="grid grid-cols-2 gap-3">
                                {/* Original */}
                                <div>
                                  <p className="text-xs text-gray-500 mb-2">原图</p>
                                  <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                                    <Image
                                      src={result.originalUrl}
                                      alt="Original"
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  </div>
                                </div>
                                {/* Enhanced */}
                                <div>
                                  <p className="text-xs text-gray-500 mb-2">增强后 🔥</p>
                                  <div className="relative w-full h-48 bg-gray-100 rounded-lg overflow-hidden">
                                    <Image
                                      src={result.enhancedUrl}
                                      alt="Enhanced"
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  </div>
                                </div>
                              </div>
                              <a
                                href={result.enhancedUrl}
                                download
                                className="block w-full text-center bg-purple-500 hover:bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                              >
                                下载增强图片
                              </a>
                            </>
                          ) : (
                            <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">
                              {result.error || '增强失败'}
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

          {/* Outfit Generation Auto Tab */}
          {activeTab === 'outfit-gen-auto' && (
            <div className="space-y-8">
              {/* Instructions */}
              <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
                <h3 className="mb-3 text-xl font-bold text-gray-800">🎨 自动换装工作流</h3>
                <div className="space-y-2 text-sm text-gray-700">
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-purple-600">步骤 1:</span>
                    <span>自动去除服装图片背景（Bria API）</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-purple-600">步骤 2:</span>
                    <span>生成详细服装描述（ByteDance Seed AI）</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-purple-600">步骤 3:</span>
                    <span>生成最终换装效果（Nano API + 模特库）</span>
                  </div>
                </div>
              </div>

              {/* Upload Section */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-800">上传服装图片</h3>
                
                <label
                  htmlFor="outfit-gen-auto-upload"
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setOutfitGenAutoDragging(true);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setOutfitGenAutoDragging(false);
                  }}
                  onDrop={handleOutfitGenAutoDrop}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all ${
                    outfitGenAutoDragging
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-300 bg-gray-50 hover:border-purple-400 hover:bg-purple-50'
                  }`}
                >
                  <input
                    id="outfit-gen-auto-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleOutfitGenAutoFileChange}
                    className="hidden"
                  />
                  {outfitGenAutoPreview ? (
                    <div className="relative h-64 w-full">
                      <Image
                        src={outfitGenAutoPreview}
                        alt="服装预览"
                        fill
                        unoptimized
                        className="rounded-lg object-contain"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 text-5xl">📸</div>
                      <p className="mb-1 text-base font-semibold text-gray-700">
                        点击或拖拽上传服装图片
                      </p>
                      <p className="text-sm text-gray-500">支持 JPG、PNG 格式</p>
                    </>
                  )}
                </label>

                {outfitGenAutoFile && (
                  <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <span className="text-sm text-gray-700">
                      {outfitGenAutoFile.name}
                    </span>
                    <button
                      onClick={clearOutfitGenAuto}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      清除
                    </button>
                  </div>
                )}
              </div>

              {/* Character Selection */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-bold text-gray-800">选择模特</h3>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {characterOptions.filter(char => char.image).map((char) => (
                    <button
                      key={char.id}
                      onClick={() => setOutfitGenAutoSelectedCharacter(char.id)}
                      className={`group relative overflow-hidden rounded-xl border-2 transition-all ${
                        outfitGenAutoSelectedCharacter === char.id
                          ? 'border-purple-500 shadow-lg ring-2 ring-purple-300'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="relative aspect-[3/4] w-full">
                        <Image
                          src={char.image || ''}
                          alt={char.label}
                          fill
                          unoptimized
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        <p className="text-xs font-medium text-white">{char.label}</p>
                      </div>
                      {outfitGenAutoSelectedCharacter === char.id && (
                        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-white shadow-md">
                          ✓
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smart Matching Toggle */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">智能穿搭建议</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      AI自动分析并推荐搭配的服装单品（仅供参考）
                    </p>
                  </div>
                  <button
                    onClick={() => setOutfitGenAutoSmartMatchEnabled(!outfitGenAutoSmartMatchEnabled)}
                    className={`relative h-8 w-14 rounded-full transition-colors ${
                      outfitGenAutoSmartMatchEnabled ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                        outfitGenAutoSmartMatchEnabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Image Enhancement Toggle */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">开启图像增强</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      生成完成后自动进行AI图像增强（提升清晰度）
                    </p>
                  </div>
                  <button
                    onClick={() => setOutfitGenAutoEnhanceEnabled(!outfitGenAutoEnhanceEnabled)}
                    className={`relative h-8 w-14 rounded-full transition-colors ${
                      outfitGenAutoEnhanceEnabled ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
                        outfitGenAutoEnhanceEnabled ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              {outfitGenAutoFile && (
                <button
                  onClick={handleOutfitGenAutoGenerate}
                  disabled={outfitGenAutoGenerating}
                  className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:from-purple-500 hover:to-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {outfitGenAutoGenerating ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      <span>生成中...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span>✨</span>
                      <span>一键生成</span>
                    </div>
                  )}
                </button>
              )}

              {/* Error Display */}
              {outfitGenAutoError && (
                <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">⚠️</span>
                    <div>
                      <p className="font-semibold text-red-800">生成失败</p>
                      <p className="mt-1 text-sm text-red-700">{outfitGenAutoError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Progress Steps */}
              {outfitGenAutoGenerating && (
                <div className="space-y-4 rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800">生成进度</h3>
                  
                  {/* Step 1 */}
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
                      outfitGenAutoStepStatus.step1 === 'completed' ? 'bg-green-500' :
                      outfitGenAutoStepStatus.step1 === 'processing' ? 'bg-blue-500' :
                      outfitGenAutoStepStatus.step1 === 'failed' ? 'bg-red-500' :
                      'bg-gray-300'
                    }`}>
                      {outfitGenAutoStepStatus.step1 === 'completed' ? '✓' :
                       outfitGenAutoStepStatus.step1 === 'processing' ? '⏳' :
                       outfitGenAutoStepStatus.step1 === 'failed' ? '✕' : '1'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">去除背景</p>
                      <p className="text-sm text-gray-600">
                        {outfitGenAutoStepStatus.step1 === 'completed' ? '✅ 完成' :
                         outfitGenAutoStepStatus.step1 === 'processing' ? '处理中...' :
                         outfitGenAutoStepStatus.step1 === 'failed' ? '❌ 失败' :
                         '等待中'}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
                      outfitGenAutoStepStatus.step2 === 'completed' ? 'bg-green-500' :
                      outfitGenAutoStepStatus.step2 === 'processing' ? 'bg-blue-500' :
                      outfitGenAutoStepStatus.step2 === 'failed' ? 'bg-red-500' :
                      'bg-gray-300'
                    }`}>
                      {outfitGenAutoStepStatus.step2 === 'completed' ? '✓' :
                       outfitGenAutoStepStatus.step2 === 'processing' ? '⏳' :
                       outfitGenAutoStepStatus.step2 === 'failed' ? '✕' : '2'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">生成描述</p>
                      <p className="text-sm text-gray-600">
                        {outfitGenAutoStepStatus.step2 === 'completed' ? '✅ 完成' :
                         outfitGenAutoStepStatus.step2 === 'processing' ? '处理中...' :
                         outfitGenAutoStepStatus.step2 === 'failed' ? '❌ 失败' :
                         '等待中'}
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex items-start gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
                      outfitGenAutoStepStatus.step3 === 'completed' ? 'bg-green-500' :
                      outfitGenAutoStepStatus.step3 === 'processing' ? 'bg-blue-500' :
                      outfitGenAutoStepStatus.step3 === 'failed' ? 'bg-red-500' :
                      'bg-gray-300'
                    }`}>
                      {outfitGenAutoStepStatus.step3 === 'completed' ? '✓' :
                       outfitGenAutoStepStatus.step3 === 'processing' ? '⏳' :
                       outfitGenAutoStepStatus.step3 === 'failed' ? '✕' : '3'}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-800">生成换装</p>
                      <p className="text-sm text-gray-600">
                        {outfitGenAutoStepStatus.step3 === 'completed' ? '✅ 完成' :
                         outfitGenAutoStepStatus.step3 === 'processing' ? '处理中...' :
                         outfitGenAutoStepStatus.step3 === 'failed' ? '❌ 失败' :
                         '等待中'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results Section */}
              {(outfitGenAutoRemovedBgUrl || outfitGenAutoDescription || outfitGenAutoFinalUrl) && (
                <div className="space-y-6 rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800">生成结果</h3>

                  {/* Step 1 Result: Removed Background */}
                  {outfitGenAutoRemovedBgUrl && (
                    <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                      <h4 className="flex items-center gap-2 font-semibold text-gray-700">
                        <span className="text-green-500">✓</span>
                        <span>步骤 1: 去除背景</span>
                      </h4>
                      <div className="relative h-64 w-full overflow-hidden rounded-lg border border-gray-200">
                        <Image
                          src={outfitGenAutoRemovedBgUrl}
                          alt="去除背景后"
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2 Result: Description + Smart Matching */}
                  {outfitGenAutoDescription && (
                    <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                      <h4 className="flex items-center gap-2 font-semibold text-gray-700">
                        <span className="text-green-500">✓</span>
                        <span>步骤 2: 服装描述</span>
                      </h4>

                      {/* Original Description */}
                      <div className="rounded-lg bg-gray-50 p-4">
                        <p className="text-sm font-semibold text-gray-600 mb-2">服装详情:</p>
                        <p className="text-sm leading-relaxed text-gray-700">
                          {outfitGenAutoDescription}
                        </p>
                      </div>

                      {/* Smart Matching Suggestions */}
                      {outfitGenAutoMatchingSuggestions && (
                        <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 p-4 border-2 border-purple-200">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xl">✨</span>
                            <p className="text-sm font-bold text-purple-800">智能搭配建议:</p>
                          </div>
                          <div className="space-y-2 text-sm text-gray-700">
                            {parseMatchingSuggestions(outfitGenAutoMatchingSuggestions)}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3 Result: Final Image */}
                  {outfitGenAutoFinalUrl && (
                    <div className="space-y-3 rounded-xl border border-gray-200 p-4">
                      <h4 className="flex items-center gap-2 font-semibold text-gray-700">
                        <span className="text-green-500">✓</span>
                        <span>步骤 3: 最终效果</span>
                      </h4>
                      <div className="relative h-96 w-full overflow-hidden rounded-lg border border-gray-200">
                        <Image
                          src={outfitGenAutoFinalUrl}
                          alt="最终换装效果"
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                      <button
                        onClick={() => {
                          const filename = 'outfit-generation-result.png';
                          const downloadUrl = `/api/download?url=${encodeURIComponent(outfitGenAutoFinalUrl)}&filename=${filename}`;
                          const a = document.createElement('a');
                          a.href = downloadUrl;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-green-600 to-blue-600 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-green-500 hover:to-blue-500"
                      >
                        <span>📥</span>
                        <span>下载原图</span>
                      </button>
                    </div>
                  )}

                  {/* Image Enhancement Status */}
                  {outfitGenAutoEnhanceEnabled && outfitGenAutoFinalUrl && (
                    <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50 p-4">
                      <h4 className="flex items-center gap-2 font-semibold text-gray-700">
                        {outfitGenAutoEnhancing ? (
                          <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"></div>
                            <span>图像增强中...</span>
                          </>
                        ) : outfitGenAutoEnhancedUrl ? (
                          <>
                            <span className="text-green-500">✓</span>
                            <span>图像增强完成</span>
                          </>
                        ) : (
                          <>
                            <span className="text-yellow-500">⏳</span>
                            <span>等待增强</span>
                          </>
                        )}
                      </h4>
                      {outfitGenAutoEnhancedUrl && (
                        <>
                          <div className="relative h-96 w-full overflow-hidden rounded-lg border border-purple-200">
                            <Image
                              src={outfitGenAutoEnhancedUrl}
                              alt="增强后效果"
                              fill
                              unoptimized
                              className="object-contain"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const filename = 'outfit-generation-enhanced.png';
                              const downloadUrl = `/api/download?url=${encodeURIComponent(outfitGenAutoEnhancedUrl)}&filename=${filename}`;
                              const a = document.createElement('a');
                              a.href = downloadUrl;
                              a.download = filename;
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-purple-500 hover:to-pink-500"
                          >
                            <span>📥</span>
                            <span>下载增强图</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
      {showAddModelModal && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-60 flex items-center justify-center px-4"
          onClick={handleCloseAddModelModal}
        >
          <div
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">添加模特</h2>
              <button
                onClick={handleCloseAddModelModal}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">模特名字</label>
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                placeholder="例如：emma, david_chen"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-300 outline-none"
              />
              <p className="text-xs text-gray-500">仅支持字母、数字、下划线；将作为 R2 目录名</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">模特图片</label>
              <label
                htmlFor="add-model-file-input"
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-purple-300 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 cursor-pointer hover:bg-purple-100 transition-colors"
              >
                <span className="text-lg">📷</span>
                {newModelFile ? '重新选择模特图片' : '选择模特图片'}
              </label>
              <input
                id="add-model-file-input"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                onChange={handleNewModelFileChange}
                className="hidden"
              />
              <div className="flex items-center justify-between text-xs text-gray-500">
                <p>支持 JPG/PNG/GIF，最大 10MB</p>
                {newModelFile && (
                  <p className="text-gray-600">已选：{newModelFile.name}</p>
                )}
              </div>

              {newModelPreview && (
                <div className="mt-2 rounded-xl border border-gray-200 overflow-hidden relative h-64 w-full">
                  <Image
                    src={newModelPreview}
                    alt="模特预览"
                    fill
                    unoptimized
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {addModelError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {addModelError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleCloseAddModelModal}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleAddModel}
                disabled={addingModel}
                className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-blue-500 px-4 py-2 font-semibold text-white shadow-lg hover:from-purple-500 hover:to-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {addingModel ? '上传中...' : '确认添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
