import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import path from 'path';
import { uploadBufferToR2, getPublicUrl } from '@/lib/r2';
import type { UploadedReference } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      console.warn('[api/upload] No files provided in request');
      return NextResponse.json(
        { error: 'No files uploaded' },
        { status: 400 }
      );
    }

    console.log(`[api/upload] Received ${files.length} file(s) for upload`);

    const uploaded: UploadedReference[] = [];
    const errors: { filename: string; error: string }[] = [];

    for (const file of files) {
      try {
        console.log(
          `[api/upload] Uploading filename="${file.name}" size=${file.size} type="${file.type}"`
        );
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const ext = path.extname(file.name) || '';
        const key = `uploads/${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}${ext}`;

        const metadata: Record<string, string> = {};
        if (/^[\x20-\x7E]*$/.test(file.name)) {
          metadata.originalname = file.name;
        }

        await uploadBufferToR2({
          key,
          body: buffer,
          contentType: file.type || 'application/octet-stream',
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
          cacheControl: 'public, max-age=604800', // 7 days for uploads
        });

        uploaded.push({
          key,
          url: getPublicUrl(key),
          filename: file.name,
          size: file.size,
          contentType: file.type || 'application/octet-stream',
        });
        console.log(`[api/upload] Upload succeeded key="${key}"`);
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error);
        errors.push({
          filename: file.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log(
      `[api/upload] Completed uploads. Success=${uploaded.length}, Failures=${errors.length}`
    );
    return NextResponse.json({
      success: uploaded.length > 0,
      uploaded,
      totalCount: files.length,
      uploadedCount: uploaded.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Uploaded ${uploaded.length} of ${files.length} file(s) to R2`,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
