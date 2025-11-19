import path from 'path';
import { Readable } from 'node:stream';
import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getBucketName, r2Client } from '@/lib/r2';

function toWebStream(stream: Readable): ReadableStream<Uint8Array> {
  if (typeof Readable.toWeb === 'function') {
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on('data', (chunk: Buffer | string) => {
        const payload = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
        controller.enqueue(payload);
      });
      stream.on('end', () => controller.close());
      stream.on('error', (error) => controller.error(error));
    },
    cancel() {
      stream.destroy();
    },
  });
}

export async function GET(request: NextRequest) {
  const keyParam = request.nextUrl.searchParams.get('key');
  const urlParam = request.nextUrl.searchParams.get('url');
  const filenameParam = request.nextUrl.searchParams.get('filename');

  // 如果提供了 url 参数，则从外部 URL 下载
  if (urlParam) {
    try {
      const imageUrl = decodeURIComponent(urlParam);
      const filename = filenameParam ? decodeURIComponent(filenameParam) : 'download.png';

      // 使用 fetch 获取外部图片
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return NextResponse.json({ error: 'failed to fetch image from URL' }, { status: 500 });
      }

      const blob = await response.blob();
      const contentType = response.headers.get('content-type') ?? 'image/png';

      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
            filename
          )}`,
          'Cache-Control': 'private, max-age=0, must-revalidate',
        },
      });
    } catch (error) {
      console.error('Failed to download image from URL:', error);
      return NextResponse.json({ error: 'failed to download image from URL' }, { status: 500 });
    }
  }

  // 原有的从 R2 下载逻辑
  if (!keyParam) {
    return NextResponse.json({ error: 'missing key or url parameter' }, { status: 400 });
  }

  const objectKey = decodeURIComponent(keyParam);
  if (!objectKey.startsWith('generated/')) {
    return NextResponse.json({ error: 'unsupported object key' }, { status: 400 });
  }

  try {
    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: objectKey,
      })
    );

    if (!response.Body) {
      return NextResponse.json({ error: 'file not found' }, { status: 404 });
    }

    const filename = path.basename(objectKey);
    const contentType = response.ContentType ?? 'application/octet-stream';
    const contentLength = response.ContentLength;
    const body = toWebStream(response.Body as Readable);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        ...(contentLength ? { 'Content-Length': contentLength.toString() } : {}),
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Failed to download object from R2:', error);
    return NextResponse.json({ error: 'failed to download object' }, { status: 500 });
  }
}
