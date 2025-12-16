import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/enhance-local
 *
 * Proxy endpoint for the local Python image enhancement service.
 * Forwards image enhancement requests to http://localhost:8000/api/enhance
 *
 * Request body (multipart/form-data):
 * - file: Image file to enhance
 * - skipEsrgan: Optional boolean to skip Real-ESRGAN step (face restoration only)
 *
 * Response:
 * - success: boolean
 * - message: string
 * - downloadUrl: string (URL to download enhanced image from Python service)
 * - filename: string (enhanced image filename)
 * - skipEsrgan: boolean
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Get parameters
    const file = formData.get('file') as File | null;
    const skipEsrgan = formData.get('skipEsrgan') === 'true';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Create FormData for Python API
    const pythonFormData = new FormData();
    pythonFormData.append('file', file);
    if (skipEsrgan) {
      pythonFormData.append('skipEsrgan', 'true');
    }

    // Forward to Python API
    const pythonApiUrl = process.env.IMAGE_ENHANCE_API_URL || 'http://localhost:8000';
    const response = await fetch(`${pythonApiUrl}/api/enhance`, {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Enhancement service error' }));
      return NextResponse.json(
        { error: error.error || 'Enhancement failed', details: error.details },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Convert relative download URL to absolute URL pointing to Python service
    if (result.success && result.downloadUrl) {
      result.downloadUrl = `${pythonApiUrl}${result.downloadUrl}`;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in enhance-local API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/enhance-local/health
 *
 * Check if the Python enhancement service is available
 */
export async function GET() {
  try {
    const pythonApiUrl = process.env.IMAGE_ENHANCE_API_URL || 'http://localhost:8000';
    const response = await fetch(`${pythonApiUrl}/health`, {
      method: 'GET',
    });

    if (!response.ok) {
      return NextResponse.json(
        { status: 'error', message: 'Enhancement service unavailable' },
        { status: 503 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Cannot connect to enhancement service',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 503 }
    );
  }
}
