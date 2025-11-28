# KIE Image Service Overview

## Purpose
`lib/kie-image-service.ts` centralizes all calls to the KIE async job API: we post prompts + reference images, store `KIETaskMetadata` records in Cloudflare R2, and react to callbacks or polling events later. The class is stateless, so each method can be reused in route handlers, background workers, or CLI scripts without shared caches—perfect for drop-in reuse across projects.

### Flow Recap
1. Build a prompt from the provided helper (clothing, pose, extract, etc.).
2. `createTask` POSTs to `https://api.kie.ai/api/v1/jobs/createTask`.
3. Persist metadata via `saveKIETaskMetadata` so callbacks can locate context.
4. Return immediately with the queued `taskId` (or use `waitForTaskCompletion` when synchronous delivery is required).

## External Dependencies
- **Environment**: `KIE_API_TOKEN`, `KIE_CALLBACK_URL`; Cloudflare R2 creds (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, optional `R2_PUBLIC_BASE_URL`).
- **Storage helpers**: `saveKIETaskMetadata` from `lib/r2.ts`; replace it with your own persistence layer but keep the `KIETaskMetadata` schema for compatibility with downstream automation.
- **Prompt templates**: Defined in `lib/prompts.ts` to keep localization centralized (`IMAGE_GENERATION_BASE64_PROMPT`, `EXTRACT_CLOTHING_WITH_MATCH_PROMPT`, `OUTFIT_CHANGE_V2_PROMPT`, etc.).
- **Types**: `ImageGenerationResult` from `lib/types.ts` ensures a predictable shape for upstream logging and API responses.
- **Runtime**: Uses the global `fetch` available in modern Node/Next runtimes; no additional HTTP client required.

### Required Environment Variables
| Key | Purpose | Example |
| --- | --- | --- |
| `KIE_API_TOKEN` | Bearer token for `api.kie.ai`. | `sk-kie-...` |
| `KIE_CALLBACK_URL` | Public HTTP endpoint that KIE calls when a job finishes. | `https://app.example.com/api/kie/callback` |
| `R2_ACCOUNT_ID` | Cloudflare account identifier. | `1234567890abcdef` |
| `R2_ACCESS_KEY_ID` | R2 API access key. | `AKIA...` |
| `R2_SECRET_ACCESS_KEY` | R2 API secret. | `xxxxxxxx` |
| `R2_BUCKET_NAME` | Bucket holding `kie-tasks/*.json`. | `fashion-output` |
| `R2_PUBLIC_BASE_URL` (optional) | CDN fronting generated assets. | `https://cdn.example.com` |

## Core API Surface
| Method | Role | Notes |
| --- | --- | --- |
| `createTask(prompt, imageUrls, imageRatio?)` | Low-level POST helper that injects auth headers and handles HTTP/KIE errors. | Accepts single URL or array; ratio defaults to `9:16`. |
| `getTaskStatus(taskId)` | Reads `/getTask`. | Throws on non-200 HTTP or KIE response codes. |
| `waitForTaskCompletion(taskId, maxAttempts?, intervalMs?)` | Polls `getTaskStatus` until `state` is `success`/`failed`. | Default window ≈60s (30 attempts × 2s). |
| `generateImageBase64(...)` | Builds wardrobe prompts and queues async jobs. | Adds optional white-mask hint and top-only extraction. |
| `generateModelPose(...)` | Enforces strict body-shape constraints while only altering pose. | Ideal when clothing/background must remain untouched. |
| `extractClothing(...)` | Removes the model, optionally recommends matches or restricts to tops. | Forces `1:1` output ratio. |
| `outfitChangeV2(...)` | Applies extracted clothing to a target model photo. | Can append deterministic pose tweaks for variety. |
| `processCallback(callbackData)` | Utility for webhook routes to normalize payloads. | Returns `{ taskId, success, resultUrls[] }` or error info. |

All job-creation methods share consistent logging + metadata persistence so operational dashboards can read the same `kie-tasks/*.json` files regardless of entrypoint.

## Quick Start Example
```ts
import { KIEImageService } from '@/lib/kie-image-service';

const kie = new KIEImageService();

export async function queueLookChange() {
    const referenceUrl = 'https://example.com/source.png';
    const result = await kie.generateImageBase64(
        '淡紫色丝绒短外套 + 高腰直筒牛仔裤',
        referenceUrl,
        /* extractTopOnly */ false,
        /* wearMask */ true,
    );

    if (!result.success) {
        throw new Error(result.error ?? 'Unknown failure');
    }

    console.log('Queued task', result.taskId);
    return result.taskId;
}
```

### Polling for a Result
```ts
// Optional synchronous usage:
const taskId = await queueLookChange();
const kie = new KIEImageService();
const url = await kie.waitForTaskCompletion(taskId, 40, 1500);
console.log('Generated image URL:', url);
```

## Handling Callbacks
```ts
// app/api/kie/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { KIEImageService, KIECallbackResponse } from '@/lib/kie-image-service';
import { updateKIETaskMetadata } from '@/lib/r2';

export async function POST(req: NextRequest) {
    const payload = (await req.json()) as KIECallbackResponse;
    const result = KIEImageService.processCallback(payload);

    await updateKIETaskMetadata(result.taskId, {
        status: result.success ? 'completed' : 'failed',
        resultUrls: result.resultUrls,
        error: result.error,
        consumeCredits: payload.data.consumeCredits,
        costTime: payload.data.costTime,
        updatedAt: new Date(payload.data.updateTime).toISOString(),
    });

    // Trigger downstream steps (notify user, queue retouch, etc.)
    return NextResponse.json({ ok: true });
}
```

### Callback Payload Example
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "kie-task-123",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://cdn.example.com/kie/task123.png\"]}",
    "consumeCredits": 3,
    "costTime": 18.4,
    "createTime": 1731571200000,
    "completeTime": 1731571218000,
    "updateTime": 1731571218000,
    "model": "google/nano-banana-edit",
    "param": "...",
    "remainedCredits": 997
  }
}
```

## Metadata Lifecycle
- `KIETaskMetadata` includes prompt, source image(s), optional `character`, and timestamps.
- Each enqueue call writes an initial `pending` record; callbacks or polling updates should call `updateKIETaskMetadata(...)`.
- By logging to R2 (or your equivalent store), you can resume tasks, replay callbacks, or surface operational dashboards without coupling to Next.js state.

## Extending Prompts Safely
1. Add a new template string to `lib/prompts.ts`.
2. Import it into `kie-image-service.ts`.
3. Follow existing patterns—e.g., detect a boolean flag and switch prompts before calling `createTask`.
4. Keep localization + tone consistent; prompts often include compliance and anatomical constraints, so centralizing them avoids drift across products.

## Reuse Tips
1. **Instantiate anywhere**: The constructor only reads env vars; no I/O occurs until you call a method. Perfect for serverless handlers or edge functions (just ensure `fetch` + env support).
2. **Swap storage**: Replace `saveKIETaskMetadata`/`updateKIETaskMetadata` with your preferred database, but keep the type identical so callbacks keep working.
3. **Provide callbacks**: Expose `KIE_CALLBACK_URL` publicly (use Vercel rewrites or API routes). Always validate signature/IP if your threat model requires it.
4. **Custom polling**: Wrap `waitForTaskCompletion` inside cron jobs or queues if you cannot expose a callback endpoint; tune `maxAttempts` based on your SLA.
5. **Share prompt utilities**: Because prompts sit in `lib/prompts.ts`, you can package them separately (e.g., npm workspace) and import them wherever the service is reused.
