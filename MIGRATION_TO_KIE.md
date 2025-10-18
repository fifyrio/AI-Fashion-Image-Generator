# 迁移到 KIE 图片生成服务

## 变更说明

主 pipeline (`runGenerationPipeline`) 已从 Gemini 同步模式迁移到 KIE 异步模式。

### 关键变更

#### 之前（Gemini）
```typescript
// lib/pipeline.ts
const imageGenerator = new ImageGenerator();
const result = await imageGenerator.generateImageBase64(prompt, imageUrl);
// 立即返回 base64 图片数据
```

#### 现在（KIE）
```typescript
// lib/pipeline.ts
const kieService = new KIEImageService();
const result = await kieService.generateImageBase64(prompt, imageUrl);
// 返回 taskId

// 轮询等待 callback 完成
const resultUrls = await pollKIETaskCompletion(result.taskId);
// 获取生成的图片 URL
```

## 工作流程

### 原 Gemini 流程（已废弃）
```
1. 调用 Gemini API
2. 等待响应（可能超时）
3. 返回 base64 图片
4. 保存到 R2
```

### 新 KIE 流程（当前）
```
1. 创建 KIE 任务 → 获得 taskId
2. 保存任务元数据到 R2
3. 轮询等待完成（2秒/次，最多60次）
4. KIE 完成 → 回调 /api/callback
5. Callback 下载图片 → 上传到 R2
6. 更新任务状态 → completed
7. 轮询检测到 completed → 继续流程
8. 生成小红书标题
9. 保存最终元数据
```

## API 行为变化

### POST /api/generate

**之前：**
- 同步等待 Gemini 生成
- 响应时间：10-30 秒
- 超时风险：高

**现在：**
- 创建 KIE 任务并轮询等待
- 响应时间：依赖 KIE 处理速度
- 超时配置：60 次 × 2 秒 = 120 秒（可调）
- 更可靠：callback 异步更新状态

## 配置要求

### 必需的环境变量

```env
# KIE API
KIE_API_TOKEN=your_kie_api_token_here
KIE_CALLBACK_URL=https://your-domain.com/api/callback

# Cloudflare R2（已存在）
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=xxx
R2_PUBLIC_BASE_URL=xxx
```

### Vercel 部署配置

1. 在 Vercel 项目设置中添加环境变量
2. 确保 `KIE_CALLBACK_URL` 指向生产域名
3. API 路由超时已配置为 60 秒（`vercel.json`）

## 轮询配置

在 `lib/pipeline.ts` 中可以调整轮询参数：

```typescript
async function pollKIETaskCompletion(
  taskId: string,
  maxAttempts: number = 60,  // 最大轮询次数
  intervalMs: number = 2000   // 轮询间隔（毫秒）
): Promise<string[]>
```

**建议配置：**
- 快速生成任务：`maxAttempts=30, intervalMs=2000` (60秒超时)
- 普通任务：`maxAttempts=60, intervalMs=2000` (120秒超时)
- 长时间任务：`maxAttempts=90, intervalMs=3000` (270秒超时)

## 兼容性保留

`runKIEGenerationPipeline` 函数仍然保留用于纯异步模式（不等待完成）：

```typescript
// 仅创建任务，不等待
const { tasks, failures } = await runKIEGenerationPipeline(request);
// 返回 taskIds，前端需自行轮询
```

如需使用此模式，可以创建单独的 API 端点：

```typescript
// app/api/generate-async/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await runKIEGenerationPipeline(body);
  return NextResponse.json({
    taskIds: result.tasks.map(t => t.taskId),
  });
}
```

## 回滚到 Gemini（应急）

如果 KIE 出现问题，可以快速回滚：

```typescript
// lib/pipeline.ts
// 1. 修改导入
import { ImageGenerator } from './image-generator';

// 2. 修改 runGenerationPipeline
const imageGenerator = new ImageGenerator();

// 3. 替换生成逻辑
const generationResult = await imageGenerator.generateImageBase64(
  clothingDetails,
  modelImageUrl
);

if (!generationResult.success || !generationResult.result) {
  throw new Error(generationResult.error || 'Image generation failed');
}

const { buffer, mimeType } = await resolveImageResult(generationResult.result);
```

## 监控和日志

查看 KIE 任务执行日志：

```bash
# Vercel 生产环境
vercel logs --follow

# 本地开发
npm run dev
```

关键日志标识：
- `[pipeline]` - Pipeline 主流程
- `[kie-pipeline]` - KIE 异步模式
- `[api/callback]` - Callback 处理
- `[api/task-status]` - 状态查询

## 性能对比

| 指标 | Gemini (旧) | KIE (新) |
|------|-------------|----------|
| 模型 | Gemini Flash | google/nano-banana-edit |
| 模式 | 同步 | 异步 + 轮询 |
| 超时风险 | 高 | 低 |
| 响应时间 | 10-30s | 可变 |
| 可靠性 | 中等 | 高 |
| 成本 | OpenRouter | KIE Credits |

## 故障排查

### 问题 1：任务一直 pending

**检查：**
1. KIE_CALLBACK_URL 是否配置正确
2. Callback 端点是否可访问
3. 查看 Vercel 日志是否收到 callback

**解决：**
```bash
# 测试 callback 可达性
curl https://your-domain.com/api/callback

# 手动触发 callback（测试）
curl -X POST https://your-domain.com/api/callback \
  -H "Content-Type: application/json" \
  -d '{"code":200,"data":{"taskId":"test","state":"success","resultJson":"{\"resultUrls\":[\"https://example.com/test.jpg\"]}"}}'
```

### 问题 2：轮询超时

**检查：**
1. KIE 任务是否真的完成
2. Callback 是否成功更新状态

**解决：**
- 增加 `maxAttempts` 参数
- 检查 R2 中的任务元数据：`kie-tasks/{taskId}.json`

### 问题 3：图片下载失败

**检查：**
1. KIE 返回的 resultUrls 是否有效
2. 网络连接是否正常

**解决：**
- 在 callback 中添加重试逻辑
- 检查 KIE API 控制台

## 测试清单

部署前确保测试：

- [ ] 环境变量已配置
- [ ] `/api/callback` 可访问
- [ ] `/api/task-status` 返回正确数据
- [ ] 完整生成流程：上传 → 生成 → 查看结果
- [ ] 查看 Vercel 日志确认无错误
- [ ] 测试多个图片并发生成

## 参考文档

- [KIE_ASYNC_USAGE.md](./KIE_ASYNC_USAGE.md) - 完整的 KIE 使用文档
- [CLAUDE.md](./CLAUDE.md) - 项目架构文档
