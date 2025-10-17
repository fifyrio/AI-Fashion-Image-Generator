# AI Fashion Image Generator

AI-powered fashion image generator using OpenRouter and Cloudflare R2 storage. Built with Next.js 15.

## Features

- 📸 Upload reference fashion images
- 🎨 AI-powered outfit analysis and generation
- 👤 Multiple character models (Lin, Qiao, Ayi, etc.)
- ☁️ Cloudflare R2 cloud storage
- 📝 Automatic Xiaohongshu (小红书) title generation
- 🚀 Optimized for Vercel deployment

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **AI**: OpenRouter (GPT-4 for analysis, Gemini for image generation)
- **Storage**: Cloudflare R2
- **Styling**: Tailwind CSS 4
- **Language**: TypeScript

## Deployment on Vercel

### Quick Start

1. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect Next.js

2. **Configure Environment Variables**

   In Vercel project settings, add these environment variables:

   | Variable | Description |
   |----------|-------------|
   | `OPENROUTER_API_KEY` | OpenRouter API key |
   | `SITE_URL` | Your deployed site URL |
   | `SITE_NAME` | Site name for OpenRouter |
   | `R2_ACCOUNT_ID` | Cloudflare R2 account ID |
   | `R2_ACCESS_KEY_ID` | R2 access key |
   | `R2_SECRET_ACCESS_KEY` | R2 secret key |
   | `R2_BUCKET_NAME` | R2 bucket name |
   | `R2_PUBLIC_BASE_URL` | Public R2 URL |
   | `R2_MODEL_BASE_URL` | Model images base URL (optional) |

3. **Deploy**
   - Click "Deploy"
   - Done! 🚀

## Local Development

1. **Clone and install**
   ```bash
   git clone https://github.com/fifyrio/AI-Fashion-Image-Generator.git
   cd AI-Fashion-Image-Generator
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

## Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint
```

## License

MIT
