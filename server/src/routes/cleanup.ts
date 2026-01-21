import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { imageDb } from '../database.js';
import { analyzeSimilarMetadata } from '../services/gemini.js';

const router = express.Router();

// Base directory for file access
const BASE_DIR = process.env.BASE_DIR || process.cwd();
const uploadsDir = path.join(BASE_DIR, 'uploads');

// Get AI-powered cleanup suggestions
router.post('/analyze', async (req, res) => {
  try {
    const tags = imageDb.getTagsWithCounts();
    const moods = imageDb.getMoodsWithCounts();

    console.log(`[Cleanup] Analyzing ALL ${tags.length} tags and ${moods.length} moods`);

    const suggestions = await analyzeSimilarMetadata(tags, moods);

    res.json({
      suggestions,
      stats: {
        totalTags: tags.length,
        totalMoods: moods.length,
        suggestedTagMerges: suggestions.tags.length,
        suggestedMoodMerges: suggestions.moods.length
      }
    });
  } catch (error) {
    console.error('Cleanup analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze metadata' });
  }
});

// Apply tag merge
router.post('/merge-tag', async (req, res) => {
  try {
    const { oldTag, newTag } = req.body;

    if (!oldTag || !newTag) {
      return res.status(400).json({ error: 'oldTag and newTag are required' });
    }

    const updatedCount = imageDb.replaceTag(oldTag, newTag);

    res.json({
      success: true,
      updatedImages: updatedCount,
      message: `Merged "${oldTag}" into "${newTag}" in ${updatedCount} images`
    });
  } catch (error) {
    console.error('Tag merge error:', error);
    res.status(500).json({ error: 'Failed to merge tag' });
  }
});

// Apply mood merge
router.post('/merge-mood', async (req, res) => {
  try {
    const { oldMood, newMood } = req.body;

    if (!oldMood || !newMood) {
      return res.status(400).json({ error: 'oldMood and newMood are required' });
    }

    const updatedCount = imageDb.replaceMood(oldMood, newMood);

    res.json({
      success: true,
      updatedImages: updatedCount,
      message: `Merged "${oldMood}" into "${newMood}" in ${updatedCount} images`
    });
  } catch (error) {
    console.error('Mood merge error:', error);
    res.status(500).json({ error: 'Failed to merge mood' });
  }
});

// Delete tag
router.delete('/tag/:tag', async (req, res) => {
  try {
    const tag = decodeURIComponent(req.params.tag);
    const updatedCount = imageDb.deleteTag(tag);

    res.json({
      success: true,
      updatedImages: updatedCount,
      message: `Deleted tag "${tag}" from ${updatedCount} images`
    });
  } catch (error) {
    console.error('Tag delete error:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// Delete mood
router.delete('/mood/:mood', async (req, res) => {
  try {
    const mood = decodeURIComponent(req.params.mood);
    const updatedCount = imageDb.deleteMood(mood);

    res.json({
      success: true,
      updatedImages: updatedCount,
      message: `Deleted mood "${mood}" from ${updatedCount} images`
    });
  } catch (error) {
    console.error('Mood delete error:', error);
    res.status(500).json({ error: 'Failed to delete mood' });
  }
});

// Batch apply suggested merges
router.post('/apply-suggestions', async (req, res) => {
  try {
    const { tagMerges, moodMerges } = req.body;

    const results = {
      tags: [] as any[],
      moods: [] as any[]
    };

    // Apply tag merges
    if (Array.isArray(tagMerges)) {
      for (const merge of tagMerges) {
        const { canonical, similar } = merge;
        for (const oldTag of similar) {
          const count = imageDb.replaceTag(oldTag, canonical);
          results.tags.push({ from: oldTag, to: canonical, count });
        }
      }
    }

    // Apply mood merges
    if (Array.isArray(moodMerges)) {
      for (const merge of moodMerges) {
        const { canonical, similar } = merge;
        for (const oldMood of similar) {
          const count = imageDb.replaceMood(oldMood, canonical);
          results.moods.push({ from: oldMood, to: canonical, count });
        }
      }
    }

    res.json({
      success: true,
      results,
      message: `Applied ${results.tags.length} tag merges and ${results.moods.length} mood merges`
    });
  } catch (error) {
    console.error('Apply suggestions error:', error);
    res.status(500).json({ error: 'Failed to apply suggestions' });
  }
});

// Fix duplicate tags in all images
router.post('/fix-duplicate-tags', async (req, res) => {
  try {
    console.log('[Cleanup] Starting duplicate tags fix...');

    const allImages = imageDb.getAll({ limit: 10000 }).images;
    let totalImages = 0;
    let imagesFixed = 0;
    let totalDuplicatesRemoved = 0;

    for (const img of allImages) {
      if (!img.tags) continue;

      try {
        const parsed = JSON.parse(img.tags);
        if (!Array.isArray(parsed)) continue;

        totalImages++;

        // Remove duplicates while preserving order
        const uniqueTags: string[] = [];
        const seen = new Set<string>();

        for (const tag of parsed) {
          if (tag && typeof tag === 'string') {
            const normalized = tag.trim();
            if (normalized && !seen.has(normalized)) {
              seen.add(normalized);
              uniqueTags.push(normalized);
            }
          }
        }

        // Check if we removed any duplicates
        if (uniqueTags.length < parsed.length) {
          const duplicatesRemoved = parsed.length - uniqueTags.length;
          totalDuplicatesRemoved += duplicatesRemoved;
          imagesFixed++;

          console.log(`[Cleanup] Fixed image ${img.id}: removed ${duplicatesRemoved} duplicates`);

          // Update the database
          imageDb.update(img.id, {
            tags: JSON.stringify(uniqueTags)
          });
        }
      } catch (e) {
        console.error(`[Cleanup] Error processing image ${img.id}:`, e);
      }
    }

    res.json({
      success: true,
      stats: {
        totalImagesWithTags: totalImages,
        imagesFixed,
        totalDuplicatesRemoved,
        cleanImages: totalImages - imagesFixed
      },
      message: `Fixed ${imagesFixed} images, removed ${totalDuplicatesRemoved} duplicate tags`
    });
  } catch (error) {
    console.error('Fix duplicates error:', error);
    res.status(500).json({ error: 'Failed to fix duplicate tags' });
  }
});

// Calculate file hash for duplicate detection
function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

// Analyze duplicate images by file hash
router.get('/duplicates/analyze', async (req, res) => {
  try {
    console.log('[Duplicates] Starting duplicate image analysis...');

    const allImages = imageDb.getAll({ limit: 10000 }).images;
    const hashMap = new Map<string, any[]>();
    const errors: string[] = [];

    // Calculate hash for each image
    for (const image of allImages) {
      try {
        const filePath = path.join(uploadsDir, image.filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          errors.push(`File not found: ${image.filename}`);
          continue;
        }

        const hash = await calculateFileHash(filePath);

        // Group images by hash
        if (!hashMap.has(hash)) {
          hashMap.set(hash, []);
        }

        hashMap.get(hash)!.push({
          id: image.id,
          filename: image.filename,
          title: image.title,
          upload_date: image.created_at,
          theme_id: image.theme_id,
          tags: image.tags ? JSON.parse(image.tags) : [],
          mood: image.mood,
          fileSize: fs.statSync(filePath).size
        });

      } catch (error) {
        console.error(`Error processing image ${image.id}:`, error);
        errors.push(`Error with ${image.filename}: ${error}`);
      }
    }

    // Filter to only groups with duplicates (more than 1 image)
    const duplicateGroups = Array.from(hashMap.entries())
      .filter(([hash, images]) => images.length > 1)
      .map(([hash, images]) => ({
        hash,
        count: images.length,
        images: images.sort((a, b) =>
          new Date(a.upload_date).getTime() - new Date(b.upload_date).getTime()
        ),
        totalSize: images.reduce((sum, img) => sum + img.fileSize, 0)
      }))
      .sort((a, b) => b.count - a.count); // Sort by number of duplicates

    const stats = {
      totalImages: allImages.length,
      duplicateGroups: duplicateGroups.length,
      totalDuplicates: duplicateGroups.reduce((sum, group) => sum + (group.count - 1), 0),
      potentialSpaceSaved: duplicateGroups.reduce(
        (sum, group) => sum + (group.totalSize - (group.totalSize / group.count)),
        0
      ),
      errors: errors.length
    };

    console.log('[Duplicates] Analysis complete:', stats);

    res.json({
      duplicateGroups,
      stats,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Duplicate analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze duplicates' });
  }
});

// Delete specific image (for duplicate cleanup)
router.delete('/duplicates/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = imageDb.getById(imageId);
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from database
    imageDb.delete(imageId);

    // Delete files
    const filePath = path.join(uploadsDir, image.filename);
    const thumbnailPath = path.join(uploadsDir, 'thumbnails', `thumb_${image.filename}`);
    const mediumPath = path.join(uploadsDir, 'medium', `medium_${image.filename}`);
    const optimizedPath = path.join(uploadsDir, 'optimized', `opt_${image.filename}`);

    [filePath, thumbnailPath, mediumPath, optimizedPath].forEach(p => {
      if (fs.existsSync(p)) {
        fs.unlinkSync(p);
      }
    });

    res.json({
      success: true,
      message: `Image ${imageId} deleted successfully`
    });

  } catch (error) {
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Find orphaned images (DB entries without physical files)
router.get('/orphans/analyze', async (req, res) => {
  try {
    console.log('[Orphans] Starting orphaned images analysis...');

    const allImages = imageDb.getAll({ limit: 10000 }).images;
    const orphans: any[] = [];

    for (const image of allImages) {
      const filePath = path.join(uploadsDir, image.filename);

      // Check if primary file exists
      if (!fs.existsSync(filePath)) {
        orphans.push({
          id: image.id,
          filename: image.filename,
          title: image.title,
          created_at: image.created_at,
          theme_id: image.theme_id,
          tags: image.tags ? JSON.parse(image.tags) : [],
          mood: image.mood
        });
      }
    }

    const stats = {
      totalImages: allImages.length,
      orphanedImages: orphans.length,
      percentageOrphaned: ((orphans.length / allImages.length) * 100).toFixed(2)
    };

    console.log('[Orphans] Analysis complete:', stats);

    res.json({
      orphans,
      stats
    });

  } catch (error) {
    console.error('Orphan analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze orphaned images' });
  }
});

// Delete orphaned images from database
router.post('/orphans/cleanup', async (req, res) => {
  try {
    console.log('[Orphans] Starting orphaned images cleanup...');

    const allImages = imageDb.getAll({ limit: 10000 }).images;
    const deletedIds: string[] = [];
    const deletedDetails: any[] = [];

    for (const image of allImages) {
      const filePath = path.join(uploadsDir, image.filename);

      // Check if primary file exists
      if (!fs.existsSync(filePath)) {
        // Delete from database
        imageDb.delete(image.id);
        deletedIds.push(image.id);
        deletedDetails.push({
          id: image.id,
          filename: image.filename,
          title: image.title
        });

        console.log(`[Orphans] Deleted orphaned image: ${image.filename}`);
      }
    }

    const stats = {
      totalImagesChecked: allImages.length,
      orphansDeleted: deletedIds.length
    };

    console.log('[Orphans] Cleanup complete:', stats);

    res.json({
      success: true,
      stats,
      deletedImages: deletedDetails,
      message: `Supprimé ${deletedIds.length} image(s) orpheline(s) de la base de données`
    });

  } catch (error) {
    console.error('Orphan cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup orphaned images' });
  }
});

export default router;
