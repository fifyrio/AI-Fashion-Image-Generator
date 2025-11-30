# Repository Guidelines

## Project Structure & Module Organization
Next.js v15 routes live in `app/`, with the primary canvas at `app/page.tsx`, API handlers under `app/api/*`, and Tailwind 4 utilities centralized in `app/globals.css`. Core logic sits in `lib/` (pipelines, R2 helpers, prompt utilities, and shared types). Prompt strings must flow through `lib/prompts.ts` to keep messaging consistent. Persist generated imagery exclusively in Cloudflare R2; only static references belong in `public/`.

## Build, Test, and Development Commands
- `npm run dev`: Turbopack dev server with `.env.local` applied; use for rapid feature work.
- `npm run lint`: ESLint via `eslint-config-next` for formatting, unused vars, and TS correctness.
- `npm run build`: Production bundle plus type-checking; required before any PR.
- `npm run start`: Serves `.next/` output to mirror deployment.

## Coding Style & Naming Conventions
Write TypeScript/TSX with four-space indentation, ES modules, and named exports. Directories follow kebab-case (`lib/ai-service.ts`), React components use PascalCase, and helper functions use camelCase. Prefer `async/await`, strip PII from logs, and keep prompt plumbing inside `lib/prompts.ts`. Inline styles are acceptable only for dynamic values; otherwise lean on Tailwind utilities already defined in `app/globals.css`.

## Testing Guidelines
There is no dedicated test harness, so treat lint and build as the minimum safety net. Run `npm run lint && npm run build` on every branch. Manually walk the outfit flow (upload reference → request outfit swap → download result) and verify R2 persistence via console or `listObjects`. Capture screenshots or hosted links to share in PRs as evidence.

## Commit & Pull Request Guidelines
Use Conventional Commits such as `feat(app): add hairstyle picker`, and include rationale, environment changes, and manual verification notes in the body. PRs should outline motivation, architectural touchpoints, and schema impacts, list the validation commands executed, attach screenshots of successful runs, link relevant issues, and flag TODOs or future follow-ups. Never include secrets or generated binaries/artifacts in the diff.

## Security & Configuration Tips
Copy `.env.example` to `.env.local` and fill `OPENAI_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `REPLICATE_API_TOKEN`, and any public base URL. Store secrets locally, redact task identifiers when logging, prefer R2 for any derivative assets, and delete temporary downloads after validation to minimize data leakage.
