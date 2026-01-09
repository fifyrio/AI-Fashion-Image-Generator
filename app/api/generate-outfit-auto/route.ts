import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';
import { getRandomModelUrl, Character } from '@/lib/pipeline';
import { saveKIETaskMetadata } from '@/lib/r2';
import { OUTFIT_GEN_AUTO_PROMPT } from '@/lib/prompts';
import type { KIETaskMetadata } from '@/lib/kie-image-service';

export const maxDuration = 60;

/**
 * Generate outfit using background-removed clothing image + description + model
 * This is Step 3 of the automated workflow
 */
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const { clothingImageUrl, description, character } = body as {
        clothingImageUrl?: string;
        description?: string;
        character?: Character;
    };

    if (!clothingImageUrl || typeof clothingImageUrl !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid clothingImageUrl parameter' }, { status: 400 });
    }

    if (!description || typeof description !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid description parameter' }, { status: 400 });
    }

    if (!character || typeof character !== 'string') {
        return NextResponse.json({ error: 'Missing or invalid character parameter' }, { status: 400 });
    }

    console.log(`[api/generate-outfit-auto] Generating outfit`);
    console.log(`  Clothing: ${clothingImageUrl}`);
    console.log(`  Character: ${character}`);
    console.log(`  Description: ${description.substring(0, 100)}...`);

    try {
        // Get model image URL
        const modelImageUrl = getRandomModelUrl(character);
        console.log(`  Model URL: ${modelImageUrl}`);

        // Create prompt combining description with model instructions
        const prompt = OUTFIT_GEN_AUTO_PROMPT.replace('{clothingDescription}', description);

        // Use KIE service to generate with 2 reference images
        const kieService = new KIEImageService();
        const taskId = await kieService.createTask(
            prompt,
            [clothingImageUrl, modelImageUrl], // 2 reference images
            '9:16',
            'google/nano-banana-edit'
        );

        console.log(`[api/generate-outfit-auto] Task created: ${taskId}`);

        // Save task metadata to R2 so /api/task-status can find it
        const metadata: KIETaskMetadata = {
            taskId,
            status: 'pending',
            prompt: prompt,
            imageUrl: clothingImageUrl,
            character: character,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await saveKIETaskMetadata(metadata);
        console.log(`[api/generate-outfit-auto] Task metadata saved to R2`);

        return NextResponse.json({
            success: true,
            taskId,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[api/generate-outfit-auto] Error: ${errorMessage}`);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
