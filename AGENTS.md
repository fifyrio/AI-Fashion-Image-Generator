# Repository Guidelines

## Project Structure & Module Organization
Next.js v15 lives entirely under `app/`: `app/page.tsx` hosts the fashion workflow, `app/api/*` contains upload + generation handlers, and `app/globals.css` centralizes Tailwind 4 styles. Shared logic (OpenAI prompts, R2 uploads, pipeline orchestration) belongs in `lib/`—see `lib/ai-service.ts`, `lib/pipeline.ts`, and `lib/r2.ts`. Keep reusable types in `lib/types.ts` and prompt strings in `lib/prompts.ts`. When static assets are required, place them in `public/` (create it if missing) and reference with Next’s asset pipeline. Never commit generated imagery; persist it via Cloudflare R2 only.

## Build, Test, and Development Commands
- `npm run dev` — Launches the Turbopack dev server with hot reload; start it from the repo root so `.env.local` is observed.
- `npm run build` — Runs the production Next build (also Turbopack) plus type checks; use this before merges.
- `npm run start` — Serves the compiled build; useful for verifying deployment parity.
- `npm run lint` — Executes ESLint with `eslint-config-next`; fails on formatting, unused vars, or TypeScript issues.

## Coding Style & Naming Conventions
Author TypeScript/TSX with four-space indentation, ES modules, and named exports only. Files use kebab-case (`lib/ai-service.ts`), React components use PascalCase, and helpers/utilities use camelCase. Prefer `async/await`, keep logging brief and redact identifiers, and funnel prompt text through `lib/prompts.ts` so localization stays centralized. Tailwind 4 utilities live in `app/globals.css`; avoid inline styles unless dynamic.

## Testing Guidelines
There is no automated test harness, so rely on lint + build plus manual smoke tests. For every change: run `npm run lint`, then `npm run build`. Manually exercise the UI flow (upload source image → request outfit change → download result), confirm R2 uploads via the console or `listObjects` helper, and watch OpenAI/OpenRouter quotas. Capture URLs or screenshots of successful runs for the PR description.

## Commit & Pull Request Guidelines
Commits follow a Conventional Commit flavor: `type(scope): summary` (≤72 chars), e.g., `feat(app): add hairstyle picker`. Use bodies to justify changes, note env needs, and record manual checks. PRs should explain motivation, summarize architectural or schema impacts, enumerate validation steps (commands + screenshots), link issues, and flag TODOs or follow-ups.

## Security & Configuration Tips
Copy `.env.example` to `.env.local` and provide `OPENAI_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and any public base URL. Keep secrets out of commits and logs; redact task IDs when referencing customer data. Always prefer R2 for generated files and purge temporary downloads after verification.
