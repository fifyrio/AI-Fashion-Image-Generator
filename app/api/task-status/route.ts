import { NextRequest, NextResponse } from 'next/server';
import { getKIETaskMetadata } from '@/lib/r2';

/**
 * GET /api/task-status?taskId=xxx
 * 查询 KIE 任务状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      );
    }

    console.log(`[api/task-status] Querying task: ${taskId}`);

    // 从 R2 获取任务元数据
    const metadata = await getKIETaskMetadata(taskId);

    if (!metadata) {
      console.log(`[api/task-status] Task not found: ${taskId}`);
      return NextResponse.json(
        { error: 'Task not found', taskId },
        { status: 404 }
      );
    }

    console.log(`[api/task-status] Task status: ${metadata.status}`);

    return NextResponse.json({
      success: true,
      taskId: metadata.taskId,
      status: metadata.status,
      prompt: metadata.prompt,
      imageUrl: metadata.imageUrl,
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      resultUrls: metadata.resultUrls,
      error: metadata.error,
      consumeCredits: metadata.consumeCredits,
      costTime: metadata.costTime,
    });

  } catch (error) {
    console.error('[api/task-status] Error querying task status:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
