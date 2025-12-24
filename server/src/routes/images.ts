import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { imageDb } from '../database.js';
import { analyzeImage } from '../services/gemini.js';

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
    fileSize: 200 * 1024 * 1024 // 200MB limit (for large TIFF files)
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

      // Generate medium WebP for detail view (1024px)
      const mediumFilename = `medium_${baseName}.webp`;
      await sharp(imagePath)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
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
