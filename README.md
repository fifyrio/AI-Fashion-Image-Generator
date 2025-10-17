# AI Model Change Clothing (Web Edition)

This repository now focuses entirely on the Next.js 15 web experience for generating fashion imagery with AI. All legacy TypeScript command‑line scripts have been removed; every workflow (upload, analysis, generation, result browsing) runs through the web application and its API routes.

## Prerequisites

- Node.js 18+
- Cloudflare R2 bucket with API credentials
- OpenRouter (or compatible OpenAI) API key

Copy `.env.example` to `.env` (or `web-ui/.env.local`) and fill in:

```ini
OPENROUTER_API_KEY=...
SITE_URL=http://localhost:3000
SITE_NAME=Fashion Analysis Tool
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_BASE_URL=https://<your-public-r2-domain>
# Optional override for model reference assets
R2_MODEL_BASE_URL=https://<your-model-assets-domain>
```

## Install & Run

```bash
# install web dependencies
cd web-ui
npm install

# from repository root
npm run web        # start dev server
npm run web:lint   # lint the Next.js project
npm run web:build  # production build
```

Open <http://localhost:3000> to:

1. Upload reference photos (saved directly to Cloudflare R2)
2. Pick a character (`lin`, `Qiao`, `lin_home_1`, `ayi`)
3. Generate new images; the pipeline calls OpenRouter + Gemini and stores results in R2
4. Download finished renders from R2 links in the UI

All prompts, service helpers, and pipeline orchestration live under `web-ui/lib`. API routes (`/api/upload`, `/api/generate`, `/api/results`) call these modules directly—no external scripts required.

## Repository Layout

```
web-ui/
  app/            # Next.js routes (UI + API)
  lib/            # AI + Cloudflare service layer
  public/         # Static assets
  package.json    # Web project scripts and deps
.env.example      # Required environment variables
package.json      # Root scripts delegating to web-ui
```

For deeper details on the UI and endpoints, see [web-ui/README.md](web-ui/README.md).
