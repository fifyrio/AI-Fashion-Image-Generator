import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { Readable } from 'stream';

export const maxDuration = 60;

interface ImageItem {
  poseIndex: number;
  imageUrl: string;
  enhancedUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { images, dirName } = await request.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: 'No images provided' },
        { status: 400 }
      );
    }

    console.log(`📦 Starting ZIP creation for ${images.length} images...`);
    console.log(`📁 Directory name: ${dirName}`);

    // 创建 ZIP 归档
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });

    // 收集下载统计
    let successCount = 0;
    let failedCount = 0;
    const failedImages: number[] = [];

    // 下载所有图片并添加到 ZIP
    for (const item of images as ImageItem[]) {
      try {
        // 优先使用增强后的图片
        const imageUrl = item.enhancedUrl || item.imageUrl;

        if (!imageUrl) {
          console.error(`图片 ${item.poseIndex + 1} 没有有效的URL`);
          failedCount++;
          failedImages.push(item.poseIndex + 1);
          continue;
        }

        console.log(`⬇️  Downloading image ${item.poseIndex + 1}: ${imageUrl}`);

        // 下载图片
        const response = await fetch(imageUrl);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        const filename = `${dirName}_姿势${item.poseIndex + 1}${item.enhancedUrl ? '_增强版' : ''}.png`;

        // 将图片添加到 ZIP
        archive.append(Buffer.from(buffer), { name: `${dirName}/${filename}` });
        successCount++;
        console.log(`✅ Image ${item.poseIndex + 1} added successfully`);
      } catch (error) {
        failedCount++;
        failedImages.push(item.poseIndex + 1);
        console.error(`❌ Failed to add image ${item.poseIndex + 1}:`, error);
      }
    }

    // 检查是否有成功的图片
    if (successCount === 0) {
      return NextResponse.json(
        {
          error: `所有图片都下载失败 (${failedCount} 张失败)`,
          failedImages
        },
        { status: 500 }
      );
    }

    console.log(`📊 Download statistics: ${successCount} success, ${failedCount} failed`);

    // 完成归档
    archive.finalize();

    // 将 archive stream 转换为 ReadableStream
    const nodeStream = Readable.from(archive);
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    // 返回 ZIP 文件
    // 使用 RFC 5987 编码来支持非 ASCII 字符
    const zipFilename = `${dirName}_批量下载.zip`;
    const encodedFilename = encodeURIComponent(zipFilename);

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="download.zip"; filename*=UTF-8''${encodedFilename}`,
        'X-Success-Count': successCount.toString(),
        'X-Failed-Count': failedCount.toString(),
        'X-Failed-Images': failedImages.join(',')
      }
    });
  } catch (error) {
    console.error('❌ ZIP creation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ZIP creation failed' },
      { status: 500 }
    );
  }
}
