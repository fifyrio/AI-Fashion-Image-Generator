# AI Fashion Image Generator

A Next.js 15 application using KIE AI services and Cloudflare R2 to generate and manage fashion images.

## Project Overview

This project is an AI-powered fashion image generator. It allows users to upload reference fashion images, analyzes them using AI, and generates new images featuring models wearing the analyzed clothing.

**Key Technologies:**
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **AI Service:** KIE (Async Image Generation), OpenRouter (GPT-4/Gemini for analysis)
- **Storage:** Cloudflare R2
- **Deployment:** Optimized for Vercel

## Architecture

### Directory Structure
- **`app/`**: Next.js App Router directory.
    - `app/page.tsx`: Main application canvas/interface.
    - `app/api/*`: API route handlers (e.g., `generate`, `callback`, `task-status`).
    - `app/globals.css`: Global styles and Tailwind directives.
- **`lib/`**: Core business logic.
    - `lib/kie-image-service.ts`: Primary service for interacting with KIE AI API (async tasks).
    - `lib/pipeline.ts`: Orchestrates the generation flow (Analysis -> Generation -> Storage).
    - `lib/r2.ts`: Cloudflare R2 storage utilities.
    - `lib/prompts.ts`: Centralized prompt strings (do not hardcode prompts elsewhere).
    - `lib/types.ts`: TypeScript definitions for the application.

### KIE Migration Status
The project has migrated from synchronous Gemini generation to an **asynchronous KIE workflow**:
1.  **Create Task:** API requests creating a generation task via `KIEImageService`.
2.  **Polling/Callback:** The system waits for completion via polling or webhook callbacks (`api/callback`).
3.  **Result:** Generated images are downloaded and stored in R2.

*See `MIGRATION_TO_KIE.md` for detailed migration notes.*

## Development

### Prerequisites
- Node.js (v20+ recommended)
- `npm`
- Valid `.env.local` configuration (see below)

### Setup & Commands

```bash
# Install dependencies
npm install

# Start development server (with Turbopack)
npm run dev

# Lint code
npm run lint

# Build for production
npm run build

# Start production server
npm run start
```

### Environment Variables
Create a `.env.local` file based on `.env.example`. Critical variables include:
- `OPENROUTER_API_KEY`: For text analysis.
- `KIE_API_TOKEN` & `KIE_CALLBACK_URL`: For image generation.
- `R2_*`: Cloudflare R2 storage credentials (`ACCOUNT_ID`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `BUCKET_NAME`).

## Coding Conventions

- **Style:** TypeScript with 4-space indentation.
- **Imports:** Use named exports.
- **File Naming:** Kebab-case for files (`lib/my-service.ts`), PascalCase for components (`app/MyComponent.tsx`).
- **State:** Prefer `async/await` patterns.
- **Prompts:** ALWAYS add new prompts to `lib/prompts.ts`; do not inline them in logic files.
- **Storage:** Persist all generated assets to R2. Do not rely on local filesystem persistence in production.

## Testing
There is no dedicated test harness.
- **Validation:** Run `npm run lint && npm run build` before committing.
- **Manual Testing:** Verify the full flow: Upload -> Reference Analysis -> Outfit Generation -> R2 Storage.
