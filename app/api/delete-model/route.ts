import { NextRequest, NextResponse } from 'next/server';
import { deleteObjectFromR2 } from '@/lib/r2';
import { CHARACTER_NAME_REGEX, isDefaultCharacter } from '@/lib/pipeline';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);

        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Invalid request payload.' }, { status: 400 });
        }

        const { modelName } = body as { modelName?: string };

        if (typeof modelName !== 'string') {
            return NextResponse.json({ error: 'Model name is required.' }, { status: 400 });
        }

        const normalized = modelName.trim();

        if (!normalized || !CHARACTER_NAME_REGEX.test(normalized)) {
            return NextResponse.json(
                { error: 'Invalid model name. Use letters, numbers, and underscores only.' },
                { status: 400 }
            );
        }

        if (isDefaultCharacter(normalized)) {
            return NextResponse.json(
                { error: 'Default models cannot be deleted.' },
                { status: 403 }
            );
        }

        const key = `${normalized}/frame_1.jpg`;
        await deleteObjectFromR2(key);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting model:', error);
        return NextResponse.json({ error: 'Failed to delete model.' }, { status: 500 });
    }
}
