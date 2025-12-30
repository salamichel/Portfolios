import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { imageDb } from '../database.js';
import { analyzeImage, analyzeImagesBatch } from '../services/gemini.js';

const router = Router();

// Base directory (works in both dev and Docker)
const BASE_DIR = process.env.BASE_DIR || process.cwd();
const uploadsDir = path.join(BASE_DIR, 'uploads');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
const mediumDir = path.join(uploadsDir, 'medium');
const optimizedDir = path.join(uploadsDir, 'optimized');

// Ensure directories exist
[uploadsDir, thumbnailsDir, mediumDir, optimizedDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// Heavy formats that will be deleted after WebP conversion
const HEAVY_FORMATS = ['image/tiff'];

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit (for large TIFF files)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and TIFF are allowed.'));
    }
  }
});

// Get all images with pagination
router.get('/', (req, res) => {
  try {
    const { theme_id, limit, offset, search, tag, mood } = req.query;
    const result = imageDb.getAll({
      theme_id: theme_id as string,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
      search: search as string,
      tag: tag as string,
      mood: mood as string
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Get all tags with photo counts
router.get('/metadata/tags', (req, res) => {
  try {
    console.log('[API] GET /metadata/tags called');
    const tags = imageDb.getTagsWithCounts();
    console.log('[API] Returning tags:', tags.length, 'tags');
    res.json(tags);
  } catch (error) {
    console.error('[API] Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Get all moods with photo counts
router.get('/metadata/moods', (req, res) => {
  try {
    console.log('[API] GET /metadata/moods called');
    const moods = imageDb.getMoodsWithCounts();
    console.log('[API] Returning moods:', moods.length, 'moods');
    res.json(moods);
  } catch (error) {
    console.error('[API] Error fetching moods:', error);
    res.status(500).json({ error: 'Failed to fetch moods' });
  }
});

// Get unenriched images (images without AI enrichment)
router.get('/unenriched', (req, res) => {
  try {
    const images = imageDb.getUnenriched();
    const count = imageDb.countUnenriched();
    res.json({ images, count });
  } catch (error) {
    console.error('[API] Error fetching unenriched images:', error);
    res.status(500).json({ error: 'Failed to fetch unenriched images' });
  }
});

// Get all unique tags
router.get('/meta/tags', (req, res) => {
  try {
    const tags = imageDb.getAllTags();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Get all unique moods
router.get('/meta/moods', (req, res) => {
  try {
    const moods = imageDb.getAllMoods();
    res.json(moods);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch moods' });
  }
});

// Get single image
router.get('/:id', (req, res) => {
  try {
    const image = imageDb.getById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }
    res.json(image);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Upload images (supports multiple)
router.post('/upload', upload.array('images', 50), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    const { theme_id, auto_enrich } = req.body;
    const shouldEnrich = auto_enrich === 'true';

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadedImages = [];

    for (const file of files) {
      const id = path.basename(file.filename, path.extname(file.filename));
      const imagePath = path.join(uploadsDir, file.filename);

      // Get image dimensions
      const metadata = await sharp(imagePath).metadata();

      // Generate WebP thumbnail for gallery (400px)
      const baseName = path.basename(file.filename, path.extname(file.filename));
      const thumbnailFilename = `thumb_${baseName}.webp`;
      await sharp(imagePath)
        .resize(400, 400, { fit: 'cover' })
        .webp({ quality: 80 })
        .toFile(path.join(thumbnailsDir, thumbnailFilename));

      // Generate medium WebP for detail view (1600px)
      const mediumFilename = `medium_${baseName}.webp`;
      await sharp(imagePath)
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(path.join(mediumDir, mediumFilename));

      // Generate optimized WebP version of the full image
      const optimizedFilename = `${baseName}.webp`;
      await sharp(imagePath)
        .webp({ quality: 85 })
        .toFile(path.join(optimizedDir, optimizedFilename));

      let enrichment = {
        title: null as string | null,
        description: null as string | null,
        tags: null as string | null,
        mood: null as string | null,
        ai_enriched: false
      };

      // Optionally analyze with Gemini (use WebP version since Gemini doesn't support TIFF)
      if (shouldEnrich && process.env.GEMINI_API_KEY) {
        try {
          const webpPath = path.join(optimizedDir, optimizedFilename);
          const analysis = await analyzeImage(webpPath);
          enrichment = {
            title: analysis.title,
            description: analysis.description,
            tags: JSON.stringify(analysis.tags),
            mood: analysis.mood,
            ai_enriched: true
          };
        } catch (err) {
          console.error('Failed to enrich image with Gemini:', err);
        }
      }

      // Delete heavy format files (like TIFF) after conversion to save space
      const isHeavyFormat = HEAVY_FORMATS.includes(file.mimetype);
      if (isHeavyFormat && fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`Deleted heavy format file: ${file.filename}`);
      }

      const image = imageDb.create({
        id,
        filename: file.filename,
        original_name: file.originalname,
        theme_id: theme_id || null,
        title: enrichment.title,
        description: enrichment.description,
        tags: enrichment.tags,
        mood: enrichment.mood,
        ai_enriched: enrichment.ai_enriched,
        width: metadata.width || null,
        height: metadata.height || null,
        size: file.size,
        mime_type: file.mimetype
      });

      uploadedImages.push(image);
    }

    res.status(201).json(uploadedImages);
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Enrich image with Gemini
router.post('/:id/enrich', async (req, res) => {
  try {
    const image = imageDb.getById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Gemini API key not configured' });
    }

    // Use WebP version for Gemini (TIFF not supported, and original may be deleted)
    const baseName = path.basename(image.filename, path.extname(image.filename));
    const webpPath = path.join(optimizedDir, `${baseName}.webp`);
    const analysis = await analyzeImage(webpPath);

    const updatedImage = imageDb.update(req.params.id, {
      title: analysis.title,
      description: analysis.description,
      tags: JSON.stringify(analysis.tags),
      mood: analysis.mood,
      ai_enriched: true
    });

    res.json(updatedImage);
  } catch (error) {
    console.error('Enrich error:', error);
    res.status(500).json({ error: 'Failed to enrich image' });
  }
});

// Batch enrich multiple images with Gemini (TRUE batch: 1 API call for up to 10 images)
router.post('/batch-enrich', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Gemini API key not configured' });
    }

    const { image_ids } = req.body;

    if (!image_ids || !Array.isArray(image_ids) || image_ids.length === 0) {
      return res.status(400).json({ error: 'image_ids array is required' });
    }

    const BATCH_SIZE = 10; // Gemini supports up to 10 images per request
    const results = {
      total: image_ids.length,
      successful: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>
    };

    // Process images in batches of 10
    for (let i = 0; i < image_ids.length; i += BATCH_SIZE) {
      const batchIds = image_ids.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(image_ids.length / BATCH_SIZE)} (${batchIds.length} images) - TRUE BATCH MODE`);

      try {
        // Prepare batch data
        const batchData: Array<{ id: string; image: any; webpPath: string }> = [];

        for (const imageId of batchIds) {
          const image = imageDb.getById(imageId);
          if (!image) {
            results.failed++;
            results.errors.push({ id: imageId, error: 'Image not found' });
            continue;
          }

          const baseName = path.basename(image.filename, path.extname(image.filename));
          const webpPath = path.join(optimizedDir, `${baseName}.webp`);

          if (!fs.existsSync(webpPath)) {
            results.failed++;
            results.errors.push({ id: imageId, error: 'WebP file not found' });
            continue;
          }

          batchData.push({ id: imageId, image, webpPath });
        }

        if (batchData.length === 0) {
          continue; // Skip if no valid images in this batch
        }

        // Call Gemini ONCE with all images in the batch
        const imagePaths = batchData.map(item => item.webpPath);
        const analyses = await analyzeImagesBatch(imagePaths);

        // Update database with results
        for (let j = 0; j < batchData.length; j++) {
          const { id } = batchData[j];
          const analysis = analyses[j];

          try {
            imageDb.update(id, {
              title: analysis.title,
              description: analysis.description,
              tags: JSON.stringify(analysis.tags),
              mood: analysis.mood,
              ai_enriched: true
            });
            results.successful++;
          } catch (updateError) {
            const errorMessage = updateError instanceof Error ? updateError.message : 'Database update failed';
            console.error(`Failed to update image ${id}:`, updateError);
            results.failed++;
            results.errors.push({ id, error: errorMessage });
          }
        }

      } catch (batchError) {
        // If batch fails, mark all images in batch as failed
        const errorMessage = batchError instanceof Error ? batchError.message : 'Batch processing failed';
        console.error(`Batch processing failed:`, batchError);

        for (const imageId of batchIds) {
          results.failed++;
          results.errors.push({ id: imageId, error: errorMessage });
        }
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Batch enrich error:', error);
    res.status(500).json({ error: 'Failed to batch enrich images' });
  }
});

// Update image
router.put('/:id', (req, res) => {
  try {
    const { theme_id, title, description, tags, mood } = req.body;
    const image = imageDb.update(req.params.id, {
      theme_id,
      title,
      description,
      tags: Array.isArray(tags) ? JSON.stringify(tags) : tags,
      mood
    });

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    res.json(image);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update image' });
  }
});

// Delete image
router.delete('/:id', (req, res) => {
  try {
    const image = imageDb.getById(req.params.id);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete files
    const baseName = path.basename(image.filename, path.extname(image.filename));
    const imagePath = path.join(uploadsDir, image.filename);
    const thumbnailPath = path.join(thumbnailsDir, `thumb_${baseName}.webp`);
    const mediumPath = path.join(mediumDir, `medium_${baseName}.webp`);
    const optimizedPath = path.join(optimizedDir, `${baseName}.webp`);

    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
    if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    if (fs.existsSync(mediumPath)) fs.unlinkSync(mediumPath);
    if (fs.existsSync(optimizedPath)) fs.unlinkSync(optimizedPath);

    imageDb.delete(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
