# Repository Guidelines

## Project Structure & Module Organization
The repository now centers on the Next.js application in `web-ui/`. Shared helpers (AI prompts, R2 client, pipeline orchestration) live under `web-ui/lib`. All uploads and generated assets are stored in Cloudflare R2; no local `generated/` or `chuandai/` directories are used anymore.

## Build, Test, and Development Commands
- `npm run web` launches the Next.js UI (root script delegates to `web-ui`).
- `npm run web:build` runs the production build.
- `npm run web:lint` performs linting inside `web-ui/`.

## Coding Style & Naming Conventions
Write TypeScript as ES modules with four-space indentation and focused, named exports. Keep filenames in kebab-case (for example, `ai-service.ts`) and exported symbols in PascalCase or camelCase. Prefer `async/await`, reuse the shared interfaces in `web-ui/lib/types.ts`, centralize prompt strings, and keep log messages concise and actionable.

## Testing Guidelines
There is no automated suite; rely on manual smoke tests. Verify uploads land in Cloudflare R2, review API logs for OpenRouter rate-limit warnings, and run `npm run web:lint` or `npm run web:build` when touching application code. Document observed results (URLs, screenshots) in PR notes for reviewers.

## Commit & Pull Request Guidelines
Follow the `type(scope): summary` subject style with imperative verbs and ≤72 characters (for example, `chore(web-ui): align env config`). Explain rationale, environment requirements, and manual verification commands in commit bodies or PR descriptions. Pull requests should highlight the motivation, outline major implementation points, list validation steps, and include before/after imagery for UI changes.

## Security & Configuration Tips
Copy `.env.example`, provide OpenRouter and Cloudflare R2 credentials, and export any additional URLs required for deployment. Never commit credentials or raw API responses. When sharing diagnostics, rely on sanitized demo assets and strip tokens from logs or screenshots before attaching them to issues or PRs.
