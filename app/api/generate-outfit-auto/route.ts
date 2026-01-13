import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';
import { getRandomModelUrl, Character } from '@/lib/pipeline';
import { saveKIETaskMetadata } from '@/lib/r2';
import { OUTFIT_GEN_AUTO_PROMPT } from '@/lib/prompts';
import type { KIETaskMetadata } from '@/lib/kie-image-service';

export const maxDuration = 180; // 3分钟，给 KIE API 更多的生成时间

/**
 * Build enhanced description by integrating smart matching suggestions
 * Extracts key items (bottoms, shoes, accessories) from suggestions and adds them to description
 */
function buildEnhancedDescription(originalDescription: string, matchingSuggestions: string): string {
    // Extract key matching recommendations from the suggestions
    const lines = matchingSuggestions.split('\n').filter(line => line.trim());

    let bottomsInfo = '';
    let innerWearInfo = '';
    let accessoriesInfo = '';

    let currentSection = '';
    for (const line of lines) {
        const trimmedLine = line.trim();

        // Detect section headers
        if (trimmedLine.includes('推荐搭配') && (trimmedLine.includes('下装') || trimmedLine.includes('裤') || trimmedLine.includes('裙'))) {
            currentSection = 'bottoms';
            continue;
        } else if (trimmedLine.includes('推荐内搭')) {
            currentSection = 'innerwear';
            continue;
        } else if (trimmedLine.includes('推荐配饰')) {
            currentSection = 'accessories';
            continue;
        } else if ((trimmedLine.startsWith('**') && !trimmedLine.includes('款式') && !trimmedLine.includes('颜色') && !trimmedLine.includes('材质')) || trimmedLine.startsWith('【配色') || trimmedLine.startsWith('【廓形')) {
            // Reset on new major section (but not on field labels)
            currentSection = '';
            continue;
        }

        // Extract info from current section with better parsing
        if (currentSection === 'bottoms') {
            if (trimmedLine.includes('款式：') || trimmedLine.includes('款式:')) {
                const value = trimmedLine.replace(/^.*?款式[：:]\s*/, '').replace(/；$/, '').trim();
                if (value) bottomsInfo += value + '; ';
            } else if (trimmedLine.includes('颜色：') || trimmedLine.includes('颜色:')) {
                const value = trimmedLine.replace(/^.*?颜色[：:]\s*/, '').replace(/；$/, '').trim();
                if (value) bottomsInfo += value + ' color; ';
            } else if ((trimmedLine.includes('版型') || trimmedLine.includes('长度')) && trimmedLine.includes('：')) {
                const value = trimmedLine.replace(/^-?\s*/, '').replace(/；$/, '').trim();
                if (value) bottomsInfo += value + '; ';
            } else if (trimmedLine.startsWith('-') && trimmedLine.length > 2) {
                // Catch other bullet points in bottoms section
                const value = trimmedLine.replace(/^-\s*/, '').replace(/；$/, '').trim();
                if (value && !value.includes('**') && value.length < 100) {
                    bottomsInfo += value + '; ';
                }
            }
        }

        if (currentSection === 'innerwear') {
            if (trimmedLine.includes('款式：') || trimmedLine.includes('款式:')) {
                const value = trimmedLine.replace(/^.*?款式[：:]\s*/, '').replace(/；$/, '').trim();
                if (value) innerWearInfo += value + '; ';
            } else if (trimmedLine.includes('颜色：') || trimmedLine.includes('颜色:')) {
                const value = trimmedLine.replace(/^.*?颜色[：:]\s*/, '').replace(/；$/, '').trim();
                if (value) innerWearInfo += value + ' color; ';
            } else if ((trimmedLine.includes('材质') || trimmedLine.includes('说明')) && trimmedLine.includes('：')) {
                const value = trimmedLine.replace(/^-?\s*/, '').replace(/；$/, '').trim();
                if (value) innerWearInfo += value + '; ';
            } else if (trimmedLine.startsWith('-') && trimmedLine.length > 2) {
                const value = trimmedLine.replace(/^-\s*/, '').replace(/；$/, '').trim();
                if (value && !value.includes('**') && value.length < 100) {
                    innerWearInfo += value + '; ';
                }
            }
        }

        if (currentSection === 'accessories') {
            if (trimmedLine.startsWith('-') && trimmedLine.length > 2 && !trimmedLine.includes('其他')) {
                const value = trimmedLine.replace(/^-\s*/, '').replace(/；$/, '').trim();
                // Skip sunglasses and bags
                if (value && value.length < 100 && !value.includes('墨镜') && !value.includes('包包') && !value.toLowerCase().includes('bag')) {
                    accessoriesInfo += value + '; ';
                }
            }
        }
    }

    // Build enhanced description with clear sections
    let enhanced = `TOP/JACKET (from uploaded image):\n${originalDescription}`;

    if (innerWearInfo.trim()) {
        enhanced += `\n\nINNER LAYER (AI recommendation - wear under the jacket/top):\n${innerWearInfo.trim()}`;
    }

    if (bottomsInfo.trim()) {
        enhanced += `\n\nBOTTOMS (AI recommendation):\n${bottomsInfo.trim()}`;
    }

    if (accessoriesInfo.trim()) {
        enhanced += `\n\nACCESSORIES (AI recommendation):\n${accessoriesInfo.trim()}`;
    }

    console.log(`  📝 Enhanced description length: ${enhanced.length} (original: ${originalDescription.length})`);
    console.log(`  📝 Enhanced sections: ${innerWearInfo ? '✓ Inner Layer' : ''} ${bottomsInfo ? '✓ Bottoms' : ''} ${accessoriesInfo ? '✓ Accessories' : ''}`);

    return enhanced;
}

/**
 * Generate outfit using background-removed clothing image + description + model
 * This is Step 3 of the automated workflow
 */
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
        return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 });
    }

    const { clothingImageUrl, description, character, matchingSuggestions } = body as {
        clothingImageUrl?: string;
        description?: string;
        character?: Character;
        matchingSuggestions?: string;
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
    console.log(`  Smart Matching Enabled: ${!!matchingSuggestions}`);

    try {
        // Get model image URL
        const modelImageUrl = getRandomModelUrl(character);
        console.log(`  Model Image: ${modelImageUrl}`);

        // Create prompt combining description with model instructions
        let fullDescription = description;

        // If smart matching is enabled, integrate matching suggestions into description
        if (matchingSuggestions) {
            console.log(`  🎨 Integrating smart matching suggestions...`);
            // Extract key matching items from suggestions
            fullDescription = buildEnhancedDescription(description, matchingSuggestions);
        }

        const prompt = OUTFIT_GEN_AUTO_PROMPT.replace('{clothingDescription}', fullDescription);

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
