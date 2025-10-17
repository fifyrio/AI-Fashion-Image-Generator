'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
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
  { id: 'lin_home_1', label: 'Lin Home 1', image: 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/lin_home_1/frame_1.png' },
  {
    id: 'ayi',
    label: 'Ayi',
    image:
      'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev/ayi/frame_1.jpg',
  },
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

export default function Home() {
  const [filesWithStatus, setFilesWithStatus] = useState<FileWithStatus[]>([]);
  const [character, setCharacter] = useState<string>(CHARACTER_OPTIONS[0].id);
  const [generating, setGenerating] = useState(false);
  const [generateStatus, setGenerateStatus] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

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

        setGeneratedImages(mapped);
      }
    } catch (error) {
      console.error('Error fetching generated images:', error);
    }
  };

  useEffect(() => {
    fetchGeneratedImages();
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

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character,
          uploads: uploadedFiles.map(f => f.uploadedInfo),
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
      } else {
        setGenerateStatus(`Generation failed: ${data.error ?? 'Unknown error'}`);
      }
    } catch (error) {
      setGenerateStatus(`Generation error: ${error}`);
    } finally {
      setGenerating(false);
    }
  };

  const uploadedCount = filesWithStatus.filter(f => f.status === 'uploaded').length;
  const uploadingCount = filesWithStatus.filter(f => f.status === 'uploading').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          AI Fashion Image Generator
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-8 space-y-6">
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
                    <div className="p-3 bg-white space-y-2">
                      {image.xiaohongshuTitle && (
                        <div className="bg-gradient-to-r from-pink-50 to-red-50 p-3 rounded-lg border border-pink-200">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">📝</span>
                            <span className="text-xs font-semibold text-pink-600">小红书标题</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                            {image.xiaohongshuTitle}
                          </p>
                        </div>
                      )}
                      {image.analysis && (
                        <div className="bg-gray-50 border border-gray-200 p-2 rounded-md">
                          <p className="text-xs text-gray-600 whitespace-pre-line leading-relaxed">
                            {image.analysis}
                          </p>
                        </div>
                      )}
                      {image.source?.filename && (
                        <p className="text-xs text-gray-500">
                          Source: <span className="break-all">{image.source.filename}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-600 truncate font-medium">
                        {image.imageKey}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(image.createdAt).toLocaleString()}
                      </p>
                    </div>
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
              <li>Select a character model (lin, Qiao, lin_home_1, or ayi)</li>
              <li>Click Generate to create AI-powered fashion images</li>
              <li>The service analyzes your reference images and generates new outfits</li>
              <li>Download generated images with Xiaohongshu-ready titles</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
