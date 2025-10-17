import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import { listObjects, r2Client, getBucketName } from '@/lib/r2';
import type { Readable } from 'node:stream';

async function streamToBuffer(stream: Readable | ReadableStream<Uint8Array> | Blob): Promise<Buffer> {
  if (!stream) {
    return Buffer.alloc(0);
  }

  if (typeof (stream as Blob).arrayBuffer === 'function') {
    const arrayBuffer = await (stream as Blob).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  if (typeof (stream as ReadableStream<Uint8Array>).getReader === 'function') {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done ?? false;
      if (result.value) {
        chunks.push(result.value);
      }
    }
    return Buffer.concat(chunks);
  }

  const nodeStream = stream as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of nodeStream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    const objects = await listObjects('generated/');
    const target = objects.find((object) => object.Key && path.basename(object.Key) === filename);

    if (!target?.Key) {
      return NextResponse.json(
        { error: 'Image not found in R2' },
        { status: 404 }
      );
    }

    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: target.Key,
      })
    );

    if (!response.Body) {
      return NextResponse.json(
        { error: 'Image body empty' },
        { status: 404 }
      );
    }

    const buffer = await streamToBuffer(response.Body as Readable);
    const contentType =
      response.ContentType ||
      `image/${path.extname(target.Key).replace('.', '') || 'png'}`;

    return new NextResponse(buffer as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    console.error('Error fetching image from R2:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve image' },
      { status: 500 }
    );
  }
}
