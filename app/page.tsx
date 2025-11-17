'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
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
  { id: 'qiao_mask', label: 'Qiao with Mask', image: `https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/qiao_mask/frame_1.jpg?v=${IMAGE_VERSION}`, isCustom: false },
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

type TabType = 'outfit-change' | 'scene-pose' | 'model-pose' | 'outfit-change-v2' | 'mimic-reference';

interface ScenePoseSuggestion {
  scene: string;
  pose: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('outfit-change');
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
  const [modelPoseUploadedUrl, setModelPoseUploadedUrl] = useState<string>('');
  const [modelPoseAnalyzing, setModelPoseAnalyzing] = useState(false);
  const [modelPoseAnalysis, setModelPoseAnalysis] = useState<{
    description: string;
    poses: string[];
  } | null>(null);
  const [modelPoseError, setModelPoseError] = useState<string>('');
  const [selectedPoseIndices, setSelectedPoseIndices] = useState<number[]>([]);
  const [modelPoseGenerating, setModelPoseGenerating] = useState(false);
  const [modelPoseGeneratedImages, setModelPoseGeneratedImages] = useState<Array<{poseIndex: number, pose: string, imageUrl: string, status: 'generating' | 'completed' | 'failed', error?: string}>>([]);
  const [modelHoldingPhone, setModelHoldingPhone] = useState(false);
  const [modelWearingMask, setModelWearingMask] = useState(false);

  // Outfit-Change-V2 tab states
  const [outfitV2OriginalFile, setOutfitV2OriginalFile] = useState<File | null>(null);
  const [outfitV2OriginalPreview, setOutfitV2OriginalPreview] = useState<string>('');
  const [outfitV2ExtractedImage, setOutfitV2ExtractedImage] = useState<string | null>(null);
  const [outfitV2ExtractingClothing, setOutfitV2ExtractingClothing] = useState(false);
  const [outfitV2SelectedCharacters, setOutfitV2SelectedCharacters] = useState<string[]>([]);
  const [outfitV2GeneratedImages, setOutfitV2GeneratedImages] = useState<Array<{character: string, characterName: string, imageUrl: string, status: 'generating' | 'completed' | 'failed', error?: string}>>([]);
  const [outfitV2Generating, setOutfitV2Generating] = useState(false);
  const [outfitV2Error, setOutfitV2Error] = useState<string>('');
  const [outfitV2IsDragging, setOutfitV2IsDragging] = useState(false);
  const [outfitV2RecommendMatch, setOutfitV2RecommendMatch] = useState(false);
  const [outfitV2ExtractTopOnly, setOutfitV2ExtractTopOnly] = useState(false);

  // Mimic-Reference tab states
  const [mimicRefFile, setMimicRefFile] = useState<File | null>(null);
  const [mimicRefPreview, setMimicRefPreview] = useState<string>('');
  const [mimicRefUploadedUrl, setMimicRefUploadedUrl] = useState<string>('');
  const [mimicRefAnalyzing, setMimicRefAnalyzing] = useState(false);
  const [mimicRefAnalysis, setMimicRefAnalysis] = useState<{
    sceneDescription: string;
    poseDescription: string;
  } | null>(null);
  const [mimicRefError, setMimicRefError] = useState<string>('');
  const [mimicRefIsDragging, setMimicRefIsDragging] = useState(false);
  const [mimicRefCharacter, setMimicRefCharacter] = useState<string>(DEFAULT_CHARACTER_ID);
  const [mimicRefGenerating, setMimicRefGenerating] = useState(false);
  const [mimicRefGeneratedImage, setMimicRefGeneratedImage] = useState<string | null>(null);

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

    if (!modelPoseUploadedUrl) {
      setModelPoseError('图片未上传');
      return;
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
              originalImageUrl: modelPoseUploadedUrl,
              pose: selectedPose,
              description: modelPoseAnalysis.description,
              holdingPhone: modelHoldingPhone,
              wearingMask: modelWearingMask,
            }),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || 'Task creation failed');
          }

          const { taskId } = await createResponse.json();
          console.log(`Task created for pose ${poseIndex}:`, taskId);

          // 轮询任务状态
          const maxAttempts = 60;
          const pollInterval = 2000;

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
    } catch (error) {
      setModelPoseError(error instanceof Error ? error.message : 'Batch generation failed');
    } finally {
      setModelPoseGenerating(false);
    }
  };

  // Outfit-Change-V2 tab handlers
  const processOutfitV2File = async (file: File) => {
    setOutfitV2OriginalFile(file);
    setOutfitV2Error('');
    setOutfitV2ExtractedImage(null);
    setOutfitV2GeneratedImages([]);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setOutfitV2OriginalPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOutfitV2FileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processOutfitV2File(file);
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
      const file = files[0];
      // Check if it's an image file
      if (file.type.startsWith('image/')) {
        processOutfitV2File(file);
      } else {
        setOutfitV2Error('请上传图片文件（JPEG、PNG、GIF）');
      }
    }
  };

  const handleOutfitV2ExtractClothing = async () => {
    if (!outfitV2OriginalFile) {
      setOutfitV2Error('请先上传图片');
      return;
    }

    setOutfitV2ExtractingClothing(true);
    setOutfitV2Error('');
    setOutfitV2ExtractedImage(null);

    try {
      // Upload to R2 first
      const formData = new FormData();
      formData.append('files', outfitV2OriginalFile);

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('图片上传失败');
      }

      const uploadData = await uploadResponse.json();
      const uploadedUrl = uploadData.uploaded[0].url;

      // Extract clothing using KIE
      const extractResponse = await fetch('/api/extract-clothing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: uploadedUrl,
          recommendMatch: outfitV2RecommendMatch,
          extractTopOnly: outfitV2ExtractTopOnly
        }),
      });

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json();
        throw new Error(errorData.error || '服装提取失败');
      }

      const { taskId } = await extractResponse.json();
      console.log('Extract clothing task created:', taskId);

      // 轮询任务状态
      const maxAttempts = 60;
      const pollInterval = 2000;

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
          setOutfitV2ExtractedImage(statusData.resultUrls[0]);
          console.log('✅ Clothing extraction completed');
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('服装提取失败');
        }
      }

      throw new Error('服装提取超时');
    } catch (error) {
      setOutfitV2Error(error instanceof Error ? error.message : '服装提取失败');
    } finally {
      setOutfitV2ExtractingClothing(false);
    }
  };

  const handleOutfitV2Generate = async () => {
    if (!outfitV2ExtractedImage) {
      setOutfitV2Error('请先提取服装');
      return;
    }

    if (outfitV2SelectedCharacters.length === 0) {
      setOutfitV2Error('请先选择至少一个模特');
      return;
    }

    setOutfitV2Generating(true);
    setOutfitV2Error('');

    // 初始化生成结果数组
    const initialResults = outfitV2SelectedCharacters.map(characterId => {
      const character = characterOptions.find(c => c.id === characterId);
      return {
        character: characterId,
        characterName: character?.label || characterId,
        imageUrl: '',
        status: 'generating' as const,
      };
    });
    setOutfitV2GeneratedImages(initialResults);

    try {
      // 为每个选中的模特创建任务
      const tasks = outfitV2SelectedCharacters.map(async (characterId) => {
        const character = characterOptions.find(c => c.id === characterId);

        try {
          // 调用模特换装V2 API
          const createResponse = await fetch('/api/outfit-change-v2', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              clothingImageUrl: outfitV2ExtractedImage,
              character: characterId,
            }),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.json();
            throw new Error(errorData.error || 'Task creation failed');
          }

          const { taskId } = await createResponse.json();
          console.log(`Outfit change V2 task created for ${character?.label}:`, taskId);

          // 轮询任务状态
          const maxAttempts = 60;
          const pollInterval = 2000;

          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            const statusResponse = await fetch(`/api/task-status?taskId=${taskId}`);

            if (!statusResponse.ok) {
              console.warn('Failed to fetch task status, retrying...');
              continue;
            }

            const statusData = await statusResponse.json();
            console.log(`Task status for ${character?.label} (attempt ${attempt + 1}):`, statusData.status);

            if (statusData.status === 'completed' && statusData.resultUrls?.[0]) {
              // 更新该模特的生成结果
              setOutfitV2GeneratedImages(prev =>
                prev.map(item =>
                  item.character === characterId
                    ? { ...item, imageUrl: statusData.resultUrls[0], status: 'completed' as const }
                    : item
                )
              );
              console.log(`✅ Outfit change V2 completed for ${character?.label}`);
              return { character: characterId, success: true, imageUrl: statusData.resultUrls[0] };
            }

            if (statusData.status === 'failed') {
              throw new Error('模特换装生成失败');
            }
          }

          throw new Error('模特换装生成超时');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '模特换装生成失败';
          console.error(`❌ Error generating outfit change for ${character?.label}:`, errorMessage);

          // 更新该模特的失败状态
          setOutfitV2GeneratedImages(prev =>
            prev.map(item =>
              item.character === characterId
                ? { ...item, status: 'failed' as const, error: errorMessage }
                : item
            )
          );
          return { character: characterId, success: false, error: errorMessage };
        }
      });

      // 等待所有任务完成
      const results = await Promise.all(tasks);
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (failCount > 0) {
        setOutfitV2Error(`批量生成完成：${successCount} 个成功，${failCount} 个失败`);
      }

      console.log('✅ Batch outfit change completed:', { successCount, failCount });
    } catch (error) {
      setOutfitV2Error(error instanceof Error ? error.message : 'Batch outfit change failed');
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
    setOutfitV2OriginalFile(null);
    setOutfitV2OriginalPreview('');
    setOutfitV2ExtractedImage(null);
    setOutfitV2SelectedCharacters([]);
    setOutfitV2GeneratedImages([]);
    setOutfitV2Error('');
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
      // Combine scene and pose descriptions into a prompt
      const prompt = `${mimicRefAnalysis.sceneDescription}\n\n${mimicRefAnalysis.poseDescription}`;

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
      const maxAttempts = 60;
      const pollInterval = 2000;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800 text-center md:text-left">
            AI Fashion Image Generator
          </h1>
          <button
            onClick={handleOpenAddModelModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-500 px-6 py-3 text-white font-semibold shadow-lg hover:from-purple-500 hover:to-blue-400 transition-colors"
          >
            <span className="text-xl">👤</span>
            添加模特
          </button>
        </div>

        {/* Global Header with Tabs */}
        <div className="bg-white rounded-t-lg shadow-lg">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('outfit-change')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === 'outfit-change'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">👗</span>
                <span>模特换装</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('scene-pose')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === 'scene-pose'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">🎭</span>
                <span>更换场景+姿势</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('model-pose')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === 'model-pose'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">💃</span>
                <span>生成模特姿势</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('outfit-change-v2')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === 'outfit-change-v2'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">✨</span>
                <span>模特换装V2</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('mimic-reference')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === 'mimic-reference'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">📸</span>
                <span>模仿参考图片</span>
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
                    开启后，生成的图片中模特将佩戴白色口罩
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
                    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={scenePosePreview}
                        alt="上传的服装图片"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>

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
                  <label
                    htmlFor="model-pose-upload"
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
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
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
                      id="model-pose-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleModelPoseFileChange}
                    />
                  </label>
                ) : (
                  <div className="space-y-4">
                    {/* Image Preview */}
                    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={modelPosePreview}
                        alt="上传的服装图片"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>

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
                            开启后，AI分析和生成的每个姿势都将包含白色口罩
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Analyze Button */}
                    <button
                      onClick={handleModelPoseAnalyze}
                      disabled={modelPoseAnalyzing}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
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
                              <div className="flex gap-2 text-sm">
                                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                                  成功: {modelPoseGeneratedImages.filter(img => img.status === 'completed').length}
                                </span>
                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                                  生成中: {modelPoseGeneratedImages.filter(img => img.status === 'generating').length}
                                </span>
                                {modelPoseGeneratedImages.filter(img => img.status === 'failed').length > 0 && (
                                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                                    失败: {modelPoseGeneratedImages.filter(img => img.status === 'failed').length}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {modelPoseGeneratedImages.map((item, idx) => (
                                <div
                                  key={idx}
                                  className={`border-2 rounded-lg p-4 transition-all ${
                                    item.status === 'completed'
                                      ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
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
                                    {item.status === 'completed' && (
                                      <div className="flex-shrink-0 bg-green-500 rounded-full p-1">
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
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

                                  {item.status === 'completed' && item.imageUrl && (
                                    <div className="relative w-full h-64 bg-gray-100 rounded-lg overflow-hidden">
                                      <Image
                                        src={item.imageUrl}
                                        alt={`姿势 ${item.poseIndex + 1}`}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                      />
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

          {/* Outfit-Change-V2 Tab Content */}
          {activeTab === 'outfit-change-v2' && (
            <div className="space-y-6">
              {/* Step 1: Upload & Extract Clothing */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    步骤 1：上传图片并提取服装
                  </h2>
                  {outfitV2OriginalFile && (
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
                {!outfitV2OriginalFile ? (
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
                          上传包含人物和服装的图片
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        支持 JPEG、PNG、GIF 格式
                      </p>
                    </div>
                    <input
                      id="outfit-v2-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleOutfitV2FileChange}
                    />
                  </label>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Original Image */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                        <span className="text-xl">📸</span>
                        <span>原始图片</span>
                      </h3>
                      <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
                        <Image
                          src={outfitV2OriginalPreview}
                          alt="原始图片"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>

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

                      <button
                        onClick={handleOutfitV2ExtractClothing}
                        disabled={outfitV2ExtractingClothing || !!outfitV2ExtractedImage}
                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                      >
                        {outfitV2ExtractingClothing ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>AI 提取中...</span>
                          </div>
                        ) : outfitV2ExtractedImage ? (
                          '✅ 提取完成'
                        ) : (
                          '提取服装'
                        )}
                      </button>
                    </div>

                    {/* Extracted Clothing */}
                    {outfitV2ExtractedImage && (
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
                          <span className="text-xl">👔</span>
                          <span>提取的服装</span>
                        </h3>
                        <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden border-2 border-green-500">
                          <Image
                            src={outfitV2ExtractedImage}
                            alt="提取的服装"
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                          <p className="text-sm text-green-800 text-center font-medium">
                            ✅ 服装提取成功，可以继续下一步
                          </p>
                        </div>
                      </div>
                    )}
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
              {outfitV2ExtractedImage && (
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
                      步骤 3：生成换装图片
                    </h2>

                    {outfitV2SelectedCharacters.length > 0 ? (
                      <button
                        onClick={handleOutfitV2Generate}
                        disabled={outfitV2Generating}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                      >
                        {outfitV2Generating ? (
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            <span>批量生成中... (共 {outfitV2SelectedCharacters.length} 个)</span>
                          </div>
                        ) : (
                          `批量生成换装图片 (${outfitV2SelectedCharacters.length} 个)`
                        )}
                      </button>
                    ) : (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                        <p className="text-yellow-800 text-sm font-medium">
                          请先选择至少一个模特
                        </p>
                      </div>
                    )}

                    {/* Generated Images Result */}
                    {outfitV2GeneratedImages.length > 0 && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-gray-700">生成结果：</h3>
                          <div className="flex gap-2 text-sm">
                            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full font-medium">
                              成功: {outfitV2GeneratedImages.filter(img => img.status === 'completed').length}
                            </span>
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                              生成中: {outfitV2GeneratedImages.filter(img => img.status === 'generating').length}
                            </span>
                            {outfitV2GeneratedImages.filter(img => img.status === 'failed').length > 0 && (
                              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full font-medium">
                                失败: {outfitV2GeneratedImages.filter(img => img.status === 'failed').length}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {outfitV2GeneratedImages.map((item, idx) => (
                            <div
                              key={idx}
                              className={`border-2 rounded-lg p-4 transition-all ${
                                item.status === 'completed'
                                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
                                  : item.status === 'generating'
                                  ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
                                  : 'bg-gradient-to-br from-red-50 to-pink-50 border-red-200'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-800">{item.characterName}</span>
                                </div>
                                {item.status === 'completed' && (
                                  <div className="flex-shrink-0 bg-green-500 rounded-full p-1">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
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

                              {item.status === 'completed' && item.imageUrl && (
                                <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '9 / 16' }}>
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.characterName}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                  />
                                </div>
                              )}

                              {item.status === 'generating' && (
                                <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: '9 / 16' }}>
                                  <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-500 mx-auto mb-3"></div>
                                    <p className="text-blue-600 font-medium">生成中...</p>
                                  </div>
                                </div>
                              )}

                              {item.status === 'failed' && (
                                <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center" style={{ aspectRatio: '9 / 16' }}>
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
                </>
              )}

              {/* Info Section */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <span className="text-lg">ℹ️</span>
                  <span>工作流程说明：</span>
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                  <li>上传一张包含人物和服装的图片</li>
                  <li>点击&ldquo;提取服装&rdquo;按钮，AI 会自动移除人物，只保留服装</li>
                  <li>从模特库中选择一个目标模特</li>
                  <li>点击&ldquo;生成模特换装图片&rdquo;，AI 会将提取的服装穿到选定的模特身上</li>
                  <li>整个过程使用多图输入技术，确保服装细节和模特特征都得到完整保留</li>
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
                        <span>AI 分析场景和姿势</span>
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
                        <span className="text-xl">🎭</span>
                        <span>场景描述：</span>
                      </h4>
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {mimicRefAnalysis.sceneDescription}
                      </div>
                    </div>

                    {/* Pose Description */}
                    <div className="bg-white rounded-lg p-5 space-y-3">
                      <h4 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <span className="text-xl">💃</span>
                        <span>姿势描述：</span>
                      </h4>
                      <div className="text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-4 border border-gray-200">
                        {mimicRefAnalysis.poseDescription}
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-800 text-center">
                        ✅ 分析完成！您可以使用这些描述在其他工具中重现相似的场景和姿势
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Character Selection and Generate Section */}
              {mimicRefAnalysis && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    选择模特并生成图片
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
                        <span>生成模特图片</span>
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
        </div>
      </div>
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
