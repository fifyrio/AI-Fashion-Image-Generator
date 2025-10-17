# AI Fashion Image Generator - Web UI

A modern web interface for the AI Fashion Image Generator project, built with Next.js 15, TypeScript, and Tailwind CSS.

## Features

- **Image Upload**: Upload fashion images directly to Cloudflare R2 storage
- **Character Selection**: Choose from four character models:
  - `lin`
  - `Qiao`
  - `lin_home_1`
  - `ayi`
- **Cloud Pipeline**: Run the TypeScript image pipeline directly without shell commands
- **Real-time Feedback**: Visual status updates for upload and generation progress
- **Responsive Design**: Beautiful, mobile-friendly UI with gradient backgrounds and smooth animations

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Parent project environment configured (`.env` file with API keys)

### Installation

The dependencies are already installed when you created the Next.js project. If needed, you can reinstall:

```bash
cd web-ui
npm install
```

### Running the Development Server

From the **parent directory**:

```bash
npm run web
```

Or directly from the `web-ui` directory:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

1. **Upload Images**
   - Click the upload area or drag and drop your images (max 10MB each)
   - Click "Upload to Cloudflare R2" to push the files to your configured bucket

2. **Select a Character**
   - Choose one of the available characters: `lin`, `Qiao`, `lin_home_1`, or `ayi`

3. **Generate Images**
   - Click the "Generate Images" button
   - The server analyzes each uploaded image via its R2 URL, generates prompts, and invokes the TypeScript pipeline directly
   - Wait for the AI to process and generate new images, which are saved back to R2

## API Routes

### POST `/api/upload`

Uploads one or more image files to your configured Cloudflare R2 bucket.

**Request**: `FormData` with one or more `files`

**Response**:
```json
{
  "success": true,
  "uploaded": [
    {
      "filename": "image.jpg",
      "key": "uploads/2024-08-30-12-00-00-123Z-uuid.jpg",
      "url": "https://<public-domain>/uploads/..."
    }
  ],
  "uploadedCount": 1,
  "totalCount": 1,
  "message": "Uploaded 1 of 1 file(s) to Cloudflare R2"
}
```

### POST `/api/generate`

Runs the image generation pipeline directly with the provided R2 references.

**Request**:
```json
{
  "character": "lin",
  "uploads": [
    {
      "key": "uploads/...",
      "url": "https://<public-domain>/uploads/...",
      "filename": "image.jpg"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "character": "lin",
  "generated": [
    {
      "imageKey": "generated/lin/...jpg",
      "imageUrl": "https://<public-domain>/generated/lin/...jpg",
      "metadataUrl": "https://<public-domain>/generated/lin/...json",
      "xiaohongshuTitle": "..."
    }
  ],
  "errors": []
}
```

## Project Structure

```
web-ui/
├── app/
│   ├── api/
│   │   ├── upload/           # Upload endpoints (Cloudflare R2)
│   │   ├── generate/         # Generation pipeline trigger
│   │   └── results/          # Generated asset listing
│   ├── page.tsx              # Main UI page
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── lib/
│   ├── ai-service.ts         # OpenRouter (GPT) integration
│   ├── image-generator.ts    # Gemini image generation helper
│   ├── pipeline.ts           # End-to-end generation workflow
│   ├── r2.ts                 # Cloudflare R2 helpers
│   ├── prompts.ts            # Prompt templates
│   └── types.ts              # Shared TypeScript types
├── public/                   # Static assets
├── package.json
└── README.md
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Runtime**: Node.js with Turbopack

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

## Troubleshooting

### Upload fails

- Verify Cloudflare R2 credentials (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) are configured in your environment
- Confirm the bucket allows the authenticated user to put objects

### Generation fails

- Ensure OpenRouter/OpenAI credentials are configured in the parent project
- Confirm `R2_PUBLIC_BASE_URL` and (optionally) `R2_MODEL_BASE_URL` point to publicly accessible assets
- Check the server logs for detailed API error messages or rate-limit notices

## License

MIT
