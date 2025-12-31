import express from 'express';
import { imageDb } from '../database.js';
import { analyzeSimilarMetadata } from '../services/gemini.js';

const router = express.Router();

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

// Fix tags with embedded count numbers
router.post('/fix-embedded-counts', async (req, res) => {
  try {
    console.log('[Cleanup] Starting embedded count removal...');

    const allImages = imageDb.getAll({ limit: 10000 }).images;
    let totalImages = 0;
    let imagesFixed = 0;
    let totalTagsFixed = 0;
    let totalMoodsFixed = 0;

    /**
     * Remove embedded count numbers from tag/mood
     */
    const sanitizeMetadataItem = (item: string): string => {
      if (!item || typeof item !== 'string') return item;
      return item
        .replace(/\s*\d+\s*$/, '')           // Remove trailing numbers
        .replace(/\s*\(\s*\d+\s*\)\s*$/, '') // Remove trailing (85)
        .replace(/\s*\(\s*\d+\s+images?\s*\)\s*$/i, '') // Remove trailing (85 images)
        .trim();
    };

    for (const img of allImages) {
      let imageModified = false;
      totalImages++;
      const updates: any = {};

      // Fix tags
      if (img.tags) {
        try {
          const parsed = JSON.parse(img.tags);
          if (Array.isArray(parsed)) {
            let tagsModified = false;
            const sanitized = parsed.map(tag => {
              if (typeof tag === 'string') {
                const cleaned = sanitizeMetadataItem(tag);
                if (cleaned !== tag) {
                  totalTagsFixed++;
                  tagsModified = true;
                  console.log(`[Cleanup] Tag: "${tag}" -> "${cleaned}"`);
                }
                return cleaned;
              }
              return tag;
            });

            if (tagsModified) {
              updates.tags = JSON.stringify(sanitized);
              imageModified = true;
            }
          }
        } catch (e) {
          console.error(`[Cleanup] Error processing tags for image ${img.id}:`, e);
        }
      }

      // Fix moods
      if (img.moods) {
        try {
          const parsed = JSON.parse(img.moods);
          if (Array.isArray(parsed)) {
            let moodsModified = false;
            const sanitized = parsed.map(mood => {
              if (typeof mood === 'string') {
                const cleaned = sanitizeMetadataItem(mood);
                if (cleaned !== mood) {
                  totalMoodsFixed++;
                  moodsModified = true;
                  console.log(`[Cleanup] Mood: "${mood}" -> "${cleaned}"`);
                }
                return cleaned;
              }
              return mood;
            });

            if (moodsModified) {
              updates.moods = JSON.stringify(sanitized);
              imageModified = true;
            }
          }
        } catch (e) {
          console.error(`[Cleanup] Error processing moods for image ${img.id}:`, e);
        }
      }

      // Apply all updates at once
      if (imageModified) {
        imageDb.update(img.id, updates);
        imagesFixed++;
      }
    }

    res.json({
      success: true,
      stats: {
        totalImages,
        imagesFixed,
        totalTagsFixed,
        totalMoodsFixed,
        cleanImages: totalImages - imagesFixed
      },
      message: `Fixed ${imagesFixed} images, cleaned ${totalTagsFixed} tags and ${totalMoodsFixed} moods`
    });
  } catch (error) {
    console.error('Fix embedded counts error:', error);
    res.status(500).json({ error: 'Failed to fix embedded counts' });
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

export default router;
