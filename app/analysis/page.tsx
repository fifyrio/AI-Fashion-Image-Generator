'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { OutfitSummaryResult } from '@/lib/types';

export default function AnalysisPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<OutfitSummaryResult | null>(null);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

    const droppedFiles = Array.from(e.dataTransfer.files);
    const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      if (imageFiles.length > 10) {
        setError('最多支持10张图片');
        return;
      }
      setFiles(imageFiles);
      const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
      setPreviews(newPreviews);
      setError('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      if (selectedFiles.length > 10) {
        setError('最多支持10张图片');
        return;
      }
      setFiles(selectedFiles);
      const newPreviews = selectedFiles.map(file => URL.createObjectURL(file));
      setPreviews(newPreviews);
      setError('');
    }
  };

  const handleClear = () => {
    setFiles([]);
    setPreviews([]);
    setUploadedUrls([]);
    setResult(null);
    setError('');
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('请先上传图片');
      return;
    }

    setAnalyzing(true);
    setError('');
    setResult(null);

    try {
      // Step 1: Upload all files to R2
      console.log('📤 Uploading images to R2...');
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('files', file);

        const uploadResponse = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const uploadData = await uploadResponse.json();
        return uploadData.uploaded[0].url;
      });

      const urls = await Promise.all(uploadPromises);
      setUploadedUrls(urls);
      console.log('✅ All images uploaded:', urls);

      // Step 2: Call outfit summary analysis API
      console.log('🔍 Analyzing outfit patterns...');
      const analysisResponse = await fetch('/api/outfit-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrls: urls }),
      });

      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(errorData.error || '分析失败');
      }

      const analysisData = await analysisResponse.json();

      if (!analysisData.success) {
        throw new Error(analysisData.error || '分析失败');
      }

      setResult(analysisData.result);
      console.log('✅ Analysis completed:', analysisData.result);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析失败';
      setError(errorMessage);
      console.error('❌ Analysis error:', errorMessage);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 flex items-center gap-3">
            <span className="text-5xl">📊</span>
            <span>爆款穿搭总结</span>
            <span className="px-3 py-1 bg-pink-500 text-white text-sm font-bold rounded-full">AI分析</span>
          </h1>
          <p className="text-gray-600 text-lg">
            上传多张服装图片，AI将自动分析并总结其中的穿搭公式和搭配规律
          </p>
        </div>

        {/* Info Section */}
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-6 border border-pink-200 mb-8">
          <h3 className="font-semibold text-pink-800 mb-3 text-lg">分析内容：</h3>
          <ul className="text-gray-700 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✅</span>
              <span>逐张分析上装、下装、配色和风格</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✅</span>
              <span>提炼3-5个可复用的爆款穿搭公式</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✅</span>
              <span>识别颜色、版型、材质搭配规律</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-1">✅</span>
              <span>提供必备单品和实用搭配建议</span>
            </li>
          </ul>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-semibold text-gray-700">
              上传图片 {files.length > 0 && <span className="text-purple-600">({files.length}/10)</span>}
            </h3>
            {files.length > 0 && (
              <button
                onClick={handleClear}
                className="text-sm text-red-600 hover:text-red-700 font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
              >
                清空图片
              </button>
            )}
          </div>

          {files.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-lg transition-all ${
                isDragging
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <label
                htmlFor="file-upload"
                className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-20 h-20 mb-6 text-gray-400"
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
                  <div className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-semibold py-4 px-10 rounded-lg mb-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-lg">上传图片</span>
                    </div>
                  </div>
                  <p className="text-base text-gray-600 mb-2">点击上传或拖拽图片到此处</p>
                  <p className="text-sm text-gray-400">支持2-10张图片，推荐5-8张获得更好的分析效果</p>
                </div>
              </label>
              <input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Preview Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {previews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <div className="relative w-full h-52 bg-gray-100 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow">
                      <Image
                        src={preview}
                        alt={`Outfit ${index + 1}`}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                      <div className="absolute top-2 left-2 bg-purple-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-gray-600 truncate px-1">
                      {files[index]?.name}
                    </div>
                  </div>
                ))}
              </div>

              {/* Analyze Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className={`px-12 py-5 rounded-xl font-bold text-xl transition-all shadow-lg ${
                    analyzing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:from-pink-600 hover:to-purple-700 hover:shadow-2xl transform hover:scale-105'
                  }`}
                >
                  {analyzing ? (
                    <div className="flex items-center gap-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      <span>分析中...请稍候</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span>🚀</span>
                      <span>开始分析 ({files.length} 张图片)</span>
                    </div>
                  )}
                </button>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 text-center">
                  <span className="font-semibold">错误：</span> {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Section */}
        {result && (
          <div className="space-y-8">
            {/* Overall Summary */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-8 border-2 border-purple-200 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">🎯</span>
                <span>整体风格总结</span>
              </h3>
              <div className="bg-white rounded-xl p-6 space-y-4 shadow-md">
                <div>
                  <span className="font-semibold text-purple-700 text-lg">主导风格：</span>
                  <span className="text-gray-800 ml-3 text-lg">{result.overallSummary.mainStyle}</span>
                </div>
                <div>
                  <span className="font-semibold text-purple-700 text-lg">核心特征：</span>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {result.overallSummary.keyFeatures.map((feature, idx) => (
                      <span key={idx} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-purple-700 text-lg">总体描述：</span>
                  <p className="text-gray-700 mt-3 leading-relaxed text-base">{result.overallSummary.description}</p>
                </div>
              </div>
            </div>

            {/* Individual Analysis */}
            <div className="bg-white rounded-xl p-8 border-2 border-gray-200 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">👗</span>
                <span>逐张分析</span>
              </h3>
              <div className="space-y-6">
                {result.individualAnalysis.map((analysis, idx) => (
                  <div key={idx} className="border-2 border-gray-200 rounded-xl p-6 hover:shadow-xl transition-shadow bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex gap-6">
                      {/* Image Thumbnail */}
                      {analysis.imageUrl && (
                        <div className="relative w-32 h-40 flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden shadow-md">
                          <Image
                            src={analysis.imageUrl}
                            alt={`Outfit ${idx + 1}`}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                          <div className="absolute top-2 left-2 bg-purple-600 text-white text-sm font-bold px-3 py-1 rounded-full">
                            #{idx + 1}
                          </div>
                        </div>
                      )}

                      {/* Analysis Content */}
                      <div className="flex-1 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Top Analysis */}
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <h4 className="font-semibold text-blue-800 mb-3 text-lg">上装</h4>
                            <div className="text-sm space-y-1.5">
                              <p><span className="text-gray-600 font-medium">类型：</span>{analysis.top.type}</p>
                              <p><span className="text-gray-600 font-medium">颜色：</span>{analysis.top.color}</p>
                              <p><span className="text-gray-600 font-medium">材质：</span>{analysis.top.material}</p>
                              <p><span className="text-gray-600 font-medium">版型：</span>{analysis.top.fit}</p>
                              <p><span className="text-gray-600 font-medium">特点：</span>{analysis.top.designFeatures}</p>
                            </div>
                          </div>

                          {/* Bottom Analysis */}
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <h4 className="font-semibold text-green-800 mb-3 text-lg">下装</h4>
                            <div className="text-sm space-y-1.5">
                              <p><span className="text-gray-600 font-medium">类型：</span>{analysis.bottom.type}</p>
                              <p><span className="text-gray-600 font-medium">颜色：</span>{analysis.bottom.color}</p>
                              <p><span className="text-gray-600 font-medium">材质：</span>{analysis.bottom.material}</p>
                              <p><span className="text-gray-600 font-medium">版型：</span>{analysis.bottom.fit}</p>
                              <p><span className="text-gray-600 font-medium">特点：</span>{analysis.bottom.designFeatures}</p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                          <p className="text-sm"><span className="font-semibold text-yellow-800">配色：</span>{analysis.colorScheme}</p>
                        </div>

                        <div>
                          <div className="flex flex-wrap gap-2">
                            {analysis.styleTags.map((tag, tagIdx) => (
                              <span key={tagIdx} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm font-medium">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>

                        <p className="text-sm text-gray-700 italic bg-gray-50 p-3 rounded-lg">{analysis.summary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Outfit Formulas */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-8 border-2 border-yellow-200 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">🔥</span>
                <span>爆款穿搭公式</span>
              </h3>
              <div className="space-y-6">
                {result.outfitFormulas.map((formula, idx) => (
                  <div key={idx} className="bg-white rounded-xl p-6 border-2 border-orange-200 shadow-md hover:shadow-xl transition-shadow">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-orange-500 to-red-500 text-white font-bold rounded-full flex items-center justify-center text-lg shadow-lg">
                        {idx + 1}
                      </div>
                      <div className="flex-1 space-y-4">
                        <h4 className="text-xl font-bold text-orange-800">{formula.formulaName}</h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <p className="text-sm font-semibold text-blue-800 mb-2">上装模式</p>
                            <p className="text-sm text-gray-700">{formula.topPattern}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <p className="text-sm font-semibold text-green-800 mb-2">下装模式</p>
                            <p className="text-sm text-gray-700">{formula.bottomPattern}</p>
                          </div>
                        </div>

                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                          <p className="text-sm font-semibold text-purple-800 mb-2">搭配原则</p>
                          <p className="text-sm text-gray-700">{formula.matchingPrinciple}</p>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex-1">
                            <span className="font-semibold text-pink-700">风格效果：</span>
                            <span className="text-gray-700 ml-2">{formula.styleEffect}</span>
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold text-indigo-700">适用场景：</span>
                            <span className="text-gray-700 ml-2">{formula.suitableScenes.join('、')}</span>
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 italic bg-gray-50 p-2 rounded">{formula.examples}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Patterns */}
            <div className="bg-white rounded-xl p-8 border-2 border-gray-200 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">🔍</span>
                <span>共同搭配规律</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Color Patterns */}
                <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                  <h4 className="font-semibold text-red-800 mb-4 text-lg">颜色规律</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">高频配色：</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {result.commonPatterns.colorPatterns.frequentCombos.map((combo, idx) => (
                          <span key={idx} className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                            {combo}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p><span className="font-medium text-gray-700">配色手法：</span>{result.commonPatterns.colorPatterns.coloringTechniques}</p>
                    <p><span className="font-medium text-gray-700">比例原则：</span>{result.commonPatterns.colorPatterns.colorRatios}</p>
                  </div>
                </div>

                {/* Fit Patterns */}
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-4 text-lg">版型规律</h4>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-medium text-gray-700">上下平衡：</span>{result.commonPatterns.fitPatterns.topBottomBalance}</p>
                    <p><span className="font-medium text-gray-700">轮廓规律：</span>{result.commonPatterns.fitPatterns.silhouetteRules}</p>
                  </div>
                </div>

                {/* Material Patterns */}
                <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-4 text-lg">材质规律</h4>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-medium text-gray-700">材质对比：</span>{result.commonPatterns.materialPatterns.contrastUsage}</p>
                    <p><span className="font-medium text-gray-700">材质呼应：</span>{result.commonPatterns.materialPatterns.materialEchoes}</p>
                  </div>
                </div>

                {/* Style Patterns */}
                <div className="bg-purple-50 rounded-xl p-5 border border-purple-200">
                  <h4 className="font-semibold text-purple-800 mb-4 text-lg">风格规律</h4>
                  <div className="space-y-3 text-sm">
                    <p><span className="font-medium text-gray-700">主导风格：</span>{result.commonPatterns.stylePatterns.dominantStyle}</p>
                    <p><span className="font-medium text-gray-700">混搭技巧：</span>{result.commonPatterns.stylePatterns.mixingTechniques}</p>
                  </div>
                </div>
              </div>

              {/* Frequent Items */}
              <div className="mt-6 bg-yellow-50 rounded-xl p-5 border border-yellow-200">
                <h4 className="font-semibold text-yellow-800 mb-3 text-lg">高频单品</h4>
                <div className="flex flex-wrap gap-2">
                  {result.commonPatterns.frequentItems.map((item, idx) => (
                    <span key={idx} className="px-4 py-2 bg-yellow-200 text-yellow-800 rounded-full text-sm font-medium">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Practical Advice */}
            <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-8 border-2 border-green-200 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                <span className="text-3xl">💡</span>
                <span>实用建议</span>
              </h3>

              <div className="space-y-6">
                {/* Must-Have Items */}
                <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm">
                  <h4 className="font-semibold text-green-800 mb-4 text-lg">必备单品推荐</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {result.practicalAdvice.mustHaveItems.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm bg-green-50 p-3 rounded-lg">
                        <span className="text-green-600 font-bold text-lg">✓</span>
                        <span className="text-gray-700">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Color Recommendations */}
                <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
                  <h4 className="font-semibold text-blue-800 mb-4 text-lg">配色方案推荐</h4>
                  <div className="space-y-3">
                    {result.practicalAdvice.colorSchemeRecommendations.map((scheme, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm bg-blue-50 p-3 rounded-lg">
                        <span className="text-blue-600 font-bold text-base">{idx + 1}.</span>
                        <span className="text-gray-700">{scheme}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Common Mistakes */}
                <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm">
                  <h4 className="font-semibold text-red-800 mb-4 text-lg">避坑指南</h4>
                  <div className="space-y-3">
                    {result.practicalAdvice.commonMistakes.map((mistake, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm bg-red-50 p-3 rounded-lg">
                        <span className="text-red-600 font-bold text-lg">✗</span>
                        <span className="text-gray-700">{mistake}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advanced Tips */}
                <div className="bg-white rounded-xl p-6 border border-purple-200 shadow-sm">
                  <h4 className="font-semibold text-purple-800 mb-4 text-lg">进阶技巧</h4>
                  <div className="space-y-3">
                    {result.practicalAdvice.advancedTips.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-3 text-sm bg-purple-50 p-3 rounded-lg">
                        <span className="text-purple-600 font-bold text-lg">★</span>
                        <span className="text-gray-700">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
