# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Primary Commands

- `npm run dev` – start the Next.js 15 dev server
- `npm run build` – create a production build
- `npm run start` – start production server
- `npm run lint` – lint the application
- `npm install` – install dependencies if needed

## Architecture Overview

This is a **Next.js 15 web application** using the App Router:

- `app/` – Next.js routes (UI + API endpoints)
- `lib/` – service layer (OpenRouter integration, Cloudflare R2 client, orchestration pipeline, shared prompts/types)
- Cloudflare R2 stores every uploaded reference and generated asset; no local file storage

### Core Services

- `ai-service.ts` – wraps OpenRouter GPT calls for analysis + title generation
- `image-generator.ts` – invokes Gemini to render outfits
- `pipeline.ts` – orchestrates the full workflow: analyze → generate → upload result metadata
- `r2.ts` – uploads, lists, and retrieves objects in Cloudflare R2

### API Routes

- `POST /api/upload` – pushes files straight to R2 and returns their public URLs
- `POST /api/generate` – triggers the pipeline for the selected character using the uploaded references
- `GET /api/results` – lists generated assets (reads metadata from R2)

## Environment Variables

Configure the values from `.env.example` (OpenRouter + Cloudflare R2 credentials). For local development use `.env.local`.

Required environment variables:
- `OPENROUTER_API_KEY` – OpenRouter API key
- `SITE_URL` – Your site URL for OpenRouter
- `SITE_NAME` – Your site name for OpenRouter
- `R2_ACCOUNT_ID` – Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID` – Cloudflare R2 access key ID
- `R2_SECRET_ACCESS_KEY` – Cloudflare R2 secret access key
- `R2_BUCKET_NAME` – Cloudflare R2 bucket name
- `R2_PUBLIC_BASE_URL` – Public base URL for R2 bucket
- `R2_MODEL_BASE_URL` – (Optional) Base URL for model images

## Deployment on Vercel

This project is configured for seamless deployment on Vercel:

1. **Push to GitHub**: Ensure your code is in a GitHub repository
2. **Import to Vercel**: Import your repository in the Vercel dashboard
3. **Configure Environment Variables**: Add all required environment variables in Vercel project settings
4. **Deploy**: Vercel will automatically detect Next.js and deploy

The `vercel.json` configuration:
- Framework: Next.js
- Region: Hong Kong (hkg1) - adjust as needed
- Environment variables are referenced using Vercel's secret system
- API routes are configured with 60-second max duration

## Development Notes

- TypeScript uses ES modules; keep imports relative and named
- Avoid `fs` access in server code—use R2 instead
- Prefer the shared interfaces in `lib/types.ts`
- When adding new workflows, expose them via `lib/pipeline.ts` and call them from API routes
- Document manual verification steps (upload → generate → verify R2 objects) in PRs
- The project uses Turbopack for faster builds (Next.js 15 feature)
