import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { addIPhone13Metadata } from '../lib/metadata';

async function mainCorrected() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/add-metadata.ts <image-path>');
    process.exit(1);
  }

  const filePath = args[0];
  
  try {
    await fs.access(filePath);
  } catch {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const outputFilename = `IMG_7${randomSuffix}.jpg`;
  const outputPath = path.join(path.dirname(filePath), outputFilename);

  console.log(`Processing: ${filePath}`);

  try {
    const buffer = await fs.readFile(filePath);
    
    // Get image metadata (dimensions)
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;

    if (width === 0 || height === 0) {
        throw new Error('Could not determine image dimensions.');
    }

    console.log(`Image Dimensions: ${width}x${height}`);
    console.log('Converting to standard JPEG (keeping original dimensions)...');

    // Convert to JPEG without resizing
    const jpegBuffer = await sharp(buffer)
        .jpeg({ quality: 95 })
        .toBuffer();

    // Convert to Base64
    const base64 = jpegBuffer.toString('base64');
    
    // Add Metadata with ACTUAL dimensions
    console.log(`Injecting iPhone 13 metadata (with dimensions ${width}x${height})...`);
    const resultWithMetadata = await addIPhone13Metadata(base64, width, height);

    // Decode
    let finalBuffer: Buffer;
    if (resultWithMetadata.startsWith('data:image')) {
        const base64Data = resultWithMetadata.split(',')[1];
        finalBuffer = Buffer.from(base64Data, 'base64');
    } else {
        finalBuffer = Buffer.from(resultWithMetadata, 'base64');
    }

    await fs.writeFile(outputPath, finalBuffer);
    
    console.log(`✅ Success! Saved to: ${outputPath}`);
    console.log(`   Note: Image resolution is preserved at ${width}x${height}.`);
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error processing image:', errorMessage);
    process.exit(1);
  }
}

mainCorrected();