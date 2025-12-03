# 批量图片增强功能说明

## 功能概述

已成功添加批量图片增强功能，支持一次性上传和增强多张图片。

## 实现内容

### 1. 后端 API

#### 新增批量增强 API 路由
- **路径**: `/api/enhance-images-batch`
- **方法**: POST
- **超时时间**: 300秒 (5分钟)
- **功能**: 并行处理多张图片的增强请求

#### 请求格式
```json
{
  "images": [
    {
      "imageUrl": "https://example.com/image1.jpg"
    },
    {
      "imageUrl": "https://example.com/image2.jpg"
    }
  ],
  "enhanceModel": "Low Resolution V2",
  "outputFormat": "jpg",
  "upscaleFactor": "6x",
  "faceEnhancement": true,
  "subjectDetection": "Foreground",
  "faceEnhancementStrength": 0.8,
  "faceEnhancementCreativity": 0.5
}
```

#### 响应格式
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "originalUrl": "https://example.com/image1.jpg",
      "enhancedUrl": "https://r2.example.com/enhanced1.jpg"
    },
    {
      "success": false,
      "originalUrl": "https://example.com/image2.jpg",
      "error": "增强失败原因"
    }
  ],
  "summary": {
    "total": 2,
    "success": 1,
    "failed": 1
  }
}
```

### 2. 前端界面

#### 模式切换
- **单张增强模式**: 保留原有的单张图片增强功能
- **批量增强模式**: 新增的批量处理模式

#### 批量增强功能
1. **批量上传**
   - 支持一次选择多张图片
   - 自动上传到 R2 存储
   - 实时显示每张图片的上传状态

2. **状态管理**
   每张图片有以下状态：
   - `pending`: 待上传
   - `uploading`: 上传中
   - `uploaded`: 已上传（可以开始增强）
   - `enhancing`: 增强中
   - `enhanced`: 已增强（显示增强后的图片）
   - `error`: 失败（显示错误信息）

3. **批量操作**
   - **选择图片**: 点击"选择图片"按钮，支持多选
   - **清空列表**: 一键清空所有已上传的图片
   - **删除单张**: 删除列表中的任意一张图片
   - **批量增强**: 对所有已上传的图片进行批量增强
   - **下载结果**: 每张增强成功的图片都可以单独下载

4. **UI 展示**
   - 网格布局展示所有图片
   - 彩色状态标签（待上传/上传中/已上传/增强中/已增强/失败）
   - 预览图（上传前显示原图，增强后显示增强图）
   - 快捷操作按钮（下载、删除）

## 使用方法

### 批量增强流程

1. **切换到批量增强模式**
   - 打开"图像画质增强"标签页
   - 点击"批量增强"按钮切换模式

2. **上传图片**
   - 点击"选择图片"按钮
   - 在文件选择器中选择多张图片（支持 Ctrl/Cmd + 多选）
   - 系统会自动逐一上传图片到 R2

3. **配置增强参数**
   - 选择增强模型（Low Resolution V2 或 Standard V1）
   - 设置放大倍数（2x, 4x, 6x）
   - 开启/关闭面部增强
   - 调整面部增强强度和创意度

4. **开始批量增强**
   - 确认所有图片都已上传完成（状态为"已上传"）
   - 点击"批量增强 (N 张)"按钮
   - 系统会并行处理所有图片
   - 等待处理完成

5. **查看和下载结果**
   - 增强成功的图片会显示增强后的预览
   - 点击下载图标可以单独下载每张图片
   - 失败的图片会显示错误信息

## 技术特性

### 性能优化
- **并行处理**: 所有图片同时发送到 Replicate API 并行处理
- **异步上传**: 图片上传到 R2 是异步进行的
- **状态追踪**: 每张图片独立追踪状态，互不影响

### 错误处理
- 单张图片失败不影响其他图片的处理
- 详细的错误信息显示
- 支持部分成功的场景

### 用户体验
- 实时状态更新
- 清晰的进度指示
- 灵活的批量操作
- 便捷的结果下载

## 环境变量

确保配置了以下环境变量：

```env
REPLICATE_API_TOKEN=your_replicate_api_token
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_BASE_URL=https://your-r2-public-url
```

## 注意事项

1. **API 限制**
   - Replicate API 可能有并发限制
   - 建议分批处理大量图片（每批 10-20 张）

2. **超时设置**
   - 批量 API 超时时间为 5 分钟
   - 如需处理更多图片，可能需要调整超时配置

3. **成本考虑**
   - 每次增强都会消耗 Replicate API 的 credits
   - 建议根据实际需求选择合适的放大倍数

4. **存储空间**
   - 增强后的图片会存储在 R2
   - 注意 R2 的存储空间和流量使用

## 后续优化建议

1. **进度显示**: 添加整体进度条，显示批量处理的总体进度
2. **断点续传**: 支持处理中断后继续处理未完成的图片
3. **批量下载**: 添加一键下载所有增强图片的功能（打包为 ZIP）
4. **任务队列**: 对于大量图片，使用任务队列分批处理
5. **预览对比**: 支持原图与增强图的对比查看
