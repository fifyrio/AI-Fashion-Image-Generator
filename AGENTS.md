# Repository Guidelines

## Project Structure & Module Organization
Next.js v15 lives under `app/`. The user-facing workflow is `app/page.tsx`, API routes sit in `app/api/*`, and shared Tailwind 4 utilities stay in `app/globals.css`. Shared logic belongs in `lib/`—notably `lib/ai-service.ts`, `lib/pipeline.ts`, `lib/r2.ts`, and typed contracts in `lib/types.ts`, while prompt text is centralized in `lib/prompts.ts`. Place static assets inside `public/` and reference them with standard Next asset imports. Persist generated imagery only through Cloudflare R2.

## Build, Test, and Development Commands
- `npm run dev`: Launch Turbopack dev server from repo root; honors `.env.local`.
- `npm run lint`: Run ESLint via `eslint-config-next` to catch formatting, unused vars, and TS issues.
- `npm run build`: Production build plus type checks; run before merges.
- `npm run start`: Serve the compiled build for deployment parity verification.

## Coding Style & Naming Conventions
Use TypeScript/TSX with four-space indentation, named exports, and ES modules. Files use kebab-case (`lib/ai-service.ts`), React components use PascalCase, and helpers employ camelCase. Prefer `async/await`, keep logs concise and scrub identifiers, and pipe prompt strings through `lib/prompts.ts`. Tailwind utilities stay in `app/globals.css`; reserve inline styles for dynamic needs only.

## Testing Guidelines
There is no automated harness beyond lint and build. Run `npm run lint` followed by `npm run build` for every change. Manually exercise the fashion flow (upload image → request outfit change → download result) and confirm Cloudflare R2 uploads via the console or `listObjects`. Capture URLs or screenshots of successful runs for PR evidence.

## Commit & Pull Request Guidelines
Commits follow Conventional Commit syntax, e.g., `feat(app): add hairstyle picker`, with bodies documenting rationale, env updates, and manual checks. PRs should describe motivation, summarize architecture or schema impacts, list validation commands plus screenshots, link issues, and flag TODOs or follow-ups. Never commit secrets or generated imagery.

## Security & Configuration Tips
Copy `.env.example` to `.env.local` and supply `OPENAI_API_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and any public base URL. Keep all secrets local, redact task IDs in logs, prefer R2 for generated files, and purge temporary downloads after verification.
