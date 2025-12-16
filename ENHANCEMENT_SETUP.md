# Image Enhancement Setup Guide

This guide explains how to set up and use the local Python image enhancement service with the model-pose tab.

## Overview

The model-pose tab now supports automatic image enhancement using a local Python service that combines:
- **GFPGAN**: Face restoration and enhancement
- **Real-ESRGAN**: Super-resolution image upscaling

## Prerequisites

1. Python image enhancement service running (see `/Users/wuwei/Documents/nodejs/image-enhance/API_GUIDE.md`)
2. Next.js development server running

## Setup Steps

### 1. Start the Python Enhancement Service

```bash
cd /Users/wuwei/Documents/nodejs/image-enhance
./start-server.sh
```

Or manually:

```bash
cd /Users/wuwei/Documents/nodejs/image-enhance
source venv/bin/activate
python server.py
```

The service should start at `http://localhost:8000`

### 2. Configure Environment Variables

Create or update `.env.local`:

```bash
# Optional - defaults to http://localhost:8000 if not set
IMAGE_ENHANCE_API_URL=http://localhost:8000
```

### 3. Start Next.js Development Server

```bash
npm run dev
```

## How to Use

1. Navigate to the **模特姿势** (Model Pose) tab
2. Upload a clothing image
3. Enable **自动图像增强** (Auto Image Enhancement) toggle
4. Click **开始 AI 分析** to analyze and generate poses
5. Select poses and click **批量生成图片**
6. The system will:
   - Generate images using KIE API
   - Automatically enhance each successful generation
   - Upload enhanced images to R2 storage

## Enhancement Process

For each generated image:

1. **Download**: Fetch the generated image from R2
2. **Enhance**: Send to Python service (`/api/enhance-local`)
   - Face restoration with GFPGAN
   - Super-resolution with Real-ESRGAN
3. **Upload**: Store enhanced image back to R2
4. **Display**: Show both original and enhanced versions

## API Endpoints

### Health Check

```bash
curl http://localhost:3000/api/enhance-local
```

Expected response:
```json
{
  "status": "ok",
  "message": "Image Enhancement API is running"
}
```

### Manual Enhancement Test

```bash
curl -X POST http://localhost:3000/api/enhance-local \
  -F "file=@test-image.jpg"
```

## Troubleshooting

### Python Service Not Running

**Error**: `Cannot connect to enhancement service`

**Solution**: Start the Python service:
```bash
cd /Users/wuwei/Documents/nodejs/image-enhance
./start-server.sh
```

### Wrong Port

**Error**: `Enhancement service unavailable`

**Solution**: Check if the service is running on the correct port:
```bash
curl http://localhost:8000/health
```

If it's running on a different port, update `IMAGE_ENHANCE_API_URL` in `.env.local`

### Enhancement Timeout

**Error**: `Enhancement failed`

**Possible causes**:
- Image too large (>10MB)
- Service processing timeout (>5 minutes)
- Out of memory

**Solution**:
- Resize large images before uploading
- Monitor Python service logs for errors

### Images Not Enhanced

**Check**:
1. Ensure the toggle **自动图像增强** is enabled
2. Check browser console for errors
3. Verify Python service is running: `curl http://localhost:8000/health`
4. Check Next.js server logs for API errors

## Features

### Auto-Enhancement
- Enabled by default on the model-pose tab
- Processes all successfully generated images
- Shows progress status for each image:
  - 🔄 `generating` - Creating image
  - ⚙️ `enhancing` - Enhancement in progress
  - ✅ `enhanced` - Successfully enhanced
  - ❌ `failed` - Generation or enhancement failed

### Image Comparison
- Original images are always preserved
- Enhanced images are displayed alongside originals
- Both versions can be downloaded separately

## Performance Notes

- Enhancement adds ~10-30 seconds per image
- Batch processing runs enhancements in parallel
- R2 storage used for both original and enhanced images
- No local file storage required

## Development

### Testing the API

Test the proxy endpoint:

```bash
# Upload a test image
curl -X POST http://localhost:3000/api/enhance-local \
  -F "file=@test.jpg" \
  | jq
```

Expected response:
```json
{
  "success": true,
  "message": "Image enhanced successfully",
  "downloadUrl": "http://localhost:8000/api/download/abc123_test_enhanced.png",
  "filename": "abc123_test_enhanced.png",
  "skipEsrgan": false
}
```

### Monitoring

Watch Next.js logs:
```bash
npm run dev
```

Watch Python service logs:
```bash
cd /Users/wuwei/Documents/nodejs/image-enhance
tail -f server.log
```

## References

- [Python API Guide](/Users/wuwei/Documents/nodejs/image-enhance/API_GUIDE.md)
- [GFPGAN Documentation](https://github.com/TencentARC/GFPGAN)
- [Real-ESRGAN Documentation](https://github.com/xinntao/Real-ESRGAN)
