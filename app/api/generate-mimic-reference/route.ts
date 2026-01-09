import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService } from '@/lib/kie-image-service';

export const maxDuration = 180; // 3分钟，给 KIE API 更多的生成时间

export async function POST(request: NextRequest) {
  try {
    const { prompt, character } = await request.json();

    if (!prompt || !character) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('[generate-mimic-reference] Starting KIE task creation:', {
      promptPreview: prompt.substring(0, 100),
      character
    });

    // Get the character's model image URL
    const characterImageUrl = getCharacterImageUrl(character);

    // Build the prompt to ONLY change background while keeping model pose and body unchanged
    const fullPrompt = `保持图片中模特的姿势、动作、身材完全不变，只替换背景环境。

**🎯 核心要求：只改变背景，完全保持模特的姿势和身材**

**1. 严格保持模特的所有特征（最高优先级）**：
   - **身材比例**：头身比、肩宽、腰围、臀部、腿长、腿粗细等所有身材特征100%保持原样
   - **姿势和动作**：站姿、坐姿、手部动作、腿部姿势、身体朝向、头部角度、表情等完全保持原样
   - **服装**：服装款式、颜色、材质、细节完全保持原样
   - **面部特征**：五官、肤色、发型、妆容完全保持原样

**2. 只替换背景环境（按照以下描述）**：

${prompt}

**❌ 绝对禁止的操作**：
- ❌ 不要改变模特的任何姿势、动作、站姿、坐姿
- ❌ 不要改变模特的身材比例（头身比、肩宽、腿长等）
- ❌ 不要改变模特的手部动作、腿部姿势
- ❌ 不要改变模特的表情、视线方向、头部角度
- ❌ 不要改变模特的服装款式、颜色、材质
- ❌ 不要改变模特的面部特征、发型、肤色

**✅ 正确做法**：
- ✅ 完全保持模特的原始姿势和身材，像是把同一个模特放到新背景中拍照
- ✅ 只改变背景环境（墙壁、家具、植物、光线、色调等）
- ✅ 确保模特的影子和光影效果与新背景协调
- ✅ 保持模特与新背景的空间关系合理自然

🎯 **最终目标**：
生成一张照片，就像是把原图的模特（保持完全相同的姿势、身材、服装）直接放到新的背景环境中，然后重新打光拍摄一样。模特本身没有任何变化，只是背景环境换了。`;

    // Use KIE service to create async task
    const kieService = new KIEImageService();
    const result = await kieService.generateModelPose(
      fullPrompt, // 完整的prompt，包含保持姿势和替换背景的指令
      '', // description留空
      characterImageUrl,
      false, // holdingPhone
      false, // wearingMask
      false // useProModel
    );

    if (!result.success || !result.taskId) {
      throw new Error(result.error || 'Failed to create KIE task');
    }

    console.log('[generate-mimic-reference] KIE task created successfully:', result.taskId);

    // Return taskId for frontend polling
    return NextResponse.json({
      success: true,
      taskId: result.taskId,
      message: 'Task created successfully. Image generation in progress.'
    });
  } catch (error) {
    console.error('[generate-mimic-reference] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}

// Helper function to get character image URL
function getCharacterImageUrl(character: string): string {
  const baseUrl = 'https://pub-9e76573778404f65b02c3ea29d2db5f9.r2.dev';
  return `${baseUrl}/${character}/frame_1.jpg`;
}
