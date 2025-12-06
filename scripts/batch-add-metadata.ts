import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { addIPhone13Metadata } from '../lib/metadata';

async function processImage(filePath: string, outputDir: string): Promise<void> {
  const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const outputFilename = `IMG_7${randomSuffix}.jpg`;
  const outputPath = path.join(outputDir, outputFilename);

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

    console.log(`  Image Dimensions: ${width}x${height}`);

    // Convert to JPEG without resizing
    const jpegBuffer = await sharp(buffer)
      .jpeg({ quality: 95 })
      .toBuffer();

    // Convert to Base64
    const base64 = jpegBuffer.toString('base64');

    // Add Metadata with ACTUAL dimensions
    console.log(`  Injecting iPhone 13 metadata...`);
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

    console.log(`  ✅ Success! Saved to: ${outputFilename}`);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  ❌ Error processing ${filePath}:`, errorMessage);
    throw error;
  }
}

async function main() {
  const inputDir = path.join(process.cwd(), 'scripts', 'batch-resources');
  const outputDir = inputDir;

  try {
    // Check if input directory exists
    await fs.access(inputDir);
  } catch {
    console.error(`Error: Directory not found: ${inputDir}`);
    console.log('Creating batch-resources directory...');
    await fs.mkdir(inputDir, { recursive: true });
    console.log('✅ Directory created. Please add images to scripts/batch-resources/');
    process.exit(0);
  }

  // Read all files in the directory
  const files = await fs.readdir(inputDir);

  // Filter for image files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const imageFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return imageExtensions.includes(ext);
  });

  if (imageFiles.length === 0) {
    console.log('No image files found in scripts/batch-resources/');
    console.log('Supported formats: .jpg, .jpeg, .png, .webp');
    process.exit(0);
  }

  console.log(`Found ${imageFiles.length} image(s) to process\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of imageFiles) {
    const filePath = path.join(inputDir, file);
    try {
      await processImage(filePath, outputDir);
      successCount++;
    } catch {
      failCount++;
    }
    console.log(''); // Empty line between files
  }

  console.log('========================================');
  console.log(`Batch processing completed!`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`  📁 Output directory: ${outputDir}`);
  console.log('========================================');
}

main();
