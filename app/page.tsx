'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { UploadedReference } from '@/lib/types';
import type { GeneratedImageSummary } from '@/lib/pipeline';

interface CharacterOption {
  id: string;
  label: string;
  image?: string;
}

const CHARACTER_OPTIONS: CharacterOption[] = [
  { id: 'lin', label: 'Lin', image: 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/lin/frame_1.jpg' },
  { id: 'Qiao', label: 'Qiao', image: 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/Qiao/frame_1.jpg' },
  { id: 'qiao_mask', label: 'Qiao with Mask', image: 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/qiao_mask/frame_1.jpg' },
  { id: 'mature_woman', label: 'Mature Woman', image: 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/mature_woman/frame_1.jpg' }
];

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

type TabType = 'outfit-change' | 'scene-pose' | 'model-pose' | 'extract-clothing' | 'outfit-change-v2';

interface ScenePoseSuggestion {
  scene: string;
  pose: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('outfit-change');
  const [filesWithStatus, setFilesWithStatus] = useState<FileWithStatus[]>([]);
  const [character, setCharacter] = useState<string>(CHARACTER_OPTIONS[0].id);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [mockProgress, setMockProgress] = useState(0);
  const [extractTopOnly, setExtractTopOnly] = useState(false);
  const [wearMask, setWearMask] = useState(false);
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
  const [selectedPoseIndex, setSelectedPoseIndex] = useState<number | null>(null);
  const [modelPoseGenerating, setModelPoseGenerating] = useState(false);
  const [modelPoseGeneratedImage, setModelPoseGeneratedImage] = useState<string | null>(null);
  const [modelHoldingPhone, setModelHoldingPhone] = useState(false);

  // Extract-Clothing tab states
  const [extractClothingFile, setExtractClothingFile] = useState<File | null>(null);
  const [extractClothingPreview, setExtractClothingPreview] = useState<string>('');
  const [extractClothingGenerating, setExtractClothingGenerating] = useState(false);
  const [extractClothingGeneratedImage, setExtractClothingGeneratedImage] = useState<string | null>(null);
  const [extractClothingError, setExtractClothingError] = useState<string>('');

  // Outfit-Change-V2 tab states
  const [outfitV2OriginalFile, setOutfitV2OriginalFile] = useState<File | null>(null);
  const [outfitV2OriginalPreview, setOutfitV2OriginalPreview] = useState<string>('');
  const [outfitV2ExtractedImage, setOutfitV2ExtractedImage] = useState<string | null>(null);
  const [outfitV2ExtractingClothing, setOutfitV2ExtractingClothing] = useState(false);
  const [outfitV2Character, setOutfitV2Character] = useState<string>(CHARACTER_OPTIONS[0].id);
  const [outfitV2GeneratedImage, setOutfitV2GeneratedImage] = useState<string | null>(null);
  const [outfitV2Generating, setOutfitV2Generating] = useState(false);
  const [outfitV2Error, setOutfitV2Error] = useState<string>('');

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
      setScenePoseError('Please select an image first');
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
        throw new Error('Failed to upload image');
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
        throw new Error(errorData.error || 'Analysis failed');
      }

      const result = await analyzeResponse.json();
      setScenePoseAnalysis(result);
      setSelectedSuggestionIndex(null);
      setScenePoseGeneratedImage(null);
    } catch (error) {
      setScenePoseError(error instanceof Error ? error.message : 'Analysis failed');
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
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      setScenePoseGeneratedImage(result.imageUrl);
    } catch (error) {
      setScenePoseError(error instanceof Error ? error.message : 'Generation failed');
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
        body: JSON.stringify({ imageUrl: uploadedUrl }),
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
    setSelectedPoseIndex(null);
    setModelPoseGeneratedImage(null);
  };

  const handleModelPoseGenerate = async () => {
    if (selectedPoseIndex === null || !modelPoseAnalysis) {
      setModelPoseError('请先选择一个姿势');
      return;
    }

    if (!modelPoseUploadedUrl) {
      setModelPoseError('图片未上传');
      return;
    }

    setModelPoseGenerating(true);
    setModelPoseError('');
    setModelPoseGeneratedImage(null);

    try {
      const selectedPose = modelPoseAnalysis.poses[selectedPoseIndex];

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
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Task creation failed');
      }

      const { taskId } = await createResponse.json();
      console.log('Task created:', taskId);

      // 轮询任务状态
      const maxAttempts = 60; // 最多轮询 60 次
      const pollInterval = 2000; // 每 2 秒轮询一次

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
          setModelPoseGeneratedImage(statusData.resultUrls[0]);
          console.log('✅ Image generation completed');
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('Image generation failed');
        }
      }

      throw new Error('Image generation timeout');
    } catch (error) {
      setModelPoseError(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setModelPoseGenerating(false);
    }
  };

  // Extract-Clothing tab handlers
  const handleExtractClothingFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExtractClothingFile(file);
    setExtractClothingError('');
    setExtractClothingGeneratedImage(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setExtractClothingPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleExtractClothing = async () => {
    if (!extractClothingFile) {
      setExtractClothingError('请先上传图片');
      return;
    }

    setExtractClothingGenerating(true);
    setExtractClothingError('');
    setExtractClothingGeneratedImage(null);

    try {
      // Upload to R2 first
      const formData = new FormData();
      formData.append('files', extractClothingFile);

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
        body: JSON.stringify({ imageUrl: uploadedUrl }),
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
          setExtractClothingGeneratedImage(statusData.resultUrls[0]);
          console.log('✅ Clothing extraction completed');
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('服装提取失败');
        }
      }

      throw new Error('服装提取超时');
    } catch (error) {
      setExtractClothingError(error instanceof Error ? error.message : '服装提取失败');
    } finally {
      setExtractClothingGenerating(false);
    }
  };

  const clearExtractClothing = () => {
    setExtractClothingFile(null);
    setExtractClothingPreview('');
    setExtractClothingGeneratedImage(null);
    setExtractClothingError('');
  };

  // Outfit-Change-V2 tab handlers
  const handleOutfitV2FileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOutfitV2OriginalFile(file);
    setOutfitV2Error('');
    setOutfitV2ExtractedImage(null);
    setOutfitV2GeneratedImage(null);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setOutfitV2OriginalPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
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
        body: JSON.stringify({ imageUrl: uploadedUrl }),
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

    setOutfitV2Generating(true);
    setOutfitV2Error('');
    setOutfitV2GeneratedImage(null);

    try {
      // 调用模特换装V2 API
      const createResponse = await fetch('/api/outfit-change-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clothingImageUrl: outfitV2ExtractedImage,
          character: outfitV2Character,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || 'Task creation failed');
      }

      const { taskId } = await createResponse.json();
      console.log('Outfit change V2 task created:', taskId);

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
          setOutfitV2GeneratedImage(statusData.resultUrls[0]);
          console.log('✅ Outfit change V2 completed');
          return;
        }

        if (statusData.status === 'failed') {
          throw new Error('模特换装生成失败');
        }
      }

      throw new Error('模特换装生成超时');
    } catch (error) {
      setOutfitV2Error(error instanceof Error ? error.message : '模特换装生成失败');
    } finally {
      setOutfitV2Generating(false);
    }
  };

  const clearOutfitV2 = () => {
    setOutfitV2OriginalFile(null);
    setOutfitV2OriginalPreview('');
    setOutfitV2ExtractedImage(null);
    setOutfitV2GeneratedImage(null);
    setOutfitV2Error('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          AI Fashion Image Generator
        </h1>

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
              onClick={() => setActiveTab('extract-clothing')}
              className={`flex-1 px-6 py-4 text-lg font-semibold transition-all ${
                activeTab === 'extract-clothing'
                  ? 'text-purple-700 border-b-2 border-purple-700 bg-purple-50'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">👔</span>
                <span>提取服装</span>
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
              {CHARACTER_OPTIONS.map(({ id, label, image }) => {
                const isActive = character === id;
                return (
                  <button
                    key={id}
                    onClick={() => setCharacter(id)}
                    className={`rounded-xl border-2 transition-all text-left pb-3 ${
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
                          priority={id === 'ayi'}
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
                          <h3 className="text-xl font-semibold text-gray-700 flex items-center gap-2">
                            <span className="text-2xl">💃</span>
                            <span>模特姿势建议 ({modelPoseAnalysis.poses.length} 个) - 点击选择</span>
                          </h3>
                          <div className="space-y-3">
                            {modelPoseAnalysis.poses.map((pose, index) => (
                              <button
                                key={index}
                                onClick={() => setSelectedPoseIndex(index)}
                                className={`w-full bg-gradient-to-br from-purple-50 to-pink-50 border-2 rounded-lg p-4 transition-all text-left ${
                                  selectedPoseIndex === index
                                    ? 'border-purple-500 shadow-lg ring-2 ring-purple-300'
                                    : 'border-purple-200 hover:border-purple-400 hover:shadow-md'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm text-gray-700 leading-relaxed">
                                      {pose}
                                    </p>
                                  </div>
                                  {selectedPoseIndex === index && (
                                    <div className="flex-shrink-0 bg-purple-500 rounded-full p-1">
                                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Generate Button */}
                        {selectedPoseIndex !== null && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <button
                              onClick={handleModelPoseGenerate}
                              disabled={modelPoseGenerating}
                              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                            >
                              {modelPoseGenerating ? (
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
                        {modelPoseGeneratedImage && (
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                            <h3 className="text-xl font-semibold text-gray-700 mb-3">生成的图片：</h3>
                            <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                              <Image
                                src={modelPoseGeneratedImage}
                                alt="生成的模特姿势图片"
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

          {/* Extract-Clothing Tab Content */}
          {activeTab === 'extract-clothing' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold text-gray-700">
                    上传图片提取服装
                  </h2>
                  {extractClothingFile && (
                    <button
                      onClick={clearExtractClothing}
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
                {!extractClothingFile ? (
                  <label
                    htmlFor="extract-clothing-upload"
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
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold py-3 px-8 rounded-lg mb-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                          上传包含模特的图片
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        支持 JPEG、PNG、GIF 格式
                      </p>
                    </div>
                    <input
                      id="extract-clothing-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleExtractClothingFileChange}
                    />
                  </label>
                ) : (
                  <div className="space-y-4">
                    {/* Image Preview */}
                    <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                      <Image
                        src={extractClothingPreview}
                        alt="上传的图片"
                        fill
                        className="object-contain"
                        unoptimized
                      />
                    </div>

                    {/* Extract Button */}
                    <button
                      onClick={handleExtractClothing}
                      disabled={extractClothingGenerating}
                      className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                    >
                      {extractClothingGenerating ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>AI 提取中...</span>
                        </div>
                      ) : (
                        'AI 提取服装'
                      )}
                    </button>

                    {/* Error Message */}
                    {extractClothingError && (
                      <div className="p-4 rounded-lg bg-red-100 text-red-800">
                        {extractClothingError}
                      </div>
                    )}

                    {/* Generated Image Result */}
                    {extractClothingGeneratedImage && (
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4">
                        <h3 className="text-xl font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <span className="text-2xl">✨</span>
                          <span>提取的服装：</span>
                        </h3>
                        <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={extractClothingGeneratedImage}
                            alt="提取的服装"
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div className="mt-4 bg-white p-3 rounded-lg">
                          <p className="text-sm text-gray-600">
                            已成功提取服装，模特已被移除
                          </p>
                        </div>
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
                    <h2 className="text-2xl font-semibold text-gray-700">
                      步骤 2：选择模特
                    </h2>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {CHARACTER_OPTIONS.map(({ id, label, image }) => {
                        const isActive = outfitV2Character === id;
                        return (
                          <button
                            key={id}
                            onClick={() => setOutfitV2Character(id)}
                            className={`rounded-xl border-2 transition-all text-left pb-3 ${
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
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h2 className="text-2xl font-semibold text-gray-700">
                      步骤 3：生成换装图片
                    </h2>

                    <button
                      onClick={handleOutfitV2Generate}
                      disabled={outfitV2Generating}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:scale-100"
                    >
                      {outfitV2Generating ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          <span>AI 生成中...</span>
                        </div>
                      ) : (
                        '生成模特换装图片'
                      )}
                    </button>

                    {/* Generated Image Result */}
                    {outfitV2GeneratedImage && (
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-500 rounded-lg p-6">
                        <h3 className="text-xl font-semibold text-gray-700 mb-4 flex items-center gap-2">
                          <span className="text-2xl">✨</span>
                          <span>生成的换装图片：</span>
                        </h3>
                        <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden">
                          <Image
                            src={outfitV2GeneratedImage}
                            alt="生成的换装图片"
                            fill
                            className="object-contain"
                            unoptimized
                          />
                        </div>
                        <div className="mt-4 bg-white p-4 rounded-lg">
                          <p className="text-sm text-gray-600 text-center">
                            ✅ 模特换装完成！服装已成功穿到选定的模特身上
                          </p>
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
        </div>
      </div>
    </div>
  );
}
