# Repository Guidelines

## Project Structure & Module Organization
All customer-facing UI work happens under `web-ui/`, a Next.js application. Pages and routes belong in `web-ui/app/`; colocate API handlers in `web-ui/app/api/` and shared UI utilities in `web-ui/lib/`. Store static assets in `web-ui/public/` and shared TypeScript types in `web-ui/lib/types.ts`. Generated imagery and uploads are always written to Cloudflare R2—do not create local `generated/` folders or check in binaries.

## Build, Test, and Development Commands
Use the root scripts to keep tooling consistent: `npm run web` starts the dev server, `npm run web:build` performs the production build, and `npm run web:lint` runs the lint suite inside `web-ui/`. Run these commands from the repository root so environment variables resolve via the shared `.env` file.

## Coding Style & Naming Conventions
Author TypeScript as ES modules with four-space indentation. Export named functions or components; avoid default exports. Files in `web-ui/` follow kebab-case (`ai-service.ts`), while symbols use PascalCase for components and camelCase for helpers. Reach for `async/await`, reuse shared types from `web-ui/lib/types.ts`, and centralize prompt strings in `web-ui/lib/prompts/`. Keep log output short, actionable, and redact identifiers.

## Testing Guidelines
We rely on manual validation. Before opening a PR, run `npm run web:lint` and, when code paths change, `npm run web:build` to catch type or bundler errors. Smoke-test image generation end-to-end, confirm R2 uploads succeed, and monitor OpenRouter logs for throttling. Capture URLs or screenshots of your manual checks to include in the PR description.

## Commit & Pull Request Guidelines
Follow the Conventional Commit-inspired format `type(scope): summary`, written in the imperative and ≤72 characters (`chore(web-ui): align env config`). In commit bodies, note rationale, environment prerequisites, and manual verification steps. PRs should describe the motivation, summarize architecture or schema changes, enumerate validation steps, and attach before/after visuals for UI adjustments. Link related issues and flag any follow-up work.

## Security & Configuration Tips
Clone `.env.example` to `.env.local`, supply OpenRouter and Cloudflare R2 credentials, and document any extra URLs required for previews. Do not commit secrets or raw API payloads. When sharing logs or screenshots, scrub tokens and customer data, and prefer sanitized demo assets.
