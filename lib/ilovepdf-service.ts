/**
 * ILoveIMG Service
 * Provides image upscaling functionality using iLoveIMG API
 * Using @rheyhannh/iloveimg-nodejs SDK
 */

import ILoveIMGApi from '@rheyhannh/iloveimg-nodejs';

interface ILoveIMGConfig {
  publicKey: string;
  secretKey: string;
}

interface UpscaleOptions {
  multiplier: 2 | 4;
}

interface UpscaleResult {
  success: boolean;
  enhancedBuffer?: Buffer;
  error?: string;
}

class ILoveIMGService {
  private api: ILoveIMGApi;

  constructor(config: ILoveIMGConfig) {
    this.api = new ILoveIMGApi(config.publicKey, config.secretKey);
  }

  /**
   * Main method to upscale an image from a public URL
   * @param imageUrl - Public URL of the image to upscale
   * @param filename - Filename for the image
   * @param options - Upscale options (multiplier: 2 or 4)
   */
  async upscaleImage(
    imageUrl: string,
    filename: string,
    options: UpscaleOptions
  ): Promise<UpscaleResult> {
    try {
      console.log(`[ILoveIMGService] Starting upscale task for ${filename} with ${options.multiplier}x multiplier`);

      // Create new upscale task
      const task = this.api.newTask('upscaleimage');

      // Start the task
      await task.start();
      console.log(`[ILoveIMGService] Task started. Task ID: ${task.getTaskId()}`);

      // Add file from public URL
      await task.addFile({
        cloud_file: imageUrl,
        filename: filename
      });
      console.log(`[ILoveIMGService] File added to task`);

      // Process with upscale options
      const processOptions = {};
      const upscaleOptions = {
        multiplier: options.multiplier
      };

      await task.process(processOptions, upscaleOptions);
      console.log(`[ILoveIMGService] Processing complete`);

      // Download result
      const response = await task.download();

      // Convert stream to Buffer
      // The SDK returns a stream (responseType: 'stream'), so we need to read it
      // Note: The SDK's TypeScript definition says Uint8Array, but it actually returns a stream
      const enhancedBuffer = await this.streamToBuffer(response.data as unknown as NodeJS.ReadableStream);

      console.log(`[ILoveIMGService] Download complete. Buffer size: ${enhancedBuffer.length} bytes`);

      return {
        success: true,
        enhancedBuffer
      };
    } catch (error) {
      console.error('[ILoveIMGService] Error upscaling image:', error);

      // Extract meaningful error message
      let errorMessage = '增强失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Handle axios errors or other structured errors
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.message) {
          errorMessage = err.message;
        }
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Convert a Node.js stream to Buffer
   * @param stream - Readable stream to convert
   */
  private async streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Upscale image from buffer (converts to process by uploading to temporary URL if needed)
   * Note: This requires the image to be available at a public URL
   * For buffer-based uploads, consider uploading to R2 first to get a public URL
   */
  async upscaleImageFromBuffer(
    _imageBuffer: Buffer,
    _filename: string,
    _options: UpscaleOptions
  ): Promise<UpscaleResult> {
    return {
      success: false,
      error: 'Direct buffer upload not supported by SDK. Please upload buffer to R2 first and use upscaleImage() with the public URL.'
    };
  }
}

/**
 * Factory function to create ILoveIMGService instance
 */
export function createILoveIMGService(): ILoveIMGService {
  const publicKey = process.env.ILOVE_PUBLIC_KEY;
  const secretKey = process.env.ILOVE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    throw new Error('缺少必需的环境变量：ILOVE_PUBLIC_KEY 或 ILOVE_SECRET_KEY');
  }

  return new ILoveIMGService({
    publicKey,
    secretKey
  });
}

export type { UpscaleOptions, UpscaleResult };
