import Replicate from 'replicate';

/**
 * Replicate service for background removal using Bria API
 */
export class ReplicateService {
    private client: Replicate;

    constructor() {
        const apiToken = process.env.REPLICATE_API_TOKEN;
        if (!apiToken) {
            throw new Error('REPLICATE_API_TOKEN not configured');
        }
        this.client = new Replicate({ auth: apiToken });
    }

    /**
     * Remove background from image using Bria Remove Background API
     * @param imageUrl URL of the image to process
     * @returns URL of the processed image without background
     */
    async removeBackground(imageUrl: string): Promise<string> {
        console.log('🎨 Removing background with Bria API...');
        console.log('🖼️ Input image:', imageUrl);

        try {
            const output = await this.client.run(
                "bria/remove-background",
                {
                    input: {
                        image: imageUrl,
                    }
                }
            );

            // Output is typically a URL or data URI
            const resultUrl = typeof output === 'string' ? output : (output as { output?: string }).output;

            if (!resultUrl) {
                throw new Error('No output URL returned from Bria API');
            }

            console.log('✅ Background removed successfully');
            return resultUrl;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ Background removal failed:', errorMessage);
            throw error;
        }
    }
}
