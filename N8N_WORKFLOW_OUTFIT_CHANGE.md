# N8N Workflow 文档 - 模特换装功能

## 概述

本文档描述如何使用 n8n 构建一个自动化的模特换装工作流。该工作流可以自动分析服装图片，并生成模特穿着该服装的AI图片，同时生成小红书标题。

## 工作流架构

```
┌─────────────────┐
│  触发器/输入    │
│  (图片URL)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  上传到R2存储   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  GPT分析服装    │
│  (OpenRouter)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  KIE生成图片    │
│  (创建任务)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  轮询任务状态   │
│  (等待完成)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  下载生成图片   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  生成小红书标题 │
│  (OpenRouter)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  保存到R2存储   │
│  (图片+元数据)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  返回结果       │
└─────────────────┘
```

## 环境变量配置

在 n8n 中配置以下环境变量或凭证：

```bash
# OpenRouter API (用于GPT分析)
OPENROUTER_API_KEY=your_openrouter_api_key
SITE_URL=https://your-site.com
SITE_NAME=Your Site Name

# Cloudflare R2 (对象存储)
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_bucket_name
R2_PUBLIC_BASE_URL=https://pub-xxx.r2.dev
R2_MODEL_BASE_URL=https://pub-xxx.r2.dev  # 可选，模特图片存储

# KIE API (图片生成服务)
KIE_API_TOKEN=your_kie_api_token
KIE_CALLBACK_URL=https://your-site.com/api/callback  # 可选，用于webhook回调
```

## 节点配置详解

### 1. 触发器节点 (Webhook/Manual Trigger)

**节点类型**: Webhook 或 Manual Trigger

**配置**:
```json
{
  "method": "POST",
  "path": "outfit-change",
  "responseMode": "lastNode"
}
```

**输入数据格式**:
```json
{
  "imageUrl": "https://example.com/reference-image.jpg",
  "character": "lin",
  "extractTopOnly": false,
  "wearMask": false
}
```

**参数说明**:
- `imageUrl`: 参考服装图片的URL (必填)
- `character`: 模特角色，可选值: `lin`, `Qiao`, `qiao_mask`, `mature_woman` (必填)
- `extractTopOnly`: 是否只提取上装，默认 `false` (可选)
- `wearMask`: 模特是否佩戴白色口罩，默认 `false` (可选)

---

### 2. 上传图片到R2 (HTTP Request)

**节点类型**: HTTP Request

**配置**:
```json
{
  "method": "PUT",
  "url": "https://{{ $env.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com/{{ $env.R2_BUCKET_NAME }}/uploads/{{ $now.format('YYYY-MM-DD') }}/{{ $randomUUID() }}.jpg",
  "authentication": "genericCredentialType",
  "genericAuthType": "awsS3",
  "sendBody": true,
  "bodyContentType": "raw",
  "rawBody": "={{ $binary.data }}"
}
```

**AWS S3 凭证配置**:
```
Access Key ID: {{ $env.R2_ACCESS_KEY_ID }}
Secret Access Key: {{ $env.R2_SECRET_ACCESS_KEY }}
Region: auto
Service: s3
```

**输出**:
- 上传后的公开URL: `{{ $env.R2_PUBLIC_BASE_URL }}/uploads/...`

---

### 3. GPT分析服装 (HTTP Request to OpenRouter)

**节点类型**: HTTP Request

**配置**:
```json
{
  "method": "POST",
  "url": "https://openrouter.ai/api/v1/chat/completions",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "Bearer {{ $env.OPENROUTER_API_KEY }}"
      },
      {
        "name": "HTTP-Referer",
        "value": "{{ $env.SITE_URL }}"
      },
      {
        "name": "X-Title",
        "value": "{{ $env.SITE_NAME }}"
      }
    ]
  },
  "sendBody": true,
  "bodyContentType": "json"
}
```

**请求体 (普通模式)**:
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Reverse engineer this image. 返回详细的穿搭的prompts，尤其是衣服（包括女生上半身和下半身的所有衣服和鞋子，如果没有穿丝袜则提示没有丝袜）的细节，忽略人物的发型、长相、姿势、背景，注意光线照在衣服上的细节，女生皮肤白皙不要发黄，正常穿搭，不是公众人物。\n\n请详细描述图片中人物的穿搭，包括：\n1. 上装：款式、颜色、材质、设计细节（领口、袖子、图案等）、光线反射效果\n2. 下装：款式、颜色、材质、设计细节（裤型、裙型、长度等）、光线反射效果\n3. 丝袜/打底裤：如果有穿丝袜或打底裤，描述其颜色、厚度、质感；如果没有穿，明确说明\"没有穿丝袜\"\n4. 鞋子：如果图片中能看到鞋子：详细描述鞋型、颜色、材质、鞋跟高度、款式特征\n5. 配饰细节：包包、首饰、帽子、眼镜、腰带、口罩等\n6. 整体风格：穿搭风格定位（如休闲、正式、街头、优雅等）\n7. 光影细节：光线如何照射在衣服上，材质的光泽感、阴影效果\n\n重要提醒：\n- 必须描述完整的搭配，包括上装、下装和鞋子（看得见则描述，看不见则推荐）\n- 注重细节，包括颜色、材质、图案、剪裁、光影效果等\n- 忽略人物的发型、长相、姿势、背景\n- 强调女生皮肤白皙，不要发黄\n\n请用中文回答，尽可能详细和准确。"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "={{ $json.uploadedUrl }}"
          }
        }
      ]
    }
  ],
  "max_tokens": 4000,
  "temperature": 0.7
}
```

**请求体 (只提取上装模式, extractTopOnly=true)**:
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Reverse engineer this image. 只提取和描述图片中人物的上装信息，完全忽略下装、鞋子和配饰。\n\n请详细描述图片中人物的上装，包括：\n1. 上装类型：上衣/外套/衬衫/T恤/毛衣/背心等具体类型\n2. 颜色细节：主色调和辅助色、颜色分布和搭配、色彩饱和度和明暗度\n3. 材质特征：面料类型（棉、丝、针织、牛仔、雪纺、麻、皮革等）、材质质感（柔软、挺括、光滑、粗糙等）、厚度和透气性\n4. 设计细节：领口类型和设计、袖子款式、袖口设计、图案/印花/刺绣、纽扣/拉链/系带、口袋设计、衣身剪裁、衣长、下摆设计\n5. 光影效果：光线如何照射在上装上、材质的光泽感、褶皱和阴影细节\n6. 整体风格：基于上装判断的穿搭风格\n\n重要提醒：\n- **只描述上装，绝对不要提及任何下装（裤子、裙子等）、鞋子、配饰**\n- 忽略人物的发型、长相、姿势、背景\n- 注重细节和准确性，描述要具体且详细\n- 女生皮肤白皙不要发黄\n- 如果上装有多层（如外套+内搭），请分别详细描述每一层\n\n请用中文回答，尽可能详细和准确。"
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "={{ $json.uploadedUrl }}"
          }
        }
      ]
    }
  ],
  "max_tokens": 4000,
  "temperature": 0.7
}
```

**输出**:
```json
{
  "clothingAnalysis": "={{ $json.choices[0].message.content }}"
}
```

---

### 4. 获取模特图片URL (Function)

**节点类型**: Function/Code

**代码**:
```javascript
const character = $input.item.json.character;
const modelBaseUrl = $env.R2_MODEL_BASE_URL || $env.R2_PUBLIC_BASE_URL;

// 固定使用 frame_1.jpg
const modelImageUrl = `${modelBaseUrl}/${character}/frame_1.jpg`;

return {
  json: {
    modelImageUrl: modelImageUrl,
    character: character
  }
};
```

---

### 5. KIE创建图片生成任务 (HTTP Request)

**节点类型**: HTTP Request

**配置**:
```json
{
  "method": "POST",
  "url": "https://api.kie.ai/api/v1/jobs/createTask",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "Bearer {{ $env.KIE_API_TOKEN }}"
      },
      {
        "name": "Content-Type",
        "value": "application/json"
      }
    ]
  },
  "sendBody": true,
  "bodyContentType": "json"
}
```

**请求体构建逻辑**:
```javascript
// 在 Function 节点中准备请求体
const clothingAnalysis = $input.item.json.clothingAnalysis;
const modelImageUrl = $input.item.json.modelImageUrl;
const extractTopOnly = $input.item.json.extractTopOnly || false;
const wearMask = $input.item.json.wearMask || false;

// 选择prompt
const basePrompt = extractTopOnly
  ? `保持人物身材一致（丰盈曲线、小蛮腰、宽胯），背景不变，光影自然；
皮肤整体雪白通透，裸露肌肤在柔和光线照射下泛着细腻的亮度；
肤色要白皙但不过曝，不偏蓝，整体呈柔光美感。

核心要求 - 必须严格遵守：
1. **完全保持模特的身材比例、体型和身高** - 不要改变模特的胖瘦、身材曲线、肩宽、腰围等任何身体特征
2. **完全保持模特的面部特征、肤色和发型** - 五官、肤色、发色、发型必须与原图一致
3. **肤色要求：裸露的皮肤（如面部、手臂、腿部等）要白皙通透，不要发黄或暗沉** - 所有裸露皮肤要呈现健康的白皙色调
4. **必须保持原图的背景环境完全不变** - 背景、场景、道具等完全不变
5. **保持模特的姿态、动作和表情** - 站姿、手势、表情等完全一致

服装替换要求 - **只改变上装**：
1. **只替换上装（上衣、外套、衬衫等）** - 仅改变上半身的衣服
2. **完全保持下装不变** - 裤子、裙子、短裤等下装必须与原图完全一致
3. **完全保持鞋子不变** - 如果原图中有鞋子，必须保持鞋子与原图完全一致
4. **完全保持丝袜/打底裤不变** - 如果原图中有丝袜或打底裤，必须保持与原图完全一致
5. **完全保持配饰不变** - 包包、帽子、眼镜、腰带等配饰必须与原图完全一致
6. 新上装要自然贴合模特身材，符合原有的身体曲线
7. 注意光影和材质细节，确保新上装与原背景的光线协调一致
8. 上装要与原有的下装搭配协调，整体看起来和谐自然

上装描述:`
  : `保持人物身材一致（丰盈曲线、小蛮腰、宽胯），背景不变，光影自然；
皮肤整体雪白通透，裸露肌肤在柔和光线照射下泛着细腻的亮度；
肤色要白皙但不过曝，不偏蓝，整体呈柔光美感。

核心要求 - 必须严格遵守：
1. **完全保持模特的身材比例、体型和身高** - 不要改变模特的胖瘦、身材曲线、肩宽、腰围等任何身体特征
2. **完全保持模特的面部特征、肤色和发型** - 五官、肤色、发色、发型必须与原图一致
3. **肤色要求：裸露的皮肤（如面部、手臂、腿部等）要白皙通透，不要发黄或暗沉** - 所有裸露皮肤要呈现健康的白皙色调
4. **必须保持原图的背景环境完全不变** - 背景、场景、道具等完全不变
5. **保持模特的姿态、动作和表情** - 站姿、手势、表情等完全一致

服装替换要求：
1. **只替换服装** - 仅改变衣服、裤子、鞋子等服装单品
2. **鞋子处理规则**：
   - 如果服装描述中包含鞋子的详细信息：必须在生成的图片中展示鞋子
   - 如果服装描述中没有提及鞋子：则不要在生成的图片中展示鞋子
3. 服装要自然贴合模特身材，符合原有的身体曲线
4. 注意光影和材质细节，确保新服装与原背景的光线协调一致
5. 根据服装描述的内容生成相应的搭配

服装描述:`;

// 如果需要戴口罩，添加口罩要求
const clothingWithMask = wearMask
  ? `${clothingAnalysis}\n\n特别要求：模特佩戴白色口罩。`
  : clothingAnalysis;

const fullPrompt = basePrompt + clothingWithMask;

return {
  json: {
    model: 'google/nano-banana-edit',
    callBackUrl: $env.KIE_CALLBACK_URL || '',
    input: {
      prompt: fullPrompt,
      image_urls: [modelImageUrl],
      output_format: 'png',
      image_size: '9:16'
    }
  }
};
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "taskId": "task_xxxxx"
  }
}
```

---

### 6. 轮询任务状态 (Loop + HTTP Request + Wait)

**节点类型**: Loop Until

**配置**:
- **最大迭代次数**: 30
- **循环条件**: `{{ $json.status !== 'success' && $json.status !== 'failed' }}`

**6a. 等待节点 (Wait)**
```json
{
  "unit": "seconds",
  "amount": 2
}
```

**6b. 查询任务状态 (HTTP Request)**
```json
{
  "method": "GET",
  "url": "https://api.kie.ai/api/v1/jobs/getTask?taskId={{ $json.taskId }}",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "Bearer {{ $env.KIE_API_TOKEN }}"
      }
    ]
  }
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "taskId": "task_xxxxx",
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://...\"]}"
  }
}
```

---

### 7. 提取结果URL (Function)

**节点类型**: Function/Code

**代码**:
```javascript
const data = $input.item.json.data;
const resultJson = JSON.parse(data.resultJson);

if (!resultJson.resultUrls || resultJson.resultUrls.length === 0) {
  throw new Error('No result URLs found');
}

return {
  json: {
    generatedImageUrl: resultJson.resultUrls[0],
    allResultUrls: resultJson.resultUrls,
    taskId: data.taskId
  }
};
```

---

### 8. 下载生成的图片 (HTTP Request)

**节点类型**: HTTP Request

**配置**:
```json
{
  "method": "GET",
  "url": "={{ $json.generatedImageUrl }}",
  "responseFormat": "file",
  "dataPropertyName": "generatedImage"
}
```

---

### 9. 生成小红书标题 (HTTP Request)

**节点类型**: HTTP Request

**配置**:
```json
{
  "method": "POST",
  "url": "https://openrouter.ai/api/v1/chat/completions",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "sendHeaders": true,
  "headerParameters": {
    "parameters": [
      {
        "name": "Authorization",
        "value": "Bearer {{ $env.OPENROUTER_API_KEY }}"
      },
      {
        "name": "HTTP-Referer",
        "value": "{{ $env.SITE_URL }}"
      },
      {
        "name": "X-Title",
        "value": "{{ $env.SITE_NAME }}"
      }
    ]
  },
  "sendBody": true,
  "bodyContentType": "json"
}
```

**请求体**:
```json
{
  "model": "openai/gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "你是一位专业的小红书内容创作专家，擅长创作吸引眼球的爆款标题。\n\n请根据以下服装描述，创作一个符合小红书风格的爆款标题。\n\n【标题公式】\n主标题：〔形容词+单品〕✖️〔数字符号〕！！〔情绪句/疑问句〕\n副标题：10个话题标签\n\n【创作要求】\n1. 主标题要有冲击力和吸引力，使用夸张但不浮夸的表达\n2. 数字符号要选择与服装风格匹配的emoji（如：❤️、⚡、🔥、✨、💫等）\n3. 情绪句/疑问句要能引起共鸣（如：谁懂啊！真的绝了！你还不知道吗？姐妹们冲！）\n4. 话题标签要精准且有流量（10个标签，每个都要加#）\n\n【输出格式】\n只输出标题内容，不要任何解释说明。格式如下：\n\n【主标题内容】\n\n#标签1 #标签2 #标签3 #标签4 #标签5 #标签6 #标签7 #标签8 #标签9 #标签10\n\n---\n\n现在请根据以下信息生成标题：\n服装描述：{{ $json.clothingAnalysis }}"
    }
  ],
  "max_tokens": 2000,
  "temperature": 0.8
}
```

**输出**:
```json
{
  "xiaohongshuTitle": "={{ $json.choices[0].message.content.trim() }}"
}
```

---

### 10. 上传生成图片到R2 (HTTP Request)

**节点类型**: HTTP Request

**配置**:
```json
{
  "method": "PUT",
  "url": "https://{{ $env.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com/{{ $env.R2_BUCKET_NAME }}/generated/{{ $json.character }}/{{ $now.format('YYYY-MM-DD-HH-mm-ss') }}-{{ $randomUUID() }}.png",
  "authentication": "genericCredentialType",
  "genericAuthType": "awsS3",
  "sendBody": true,
  "bodyContentType": "raw",
  "rawBody": "={{ $binary.generatedImage.data }}"
}
```

---

### 11. 保存元数据到R2 (HTTP Request)

**节点类型**: HTTP Request

**配置**:
```json
{
  "method": "PUT",
  "url": "https://{{ $env.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com/{{ $env.R2_BUCKET_NAME }}/generated/{{ $json.character }}/{{ $json.imageKey }}.json",
  "authentication": "genericCredentialType",
  "genericAuthType": "awsS3",
  "sendBody": true,
  "bodyContentType": "json"
}
```

**请求体**:
```json
{
  "createdAt": "={{ $now.toISOString() }}",
  "character": "={{ $json.character }}",
  "source": {
    "key": "={{ $json.sourceKey }}",
    "url": "={{ $json.sourceUrl }}",
    "filename": "={{ $json.sourceFilename }}"
  },
  "imageKey": "={{ $json.generatedImageKey }}",
  "imageUrl": "={{ $json.generatedImageUrl }}",
  "analysis": "={{ $json.clothingAnalysis }}",
  "xiaohongshuTitle": "={{ $json.xiaohongshuTitle }}"
}
```

---

### 12. 返回结果 (Respond to Webhook)

**节点类型**: Respond to Webhook

**配置**:
```json
{
  "options": {
    "responseCode": 200
  }
}
```

**响应体**:
```json
{
  "success": true,
  "character": "={{ $json.character }}",
  "generated": {
    "imageUrl": "={{ $json.generatedImageUrl }}",
    "imageKey": "={{ $json.generatedImageKey }}",
    "metadataUrl": "={{ $json.metadataUrl }}",
    "xiaohongshuTitle": "={{ $json.xiaohongshuTitle }}",
    "analysis": "={{ $json.clothingAnalysis }}"
  },
  "taskId": "={{ $json.taskId }}"
}
```

---

## 完整工作流示例 (JSON)

以下是完整的 n8n workflow JSON，可以直接导入到 n8n：

```json
{
  "name": "模特换装工作流",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "outfit-change",
        "responseMode": "lastNode",
        "options": {}
      },
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "url": "={{ $json.imageUrl }}",
        "responseFormat": "file",
        "options": {}
      },
      "name": "下载参考图片",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [450, 300]
    },
    {
      "parameters": {
        "authentication": "genericCredentialType",
        "genericAuthType": "awsS3",
        "requestMethod": "PUT",
        "url": "=https://{{ $env.R2_ACCOUNT_ID }}.r2.cloudflarestorage.com/{{ $env.R2_BUCKET_NAME }}/uploads/{{ $now.format('YYYY-MM-DD') }}/{{ $randomUUID() }}.jpg",
        "sendBody": true,
        "bodyContentType": "raw",
        "rawBody": "={{ $binary.data }}"
      },
      "name": "上传到R2",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [650, 300]
    },
    {
      "parameters": {
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "requestMethod": "POST",
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.OPENROUTER_API_KEY }}"
            }
          ]
        },
        "sendBody": true,
        "bodyContentType": "json",
        "jsonBody": "={\n  \"model\": \"openai/gpt-4o\",\n  \"messages\": [\n    {\n      \"role\": \"user\",\n      \"content\": [\n        {\n          \"type\": \"text\",\n          \"text\": \"Reverse engineer this image. 返回详细的穿搭的prompts...\"\n        },\n        {\n          \"type\": \"image_url\",\n          \"image_url\": {\n            \"url\": \"{{ $json.uploadedUrl }}\"\n          }\n        }\n      ]\n    }\n  ],\n  \"max_tokens\": 4000,\n  \"temperature\": 0.7\n}"
      },
      "name": "GPT分析服装",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [850, 300]
    },
    {
      "parameters": {
        "jsCode": "const character = $input.item.json.character;\nconst modelBaseUrl = $env.R2_MODEL_BASE_URL || $env.R2_PUBLIC_BASE_URL;\nconst randomNumber = Math.floor(Math.random() * 10) + 1;\nconst modelImageUrl = `${modelBaseUrl}/${character}/frame_${randomNumber}.jpg`;\n\nreturn {\n  json: {\n    modelImageUrl: modelImageUrl,\n    character: character\n  }\n};"
      },
      "name": "获取模特图片",
      "type": "n8n-nodes-base.code",
      "typeVersion": 1,
      "position": [1050, 300]
    },
    {
      "parameters": {
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "requestMethod": "POST",
        "url": "https://api.kie.ai/api/v1/jobs/createTask",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.KIE_API_TOKEN }}"
            }
          ]
        },
        "sendBody": true,
        "bodyContentType": "json"
      },
      "name": "KIE创建任务",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [1250, 300]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.data.state }}",
              "operation": "notEquals",
              "value2": "success"
            }
          ]
        },
        "options": {
          "maxIterations": 30
        }
      },
      "name": "Loop Until Task Complete",
      "type": "n8n-nodes-base.loopUntil",
      "typeVersion": 1,
      "position": [1450, 300]
    },
    {
      "parameters": {
        "unit": "seconds",
        "amount": 2
      },
      "name": "Wait 2s",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1,
      "position": [1650, 300]
    },
    {
      "parameters": {
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "url": "=https://api.kie.ai/api/v1/jobs/getTask?taskId={{ $json.data.taskId }}",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "=Bearer {{ $env.KIE_API_TOKEN }}"
            }
          ]
        }
      },
      "name": "查询任务状态",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 3,
      "position": [1850, 300]
    }
  ],
  "connections": {
    "Webhook": {
      "main": [[{ "node": "下载参考图片", "type": "main", "index": 0 }]]
    },
    "下载参考图片": {
      "main": [[{ "node": "上传到R2", "type": "main", "index": 0 }]]
    },
    "上传到R2": {
      "main": [[{ "node": "GPT分析服装", "type": "main", "index": 0 }]]
    },
    "GPT分析服装": {
      "main": [[{ "node": "获取模特图片", "type": "main", "index": 0 }]]
    },
    "获取模特图片": {
      "main": [[{ "node": "KIE创建任务", "type": "main", "index": 0 }]]
    },
    "KIE创建任务": {
      "main": [[{ "node": "Loop Until Task Complete", "type": "main", "index": 0 }]]
    }
  }
}
```

---

## 错误处理

### 常见错误及解决方案

1. **GPT分析失败**
   - 检查 OPENROUTER_API_KEY 是否正确
   - 检查图片URL是否可访问
   - 确认图片格式为 JPG/PNG

2. **KIE任务创建失败**
   - 检查 KIE_API_TOKEN 是否有效
   - 确认账户有足够的积分
   - 检查模特图片URL是否可访问

3. **任务超时**
   - 默认轮询30次(60秒)，可以增加maxAttempts
   - 检查KIE服务状态

4. **R2上传失败**
   - 检查R2凭证是否正确
   - 确认bucket权限设置
   - 检查bucket名称是否正确

---

## 性能优化建议

1. **并行处理**: 如果有多张图片，可以使用 Split In Batches 节点并行处理
2. **缓存模特图片**: 预先下载常用的模特图片到本地
3. **异步处理**: 使用webhook回调代替轮询，提高效率
4. **错误重试**: 添加错误重试机制，提高成功率

---

## 测试示例

### 输入数据
```json
{
  "imageUrl": "https://example.com/dress.jpg",
  "character": "lin",
  "extractTopOnly": false,
  "wearMask": false
}
```

### 预期输出
```json
{
  "success": true,
  "character": "lin",
  "generated": {
    "imageUrl": "https://pub-xxx.r2.dev/generated/lin/2025-01-15-12-30-45-uuid.png",
    "imageKey": "generated/lin/2025-01-15-12-30-45-uuid.png",
    "metadataUrl": "https://pub-xxx.r2.dev/generated/lin/2025-01-15-12-30-45-uuid.json",
    "xiaohongshuTitle": "【显瘦连衣裙】✖️❤️🔥！！这谁顶得住啊！\n\n#打工人 #日常穿搭 #法式复古 #显瘦遮肉 #OOTD #连衣裙 #黑色穿搭 #春季穿搭 #梨型身材 #平价好物",
    "analysis": "上装：黑色修身连衣裙，V领设计..."
  },
  "taskId": "task_xxxxx"
}
```

---

## 高级功能

### 批量处理多张图片

添加 **Split In Batches** 节点：

```json
{
  "parameters": {
    "batchSize": 5,
    "options": {}
  },
  "name": "Split In Batches",
  "type": "n8n-nodes-base.splitInBatches"
}
```

### Webhook回调处理

创建一个单独的workflow接收KIE回调：

```json
{
  "parameters": {
    "httpMethod": "POST",
    "path": "kie-callback",
    "responseMode": "onReceived"
  },
  "name": "KIE Callback Webhook",
  "type": "n8n-nodes-base.webhook"
}
```

---

## 安全建议

1. **API密钥管理**: 使用 n8n 的环境变量或凭证存储
2. **Webhook认证**: 为webhook添加认证头
3. **速率限制**: 添加速率限制防止滥用
4. **错误日志**: 记录所有错误到日志系统

---

## 总结

这个n8n工作流实现了完整的模特换装功能，包括：

✅ 图片上传和存储
✅ AI服装分析 (GPT-4)
✅ AI图片生成 (KIE)
✅ 小红书标题生成
✅ 元数据管理
✅ 完整的错误处理

可以根据实际需求调整和扩展此工作流。

---

**文档版本**: 1.0
**更新日期**: 2025-01-15
**兼容 n8n 版本**: 1.0+
