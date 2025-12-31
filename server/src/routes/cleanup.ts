import express from 'express';
import { imageDb } from '../database.js';
import { analyzeSimilarMetadata } from '../services/gemini.js';

const router = express.Router();

// Get AI-powered cleanup suggestions
router.post('/analyze', async (req, res) => {
  try {
    const tags = imageDb.getTagsWithCounts();
    const moods = imageDb.getMoodsWithCounts();

    const MAX_TAGS = 300; // Must match gemini.ts
    const tagsAnalyzed = Math.min(tags.length, MAX_TAGS);
    const tagsSkipped = Math.max(0, tags.length - MAX_TAGS);

    console.log(`[Cleanup] Analyzing ${tagsAnalyzed}/${tags.length} tags (top 50 popular + ${Math.min(tags.length, 250)} least popular) and ${moods.length} moods`);

    const suggestions = await analyzeSimilarMetadata(tags, moods);

    res.json({
      suggestions,
      stats: {
        totalTags: tags.length,
        tagsAnalyzed,
        tagsSkipped,
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

export default router;
