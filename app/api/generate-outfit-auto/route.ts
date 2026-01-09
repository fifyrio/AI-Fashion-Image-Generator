import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';
import { getRandomModelUrl, Character } from '@/lib/pipeline';
import { saveKIETaskMetadata } from '@/lib/r2';
import { OUTFIT_GEN_AUTO_PROMPT } from '@/lib/prompts';
import type { KIETaskMetadata } from '@/lib/kie-image-service';

export const maxDuration = 180; // 3分钟，给 KIE API 更多的生成时间

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
    console.log(`  Clothing Image: ${clothingImageUrl}`);
    console.log(`  Character: ${character}`);
    console.log(`  Description: ${description.substring(0, 100)}...`);

    try {
        // Get model image URL
        const modelImageUrl = getRandomModelUrl(character);
        console.log(`  Model Image: ${modelImageUrl}`);

        // Create prompt combining description with model instructions
        const prompt = OUTFIT_GEN_AUTO_PROMPT.replace('{clothingDescription}', description);

        // Use KIE service to generate with 2 reference images
        // ⚠️ 重要：模特图必须放在第一位，因为 nano-banana-edit 会以第一张图为基础进行编辑
        const imageUrls = [modelImageUrl, clothingImageUrl]; // ✅ 模特图在前，服装图在后
        console.log(`  📸 Image order:`);
        console.log(`    [0] Model (base):     ${imageUrls[0]}`);
        console.log(`    [1] Clothing (style): ${imageUrls[1]}`);

        const kieService = new KIEImageService();
        const taskId = await kieService.createTask(
            prompt,
            imageUrls,
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
