import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { imageDb } from '../src/database.js';

// Base directory (works in both dev and Docker)
const BASE_DIR = process.env.BASE_DIR || process.cwd();
const uploadsDir = path.join(BASE_DIR, 'uploads');
const mediumDir = path.join(uploadsDir, 'medium');
const optimizedDir = path.join(uploadsDir, 'optimized');

/**
 * Regenerate all medium thumbnails at 1600px
 */
async function regenerateMediumThumbnails() {
  console.log('Starting regeneration of medium thumbnails at 1600px...\n');

  // Get all images from database
  const result = imageDb.getAll({ limit: 100000, offset: 0 });
  const images = result.images;

  console.log(`Found ${images.length} images to process\n`);

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    const baseName = path.basename(image.filename, path.extname(image.filename));
    const mediumFilename = `medium_${baseName}.webp`;
    const mediumPath = path.join(mediumDir, mediumFilename);

    console.log(`[${i + 1}/${images.length}] Processing: ${image.original_name}`);

    try {
      // First, try to use the optimized WebP version (since original might be deleted for TIFF)
      let sourcePath = path.join(optimizedDir, `${baseName}.webp`);

      // If optimized doesn't exist, try the original
      if (!fs.existsSync(sourcePath)) {
        sourcePath = path.join(uploadsDir, image.filename);

        if (!fs.existsSync(sourcePath)) {
          console.log(`  ⚠️  Source file not found, skipping`);
          skipped++;
          continue;
        }
      }

      // Generate new medium thumbnail at 1600px
      await sharp(sourcePath)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(mediumPath);

      console.log(`  ✓ Regenerated successfully`);
      successful++;
    } catch (error) {
      console.error(`  ✗ Failed:`, error instanceof Error ? error.message : error);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Regeneration complete!');
  console.log(`  ✓ Successful: ${successful}`);
  console.log(`  ✗ Failed: ${failed}`);
  console.log(`  ⚠️  Skipped: ${skipped}`);
  console.log('='.repeat(50));
}

// Run the script
regenerateMediumThumbnails()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });
