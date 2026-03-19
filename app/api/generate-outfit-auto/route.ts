import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';
import { getRandomModelUrl, Character } from '@/lib/pipeline';
import { saveKIETaskMetadata } from '@/lib/r2';
import { OUTFIT_GEN_AUTO_PROMPT } from '@/lib/prompts';
import type { KIETaskMetadata } from '@/lib/kie-image-service';

export const maxDuration = 180; // 3分钟，给 KIE API 更多的生成时间

/**
 * Extract top garment length/style keywords from description
 * Returns structured info about the top's silhouette
 */
function extractTopStyleInfo(description: string): {
    length: string;
    fit: string;
    formalLevel: string;
} {
    const lowerDesc = description.toLowerCase();
    const desc = description;

    // Extract length info
    let length = 'regular';
    if (desc.includes('短款') || desc.includes('到腰') || lowerDesc.includes('cropped') || lowerDesc.includes('short')) {
        length = 'short/cropped (到腰部)';
    } else if (desc.includes('中长款') || desc.includes('到大腿') || desc.includes('到臀')) {
        length = 'mid-length (到大腿/臀部)';
    } else if (desc.includes('长款') || desc.includes('到膝盖') || desc.includes('到小腿') || lowerDesc.includes('long coat')) {
        length = 'long (到膝盖或以下)';
    } else if (desc.includes('常规') || desc.includes('标准')) {
        length = 'regular (常规款)';
    }

    // Extract fit info
    let fit = 'regular';
    if (desc.includes('修身') || desc.includes('紧身') || desc.includes('贴身') || lowerDesc.includes('slim') || lowerDesc.includes('fitted')) {
        fit = 'slim/fitted (修身)';
    } else if (desc.includes('宽松') || desc.includes('oversized') || desc.includes('oversize') || lowerDesc.includes('loose') || lowerDesc.includes('oversized')) {
        fit = 'loose/oversized (宽松)';
    }

    // Extract formal level
    let formalLevel = 'casual';
    if (desc.includes('西装') || desc.includes('衬衫') || desc.includes('针织开衫') || desc.includes('丝绸') || desc.includes('小香风')) {
        formalLevel = 'formal/elegant';
    } else if (desc.includes('T恤') || desc.includes('卫衣') || desc.includes('帽衫') || desc.includes('牛仔外套') || desc.includes('运动')) {
        formalLevel = 'casual/street';
    }

    return { length, fit, formalLevel };
}

/**
 * Build enhanced description by integrating smart matching suggestions
 * Extracts key items (bottoms, shoes, accessories) from suggestions and adds them to description
 * Now includes strong constraints to preserve the uploaded top's exact style
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
        } else if ((trimmedLine.startsWith('**') && !trimmedLine.includes('款式') && !trimmedLine.includes('颜色') && !trimmedLine.includes('材质')) || trimmedLine.startsWith('【配色') || trimmedLine.startsWith('【廓形') || trimmedLine.startsWith('【混搭')) {
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
                // Skip sunglasses, bags, and hats
                if (value && value.length < 100 && !value.includes('墨镜') && !value.includes('包包') && !value.includes('帽子') && !value.includes('帽') && !value.toLowerCase().includes('bag') && !value.toLowerCase().includes('hat') && !value.toLowerCase().includes('cap')) {
                    accessoriesInfo += value + '; ';
                }
            }
        }
    }

    // Filter out belt/腰带 if bottoms are leggings-type (no belt loops)
    const noBeltBottoms = ['leggings', '紧身裤', '瑜伽裤', '鲨鱼裤', '打底裤', '运动裤', 'yoga pants', '健身裤'];
    const isLeggingsBottom = noBeltBottoms.some(kw => bottomsInfo.toLowerCase().includes(kw));
    if (isLeggingsBottom && accessoriesInfo) {
        accessoriesInfo = accessoriesInfo
            .split('; ')
            .filter(item => !item.includes('腰带') && !item.includes('皮带') && !item.toLowerCase().includes('belt'))
            .join('; ');
    }

    // Extract top style info for strict preservation
    const topStyle = extractTopStyleInfo(originalDescription);

    // Build enhanced description with STRONG constraints for top preservation
    let enhanced = `⚠️ CRITICAL TOP GARMENT CONSTRAINTS (MUST PRESERVE EXACTLY):
- LENGTH: ${topStyle.length} - DO NOT change! Short jacket stays short, long coat stays long!
- FIT/SILHOUETTE: ${topStyle.fit} - DO NOT change the cut or silhouette!
- The top garment from Image 2 (clothing reference) MUST appear EXACTLY as shown - same length, same style, same cut.

TOP/JACKET (from uploaded image - PRESERVE EXACTLY):
${originalDescription}`;

    if (innerWearInfo.trim()) {
        enhanced += `\n\nINNER LAYER (AI recommendation - wear under the jacket/top):
${innerWearInfo.trim()}`;
    }

    if (bottomsInfo.trim()) {
        enhanced += `\n\nBOTTOMS (AI recommendation - mix-match style):
${bottomsInfo.trim()}`;
    }

    if (accessoriesInfo.trim()) {
        enhanced += `\n\nACCESSORIES (AI recommendation):
${accessoriesInfo.trim()}`;
    }

    // Add trending style guidance for better visual appeal
    enhanced += `\n\n🔥 TRENDING STYLE TIPS (for maximum visual appeal):
- Use DARK tones for bottoms (black, dark grey) to create strong contrast with the top
- Ensure the overall outfit has a clear style identity (street/sporty, earth-tone luxe, military cool, or layered casual)
- The silhouette should have clear contrast - if top is loose, bottoms should be fitted; if top is fitted, consider wide-leg or straight-cut bottoms
- Avoid overly plain or low-contrast combinations`;

    // Add final reminder
    enhanced += `\n\n⚠️ REMINDER: The TOP/JACKET must match the uploaded clothing image EXACTLY in terms of length, style, and silhouette. DO NOT transform a short jacket into a long one or vice versa.`;

    console.log(`  📝 Enhanced description length: ${enhanced.length} (original: ${originalDescription.length})`);
    console.log(`  📝 Top style extracted: length=${topStyle.length}, fit=${topStyle.fit}`);
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
