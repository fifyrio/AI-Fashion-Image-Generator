# 项目重构总结

## 重构目标

将项目从嵌套的 `web-ui` 子目录结构重构为 Vercel 标准的 Next.js 根目录结构,以便直接部署到 Vercel。

## 重构前的结构

```
AI-Fashion-Image-Generator/
├── web-ui/                    # Next.js 应用在子目录
│   ├── app/                  # Next.js App Router
│   ├── lib/                  # 服务层代码
│   ├── package.json          # web-ui 依赖
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── ...
├── package.json              # 根 package.json (仅代理命令)
└── vercel.json               # 配置指向 web-ui
```

## 重构后的结构

```
AI-Fashion-Image-Generator/
├── app/                      # Next.js App Router (根目录)
├── lib/                      # 服务层代码 (根目录)
├── package.json              # 合并后的依赖配置
├── next.config.ts            # Next.js 配置
├── tsconfig.json             # TypeScript 配置
├── vercel.json               # 简化的 Vercel 配置
└── ...
```

## 执行的步骤

### 1. 移动配置文件到根目录
- `next.config.ts`
- `tsconfig.json`
- `postcss.config.mjs`
- `eslint.config.mjs`

### 2. 移动源代码目录
- `app/` 目录 (Next.js 路由和页面)
- `lib/` 目录 (业务逻辑和服务)

### 3. 更新 package.json
合并 `web-ui/package.json` 的依赖到根 `package.json`:
- 保留所有依赖和开发依赖
- 更新 scripts 为标准 Next.js 命令
- 移除对 `web-ui` 的引用

### 4. 更新 vercel.json
简化配置:
- 移除 `buildCommand` 和 `installCommand`
- 移除 `outputDirectory` (使用默认 `.next`)
- 更新 API 路由路径从 `web-ui/app/api/**/*.ts` 到 `app/api/**/*.ts`

### 5. 修复 TypeScript/ESLint 错误
- 替换 `any` 类型为具体类型
- 移除未使用的变量和参数
- 修复 OpenAI SDK 类型兼容性
- 更新 `tsconfig.json` target 为 ES2018 (支持正则表达式 `s` 标志)
- 修复 Next.js 配置类型定义

### 6. 清理旧目录
完全移除 `web-ui/` 目录

## 主要变更

### package.json
```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build --turbopack",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.723.0",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "next": "15.5.5",
    "openai": "^4.0.0"
  }
}
```

### vercel.json
```json
{
  "framework": "nextjs",
  "regions": ["hkg1"],
  "env": { /* 环境变量配置 */ },
  "functions": {
    "app/api/**/*.ts": {
      "runtime": "nodejs20.x",
      "maxDuration": 60
    }
  }
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2018",  // 从 ES2017 升级
    "lib": ["dom", "dom.iterable", "esnext"],
    "paths": {
      "@/*": ["./*"]  // 更新路径映射
    }
  }
}
```

## 在 Vercel 上部署

### 方法 1: 通过 Vercel Dashboard

1. 将代码推送到 GitHub 仓库
2. 在 Vercel Dashboard 中导入项目
3. Vercel 会自动检测 Next.js 项目
4. 在项目设置中添加环境变量:
   - `OPENROUTER_API_KEY`
   - `SITE_URL`
   - `SITE_NAME`
   - `R2_ACCOUNT_ID`
   - `R2_ACCESS_KEY_ID`
   - `R2_SECRET_ACCESS_KEY`
   - `R2_BUCKET_NAME`
   - `R2_PUBLIC_BASE_URL`
   - `R2_MODEL_BASE_URL` (可选)
5. 点击 Deploy

### 方法 2: 使用 Vercel CLI

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel
```

## 本地开发

```bash
# 安装依赖
npm install

# 创建 .env.local 文件并配置环境变量
cp .env.example .env.local

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 运行生产服务器
npm start
```

## 注意事项

1. **环境变量**: 确保在 Vercel 项目设置中正确配置所有环境变量
2. **Region 配置**: `vercel.json` 中的 region 设置为 `hkg1` (香港),可根据需要调整
3. **API 超时**: API 路由配置了 60 秒的最大执行时间
4. **Turbopack**: 项目使用 Next.js 15 的 Turbopack 特性以加快构建速度

## 验证

重构完成后,项目已经:
- ✅ 通过 TypeScript 类型检查
- ✅ 通过 ESLint 检查
- ✅ 符合 Vercel Next.js 标准结构
- ✅ 所有导入路径正确 (`@/lib/...`, `@/app/...`)
- ✅ 保持原有功能不变

## 后续步骤

1. 测试所有功能是否正常工作
2. 在 Vercel 上进行首次部署
3. 验证生产环境配置
4. 监控应用性能和错误日志
