# KIE 异步图片生成服务使用文档

## 概述

本项目新增了基于 KIE API 的异步图片生成功能，使用 `google/nano-banana-edit` 模型。与同步的 Gemini 方案不同，KIE 采用**异步任务 + Webhook 回调**的架构。

## 架构设计

### 工作流程

```
1. 用户上传图片 → /api/upload
2. 调用生成接口 → /api/generate (使用 KIE)
3. 创建 KIE 任务 → 返回 taskId 列表
4. 任务元数据保存到 R2 (kie-tasks/{taskId}.json)
5. 立即返回给前端 { taskIds: [...] }

--- 异步部分 ---

6. KIE 完成生成 → 回调 /api/callback
7. Callback 下载图片 → 上传到 R2
8. 更新任务状态 → completed

--- 前端轮询 ---

9. 前端轮询 /api/task-status?taskId=xxx
10. 获取任务状态和结果
```

## API 端点

### 1. POST /api/callback

**接收 KIE API 的回调通知**

```typescript
// KIE 会发送如下请求：
POST /api/callback
Content-Type: application/json

{
  "code": 200,
  "data": {
    "taskId": "e989621f54392584b05867f87b160672",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://example.com/generated.jpg\"]}",
    "consumeCredits": 100,
    "costTime": 8,
    "completeTime": 1755599644000,
    ...
  },
  "msg": "Playground task completed successfully."
}
```

**Callback 处理逻辑：**
1. 解析 taskId 和结果
2. 从 R2 读取任务元数据
3. 下载生成的图片
4. 上传到 R2 的 `generated/` 目录
5. 更新任务状态为 `completed`
6. 返回 200 OK

### 2. GET /api/task-status?taskId=xxx

**查询任务状态**

**请求参数：**
- `taskId` - KIE 任务 ID

**响应示例：**

```json
{
  "success": true,
  "taskId": "e989621f54392584b05867f87b160672",
  "status": "completed",
  "prompt": "服装描述...",
  "imageUrl": "https://...",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:08.000Z",
  "resultUrls": [
    "https://pub-xxx.r2.dev/generated/kie-xxx-yyy.png"
  ],
  "consumeCredits": 100,
  "costTime": 8
}
```

**任务状态：**
- `pending` - 任务已创建，等待处理
- `processing` - 任务处理中（保留状态）
- `completed` - 任务完成
- `failed` - 任务失败

## 代码使用示例

### 在 API 路由中使用 KIE Pipeline

```typescript
// app/api/generate-kie/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { runKIEGenerationPipeline } from '@/lib/pipeline';
import type { GenerationRequest } from '@/lib/types';

export async function POST(request: NextRequest) {
  const body: GenerationRequest = await request.json();

  // 调用 KIE 异步管道
  const result = await runKIEGenerationPipeline(body);

  return NextResponse.json({
    success: true,
    message: `Created ${result.tasks.length} KIE task(s)`,
    tasks: result.tasks.map(t => ({
      taskId: t.taskId,
      sourceKey: t.source.key
    })),
    failures: result.failures,
  });
}
```

### 直接使用 KIEImageService

```typescript
import { KIEImageService } from '@/lib/kie-image-service';
import { saveKIETaskMetadata } from '@/lib/r2';

const kieService = new KIEImageService();

// 创建任务
const result = await kieService.generateImageBase64(
  "A person wearing a red dress",
  "https://example.com/model-image.jpg"
);

if (result.success && result.taskId) {
  console.log(`Task created: ${result.taskId}`);
  // 任务元数据已自动保存到 R2
}
```

### 前端轮询示例

```typescript
// 前端代码
async function pollTaskStatus(taskId: string) {
  const maxAttempts = 30;
  const interval = 2000; // 2秒

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`/api/task-status?taskId=${taskId}`);
    const data = await response.json();

    if (data.status === 'completed') {
      console.log('Task completed!', data.resultUrls);
      return data;
    }

    if (data.status === 'failed') {
      console.error('Task failed:', data.error);
      throw new Error(data.error);
    }

    // 等待后重试
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Task timeout');
}
```

## 环境配置

在 `.env.local` 中添加：

```env
# KIE API Configuration
KIE_API_TOKEN=your_kie_api_token_here
KIE_CALLBACK_URL=https://your-domain.com/api/callback
```

**重要提示：**
- `KIE_CALLBACK_URL` 必须是公网可访问的 URL
- 本地开发可以使用 ngrok 等工具暴露本地端口
- Vercel 部署会自动使用生产域名

## R2 存储结构

```
your-bucket/
├── kie-tasks/                    # KIE 任务元数据
│   ├── task_12345.json          # 任务元数据
│   └── task_67890.json
│
├── generated/                    # 生成的图片
│   └── kie-task_12345-uuid.png  # KIE 生成的图片
│
└── uploads/                      # 用户上传的参考图
    └── ...
```

## 对比：Gemini vs KIE

| 特性 | Gemini (同步) | KIE (异步) |
|------|---------------|------------|
| 模式 | 同步等待 | 异步回调 |
| 响应时间 | 立即返回结果 | 返回 taskId，结果通过回调 |
| 超时处理 | 可能超时 | 不会超时 |
| 适用场景 | 快速生成 | 长时间生成 |
| 前端轮询 | 不需要 | 需要轮询状态 |
| Pipeline | `runGenerationPipeline` | `runKIEGenerationPipeline` |

## 调试建议

1. **查看日志：**
   ```bash
   # Vercel 部署
   vercel logs --follow

   # 本地开发
   npm run dev
   ```

2. **测试 Callback：**
   ```bash
   # 模拟 KIE 回调
   curl -X POST http://localhost:3000/api/callback \
     -H "Content-Type: application/json" \
     -d '{"code":200,"data":{"taskId":"test123","state":"success","resultJson":"{\"resultUrls\":[\"https://example.com/test.jpg\"]}"}}'
   ```

3. **查询任务状态：**
   ```bash
   curl http://localhost:3000/api/task-status?taskId=test123
   ```

## 故障排查

### 问题 1：Callback 未收到

**可能原因：**
- `KIE_CALLBACK_URL` 配置错误
- 防火墙阻止了 KIE 服务器
- 本地开发环境未暴露公网

**解决方案：**
- 检查环境变量配置
- 使用 ngrok 暴露本地端口
- 查看 KIE API 控制台的回调日志

### 问题 2：任务状态一直是 pending

**可能原因：**
- Callback 未执行
- R2 写入失败

**解决方案：**
- 检查 Vercel 日志
- 手动调用 `/api/task-status` 确认元数据存在
- 查看 R2 存储桶中的 `kie-tasks/` 目录

### 问题 3：图片下载失败

**可能原因：**
- KIE 返回的 URL 无效
- 网络问题

**解决方案：**
- 检查 Callback 日志中的 `resultUrls`
- 手动访问 URL 确认图片存在
- 增加重试逻辑

## 未来优化

- [ ] 添加 WebSocket 支持实时推送
- [ ] 批量任务管理接口
- [ ] 任务失败自动重试
- [ ] 任务队列和优先级
- [ ] 性能监控和统计
