import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { imageDb } from '../database.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Get existing popular tags to encourage reuse
 */
function getPopularTags(limit: number = 50): string[] {
  try {
    const tagsWithCounts = imageDb.getTagsWithCounts();
    return tagsWithCounts
      .sort((a, b) => b.count - a.count) // Sort by count descending
      .slice(0, limit)
      .map(t => t.tag);
  } catch (error) {
    console.error('Failed to get popular tags:', error);
    return [];
  }
}

/**
 * Get existing popular moods to encourage reuse
 */
function getPopularMoods(limit: number = 20): string[] {
  try {
    const moodsWithCounts = imageDb.getMoodsWithCounts();
    return moodsWithCounts
      .sort((a, b) => b.count - a.count) // Sort by count descending
      .slice(0, limit)
      .map(m => m.mood);
  } catch (error) {
    console.error('Failed to get popular moods:', error);
    return [];
  }
}

/**
 * Normalize a tag by matching it to existing popular tags
 * Rules:
 * - Case-insensitive matching
 * - Remove accents for comparison
 * - Prefer existing tag if very similar
 */
function normalizeTag(tag: string, popularTags: string[]): string {
  if (!tag || typeof tag !== 'string') return tag;

  const normalized = tag.trim();
  const normalizedLower = normalized.toLowerCase();
  const removeAccents = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const normalizedNoAccent = removeAccents(normalizedLower);

  // Exact match (case-insensitive)
  const exactMatch = popularTags.find(t => t.toLowerCase() === normalizedLower);
  if (exactMatch) return exactMatch;

  // Match without accents
  const accentMatch = popularTags.find(t =>
    removeAccents(t.toLowerCase()) === normalizedNoAccent
  );
  if (accentMatch) return accentMatch;

  // No match found - return original (preserving original casing)
  return normalized;
}

/**
 * Normalize mood by matching to existing popular moods
 */
function normalizeMood(mood: string, popularMoods: string[]): string {
  if (!mood || typeof mood !== 'string') return mood;

  const normalized = mood.trim();
  const normalizedLower = normalized.toLowerCase();

  // Exact match (case-insensitive)
  const exactMatch = popularMoods.find(m => m.toLowerCase() === normalizedLower);
  if (exactMatch) return exactMatch;

  return normalized;
}

/**
 * Sanitize tag/mood by removing embedded count numbers
 * Examples: "musique85" -> "musique", "danse42" -> "danse"
 */
function sanitizeMetadataItem(item: string): string {
  if (!item || typeof item !== 'string') return item;

  // Remove trailing numbers and whitespace
  // Matches patterns like: "musique85", "musique 85", "musique (85)", etc.
  return item
    .replace(/\s*\d+\s*$/, '')           // Remove trailing numbers
    .replace(/\s*\(\s*\d+\s*\)\s*$/, '') // Remove trailing (85)
    .replace(/\s*\(\s*\d+\s+images?\s*\)\s*$/i, '') // Remove trailing (85 images)
    .trim();
}

/**
 * Normalize tags array by mapping to existing popular tags
 */
function normalizeTags(tags: string[], popularTags: string[]): string[] {
  if (!Array.isArray(tags)) return tags;

  // Normalize each tag
  const normalized = tags.map(tag => normalizeTag(tag, popularTags));

  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  return normalized.filter(tag => {
    const lower = tag.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}

export interface ImageAnalysis {
  title: string;
  description: string;
  tags: string[];
  mood: string;
}

export interface ImageAnalysisBatchResult {
  analyses: ImageAnalysis[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export async function analyzeImage(imagePath: string): Promise<ImageAnalysis> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);

    // Get existing popular tags and moods to encourage reuse
    const popularTags = getPopularTags(50);
    const popularMoods = getPopularMoods(20);

    // Build tag suggestions for prompt
    const tagSuggestions = popularTags.length > 0
      ? `\n\nTAGS EXISTANTS POPULAIRES (à réutiliser en priorité si pertinent) :\n${popularTags.join(', ')}`
      : '';

    const moodSuggestions = popularMoods.length > 0
      ? `\n\nMOODS EXISTANTS (à réutiliser en priorité si pertinent) :\n${popularMoods.join(', ')}`
      : '';

    const prompt = `Analysez cette image artistique/photographie et fournissez :
1. Un titre créatif et évocateur (max 10 mots)
2. Une description artistique qui capture l'ambiance, la composition et les éléments artistiques (2 à 3 phrases)
3. Des mots-clés pertinents pour la catégorisation (5 à 10 tags)
4. L'ambiance/atmosphère générale (un ou deux mots comme « serein », « dramatique », « mélancolique », etc.)${tagSuggestions}${moodSuggestions}

IMPORTANT :
- Pour les tags ET moods : RÉUTILISEZ en priorité les termes de la liste ci-dessus s'ils sont pertinents
- Cela permet de mieux organiser et regrouper les images similaires
- Ne créez un nouveau tag/mood que si aucun terme existant ne convient
- Utilisez exactement la même casse que dans la liste (ex: "architecture" pas "Architecture")

Respond in JSON format exactly like this:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ...],
  "mood": "..."
}`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType,
          data: base64Image
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Normalize tags and mood against existing popular ones
    const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const normalizedTagsArray = normalizeTags(rawTags, popularTags);
    const normalizedMood = normalizeMood(parsed.mood || 'undefined', popularMoods);

    return {
      title: parsed.title || 'Untitled',
      description: parsed.description || '',
      tags: normalizedTagsArray,
      mood: normalizedMood
    };
  } catch (error) {
    console.error('Gemini analysis error:', error);
    throw error;
  }
}

/**
 * Analyze multiple images in a single Gemini API call (up to 75 images)
 * Much more efficient than calling analyzeImage() multiple times
 * Returns analyses AND usage metadata for API call tracking
 */
export async function analyzeImagesBatch(imagePaths: string[]): Promise<ImageAnalysisBatchResult> {
  try {
    if (imagePaths.length === 0) {
      return { analyses: [] };
    }

    // Gemini 3 Flash has 1M token context - 75 images uses ~150-300k tokens (safe margin)
    if (imagePaths.length > 75) {
      throw new Error('Cannot analyze more than 75 images in a single batch');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // Get existing popular tags and moods to encourage reuse across all images
    const popularTags = getPopularTags(50);
    const popularMoods = getPopularMoods(20);

    // Build tag/mood suggestions for prompt
    const tagSuggestions = popularTags.length > 0
      ? `\n\nTAGS EXISTANTS POPULAIRES (à réutiliser en priorité si pertinent pour chaque image) :\n${popularTags.join(', ')}`
      : '';

    const moodSuggestions = popularMoods.length > 0
      ? `\n\nMOODS EXISTANTS (à réutiliser en priorité si pertinent) :\n${popularMoods.join(', ')}`
      : '';

    // Prepare all images
    const imageData = imagePaths.map(imagePath => {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = getMimeType(imagePath);
      return { mimeType, data: base64Image };
    });

    const prompt = `Analysez chacune des ${imagePaths.length} images artistiques/photographies fournies et pour CHAQUE image, fournissez :
1. Un titre créatif et évocateur (max 10 mots)
2. Une description artistique qui capture l'ambiance, la composition et les éléments artistiques (2 à 3 phrases)
3. Des mots-clés pertinents pour la catégorisation (5 à 10 tags)
4. L'ambiance/atmosphère générale (un ou deux mots comme « serein », « dramatique », « mélancolique », etc.)${tagSuggestions}${moodSuggestions}

IMPORTANT :
- Pour CHAQUE image : RÉUTILISEZ en priorité les tags/moods de la liste ci-dessus s'ils sont pertinents
- Cela permet de mieux organiser et regrouper les images similaires
- Ne créez un nouveau tag/mood que si aucun terme existant ne convient
- Utilisez exactement la même casse que dans la liste (ex: "architecture" pas "Architecture")
- Retournez un tableau JSON avec exactement ${imagePaths.length} éléments, dans le MÊME ORDRE que les images fournies

Respond in JSON format exactly like this:
[
  {
    "title": "...",
    "description": "...",
    "tags": ["tag1", "tag2", ...],
    "mood": "..."
  },
  {
    "title": "...",
    "description": "...",
    "tags": ["tag1", "tag2", ...],
    "mood": "..."
  }
]`;

    // Build the content array: prompt first, then all images
    const contentParts = [
      { text: prompt },
      ...imageData.map(img => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data
        }
      }))
    ];

    const result = await model.generateContent(contentParts);
    const response = await result.response;
    const text = response.text();

    // Extract usage metadata for tracking
    const usageMetadata = response.usageMetadata ? {
      promptTokenCount: response.usageMetadata.promptTokenCount || 0,
      candidatesTokenCount: response.usageMetadata.candidatesTokenCount || 0,
      totalTokenCount: response.usageMetadata.totalTokenCount || 0
    } : undefined;

    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini batch response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed) || parsed.length !== imagePaths.length) {
      throw new Error(`Expected ${imagePaths.length} analyses, got ${Array.isArray(parsed) ? parsed.length : 'non-array'}`);
    }

    // Normalize tags and moods for each analysis
    const analyses = parsed.map(item => {
      const rawTags = Array.isArray(item.tags) ? item.tags : [];
      const normalizedTagsArray = normalizeTags(rawTags, popularTags);
      const normalizedMood = normalizeMood(item.mood || 'undefined', popularMoods);

      return {
        title: item.title || 'Untitled',
        description: item.description || '',
        tags: normalizedTagsArray,
        mood: normalizedMood
      };
    });

    return {
      analyses,
      usageMetadata
    };
  } catch (error) {
    console.error('Gemini batch analysis error:', error);
    throw error;
  }
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return mimeTypes[ext] || 'image/jpeg';
}

export interface SimilarityGroup {
  canonical: string;
  similar: string[];
  reason: string;
}

export interface CleanupSuggestions {
  tags: SimilarityGroup[];
  moods: SimilarityGroup[];
}

/**
 * Pre-process tags to detect obvious duplicates (case differences)
 * Returns groups of tags that differ only by case
 */
function detectCaseDuplicates(
  items: Array<{ tag?: string; mood?: string; count: number }>
): SimilarityGroup[] {
  const groups = new Map<string, Array<{ original: string; count: number }>>();

  // Group by lowercase version
  for (const item of items) {
    const original = item.tag || item.mood || '';
    const lowercase = original.toLowerCase();

    if (!groups.has(lowercase)) {
      groups.set(lowercase, []);
    }
    groups.get(lowercase)!.push({ original, count: item.count });
  }

  // Find groups with multiple case variations
  const suggestions: SimilarityGroup[] = [];
  for (const [lowercase, variants] of groups.entries()) {
    if (variants.length > 1) {
      // Sort by count (descending) to pick most used as canonical
      variants.sort((a, b) => b.count - a.count);

      const canonical = variants[0].original;
      const similar = variants.slice(1).map(v => v.original);

      suggestions.push({
        canonical,
        similar,
        reason: 'Différence de casse uniquement (détection automatique)'
      });
    }
  }

  return suggestions;
}

/**
 * Analyze tags and moods for similarities
 * Combines automatic detection (case differences) with Gemini AI analysis
 */
export async function analyzeSimilarMetadata(
  tags: Array<{ tag: string; count: number }>,
  moods: Array<{ mood: string; count: number }>
): Promise<CleanupSuggestions> {
  try {
    console.log(`[Gemini] Analyzing ALL ${tags.length} tags and ${moods.length} moods`);

    // Step 1: Automatic detection of case duplicates
    const autoCaseTags = detectCaseDuplicates(tags.map(t => ({ tag: t.tag, count: t.count })));
    const autoCaseMoods = detectCaseDuplicates(moods.map(m => ({ mood: m.mood, count: m.count })));
    console.log(`[Auto] Detected ${autoCaseTags.length} case duplicate groups in tags, ${autoCaseMoods.length} in moods`);

    // Step 2: Gemini analysis for semantic/linguistic similarities
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    const prompt = `Analysez ces tags et ambiances (moods) et identifiez TOUS les groupes qui ont le même sens ou sont des variantes.

TOUS LES TAGS (triés par popularité):
${tags.map(t => `- "${t.tag}" (${t.count} images)`).join('\n')}

MOODS:
${moods.map(m => `- "${m.mood}" (${m.count} images)`).join('\n')}

RÈGLES DE DÉTECTION - Fusionnez les termes dans ces cas :

1. **Différence de casse** : "Détente" → "détente", "Paris" → "paris"
2. **Pluriel/singulier** : "arbres" → "arbre", "enfants" → "enfant"
3. **Tags en anglais avec équivalent français** :
   - "contemplative" → "contemplation"
   - "evening" → "soirée"
   - "stillness" → "calme"
   - "harmony" → "harmonie"
   - "leader" → "chef" ou "meneur"
   - "drinks" → "boisson"
4. **Variantes nominales** : "vertical" → "verticalité", "introspection" → "introspectif"
5. **Tags spécifiques vers généraux** : "banc public" → "banc", "architecture gothique" → "architecture"
6. **Synonymes évidents** : "océan" ↔ "mer", "joie" ↔ "bonheur"
7. **Accents/orthographe** : "mélancolie" ↔ "melancolie"

EXEMPLES DE FUSIONS ATTENDUES :
{
  "canonical": "détente",
  "similar": ["Détente"],
  "reason": "Différence de casse uniquement"
}
{
  "canonical": "contemplation",
  "similar": ["contemplative"],
  "reason": "Variante anglaise/adjectivale du même concept"
}
{
  "canonical": "verticalité",
  "similar": ["vertical"],
  "reason": "Forme nominale et adjectivale du même concept"
}

Répondez UNIQUEMENT en JSON, sans texte avant ou après :
{
  "tags": [
    {
      "canonical": "terme principal",
      "similar": ["variante1", "variante2"],
      "reason": "raison de la similarité"
    }
  ],
  "moods": [
    {
      "canonical": "ambiance principale",
      "similar": ["variante1", "variante2"],
      "reason": "raison de la similarité"
    }
  ]
}

IMPORTANT :
- Soyez EXHAUSTIF : cherchez toutes les variantes possibles
- Préférez TOUJOURS le terme français au terme anglais
- Préférez le terme le PLUS UTILISÉ comme canonical (sauf si anglais)
- Fusionnez les tags à 1-2 usages vers les tags plus populaires quand c'est pertinent
- Si un terme est unique ET sans équivalent, ne le retournez pas
- CRITIQUE : Dans vos réponses JSON, retournez SEULEMENT les noms des tags/moods, SANS les comptes d'images
  Exemple : "musique" et NON "musique85" ou "musique (85 images)"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Sanitize tags to remove any embedded counts
    const geminiTags = Array.isArray(parsed.tags)
      ? parsed.tags.map((group: any) => ({
          canonical: sanitizeMetadataItem(group.canonical),
          similar: Array.isArray(group.similar)
            ? group.similar.map((s: string) => sanitizeMetadataItem(s))
            : group.similar,
          reason: group.reason
        }))
      : [];

    // Sanitize moods to remove any embedded counts
    const geminiMoods = Array.isArray(parsed.moods)
      ? parsed.moods.map((group: any) => ({
          canonical: sanitizeMetadataItem(group.canonical),
          similar: Array.isArray(group.similar)
            ? group.similar.map((s: string) => sanitizeMetadataItem(s))
            : group.similar,
          reason: group.reason
        }))
      : [];

    console.log(`[Gemini] AI detected ${geminiTags.length} tag groups, ${geminiMoods.length} mood groups`);

    // Step 3: Combine automatic + AI results (auto results first for visibility)
    const combinedTags = [...autoCaseTags, ...geminiTags];
    const combinedMoods = [...autoCaseMoods, ...geminiMoods];

    console.log(`[Combined] Total suggestions: ${combinedTags.length} tag groups, ${combinedMoods.length} mood groups`);

    return {
      tags: combinedTags,
      moods: combinedMoods
    };
  } catch (error) {
    console.error('Gemini similarity analysis error:', error);
    throw error;
  }
}
