import { NextRequest, NextResponse } from 'next/server';
import { saveKIETaskMetadata } from '@/lib/r2';

export const maxDuration = 60;

// Edit-mode prompts: reference image provides face/character consistency.
// Prompts only describe what to CHANGE, not who the person is.
export const UGC_PRESETS = {
  hook: {
    label: 'Slide 1 — Hook（wrong jewelry, silver）',
    prompt: [
      'Keep the model\'s face, hair, skin tone, and expression exactly as-is.',
      'Change the outfit to a black turtleneck sweater.',
      'Add a statement art deco geometric silver necklace at the collarbone; model is touching it.',
      'Expression: slight eyebrow raise, knowing mysterious look, lips naturally closed.',
      'Lighting: soft window light from right side, gentle shadow on left side of face.',
      'Background: neutral gray wall, slightly blurred.',
      'Angle: smartphone selfie, slightly above eye level.',
      'A few loose dark hair strands near ear and cheek.',
      'Natural skin shine on nose bridge and cheekbone — not highlighter.',
      'Candid intimate mood. NOT studio lighting. NOT airbrushed.',
    ].join(' '),
  },
  result: {
    label: 'Slide 4 — Result（right jewelry, golden hour）',
    prompt: [
      'Keep the model\'s face, hair, and skin tone exactly as-is.',
      'Change the outfit to a cream linen button-up shirt with rolled sleeves.',
      'Add layered warm gold chain necklaces at collarbone catching warm light.',
      'Expression: soft low-key proud smile, lips slightly parted, direct gaze, confident relaxed energy.',
      'Lighting: golden hour side lighting from right, warm honey tones across face, rim light on hair edges making a few strands translucent and glowing.',
      'A few hair strands falling across face naturally catching backlight.',
      'Warm flush on cheeks from golden hour — not blush.',
      'Background: white wall with warm ambient glow, slightly blurred.',
      'Angle: smartphone selfie from slightly above.',
      'Visible hair parting line showing scalp. Natural lip texture without gloss.',
      'Intimate bedroom golden hour moment. NOT studio lighting. NOT airbrushed.',
    ].join(' '),
  },
} as const;

export type UGCPreset = keyof typeof UGC_PRESETS;

export async function POST(request: NextRequest) {
  try {
    const { preset, customPrompt, imageUrl } = await request.json();

    const apiToken    = process.env.KIE_API_TOKEN;
    const callbackUrl = process.env.KIE_CALLBACK_URL;

    if (!apiToken) {
      return NextResponse.json({ error: 'KIE_API_TOKEN not configured' }, { status: 500 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: '请先上传参考图片' }, { status: 400 });
    }

    const prompt = customPrompt?.trim()
      || UGC_PRESETS[preset as UGCPreset]?.prompt
      || UGC_PRESETS.hook.prompt;

    console.log('[generate-ugc-model] Creating Seedream 4.5 edit task');
    console.log('[generate-ugc-model] Preset:', preset);
    console.log('[generate-ugc-model] Reference image:', imageUrl);
    console.log('[generate-ugc-model] Prompt preview:', prompt.substring(0, 120));

    const body = {
      model: 'seedream/4.5-edit',
      ...(callbackUrl && { callBackUrl: callbackUrl }),
      input: {
        prompt,
        image_urls: [imageUrl],
        aspect_ratio: '9:16',
        quality: 'basic',
        nsfw_checker: false,
      },
    };

    const kieRes = await fetch('https://api.kie.ai/api/v1/jobs/createTask', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify(body),
    });

    const kieText = await kieRes.text();
    let kieJson: { code: number; message?: string; data?: { taskId: string } };
    try {
      kieJson = JSON.parse(kieText);
    } catch {
      throw new Error(`KIE returned non-JSON: ${kieText.substring(0, 200)}`);
    }

    if (kieJson.code !== 200) {
      throw new Error(`KIE error ${kieJson.code}: ${kieJson.message || kieText}`);
    }

    const taskId = kieJson.data!.taskId;
    console.log('[generate-ugc-model] Task created:', taskId);

    await saveKIETaskMetadata({
      taskId,
      status:    'pending',
      prompt,
      imageUrl:  '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, taskId });

  } catch (error) {
    console.error('[generate-ugc-model] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
