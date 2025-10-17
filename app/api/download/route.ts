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
  if (!keyParam) {
    return NextResponse.json({ error: 'missing key parameter' }, { status: 400 });
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
