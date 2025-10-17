# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Primary Commands

- `npm run web` – start the Next.js 15 dev server (delegates to `web-ui`)
- `npm run web:lint` – lint the web application
- `npm run web:build` – create a production build
- `npm --prefix web-ui install` – install dependencies if needed

## Architecture Overview

The project is now **web-only**:

- `web-ui/app` – Next.js routes (UI + API endpoints)
- `web-ui/lib` – service layer (OpenRouter integration, Cloudflare R2 client, orchestration pipeline, shared prompts/types)
- Cloudflare R2 stores every uploaded reference and generated asset; local folders like `generated/` no longer exist.

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

Configure the values from `.env.example` (OpenRouter + Cloudflare R2 credentials). For local development use `.env` or `web-ui/.env.local`.

## Development Notes

- TypeScript uses ES modules; keep imports relative and named.
- Avoid `fs` access in server code—use R2 instead.
- Prefer the shared interfaces in `web-ui/lib/types.ts`.
- When adding new workflows, expose them via `web-ui/lib/pipeline.ts` and call them from API routes.
- Document manual verification steps (upload → generate → verify R2 objects) in PRs.
