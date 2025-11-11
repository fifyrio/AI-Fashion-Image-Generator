import { NextRequest, NextResponse } from 'next/server';
import { getPublicUrl, uploadBufferToR2 } from '@/lib/r2';
import { CHARACTER_NAME_REGEX } from '@/lib/pipeline';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const rawName = formData.get('modelName');
        const modelImage = formData.get('modelImage');

        if (typeof rawName !== 'string') {
            return NextResponse.json(
                { error: 'Model name is required.' },
                { status: 400 }
            );
        }

        const modelName = rawName.trim();

        if (!CHARACTER_NAME_REGEX.test(modelName)) {
            return NextResponse.json(
                { error: 'Invalid model name. Use letters, numbers, or underscores only.' },
                { status: 400 }
            );
        }

        if (!(modelImage instanceof File)) {
            return NextResponse.json(
                { error: 'Model image file is required.' },
                { status: 400 }
            );
        }

        if (!modelImage.type.startsWith('image/')) {
            return NextResponse.json(
                { error: 'Invalid image file.' },
                { status: 400 }
            );
        }

        if (modelImage.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: 'Image file exceeds 10MB limit.' },
                { status: 413 }
            );
        }

        const buffer = Buffer.from(await modelImage.arrayBuffer());
        const key = `${modelName}/frame_1.jpg`;

        await uploadBufferToR2({
            key,
            body: buffer,
            contentType: modelImage.type || 'image/jpeg',
            cacheControl: 'public, max-age=31536000, immutable',
            metadata: {
                filename: modelImage.name,
            },
        });

        const url = getPublicUrl(key);
        const label = modelName.charAt(0).toUpperCase() + modelName.slice(1);

        return NextResponse.json({
            success: true,
            model: {
                id: modelName,
                label,
                image: `${url}?v=${Date.now()}`,
            },
        });
    } catch (error) {
        console.error('Error adding model:', error);
        return NextResponse.json(
            { error: 'Failed to add model.' },
            { status: 500 }
        );
    }
}
