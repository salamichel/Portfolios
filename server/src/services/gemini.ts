import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { imageDb, enrichmentConfigDb, EnrichmentConfig, GeminiModel, familyMemberDb, trainingImageDb, FamilyMember, BoundingBox } from '../database.js';

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

export interface ImageAnalysisResult extends ImageAnalysis {
  configId: string;
}

export interface ImageAnalysisBatchResult {
  analyses: ImageAnalysis[];
  configId: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Build the complete prompt with tag/mood suggestions
 */
function buildPrompt(basePrompt: string, popularTags: string[], popularMoods: string[]): string {
  const tagSuggestions = popularTags.length > 0
    ? `\n\nTAGS EXISTANTS POPULAIRES (à réutiliser en priorité si pertinent) :\n${popularTags.join(', ')}`
    : '';

  const moodSuggestions = popularMoods.length > 0
    ? `\n\nMOODS EXISTANTS (à réutiliser en priorité si pertinent) :\n${popularMoods.join(', ')}`
    : '';

  return `${basePrompt}${tagSuggestions}${moodSuggestions}

Respond in JSON format exactly like this:
{
  "title": "...",
  "description": "...",
  "tags": ["tag1", "tag2", ...],
  "mood": "..."
}`;
}

export async function analyzeImage(imagePath: string, configId?: string): Promise<ImageAnalysisResult> {
  try {
    // Get the config (specified or default)
    const config = configId
      ? enrichmentConfigDb.getById(configId)
      : enrichmentConfigDb.getDefault();

    if (!config) {
      throw new Error('No enrichment config found');
    }

    const model = genAI.getGenerativeModel({ model: config.model });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);

    // Get existing popular tags and moods to encourage reuse
    const popularTags = getPopularTags(50);
    const popularMoods = getPopularMoods(20);

    const prompt = buildPrompt(config.prompt, popularTags, popularMoods);

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
      mood: normalizedMood,
      configId: config.id
    };
  } catch (error) {
    console.error('Gemini analysis error:', error);
    throw error;
  }
}

/**
 * Build the batch prompt with tag/mood suggestions
 */
function buildBatchPrompt(basePrompt: string, imageCount: number, popularTags: string[], popularMoods: string[]): string {
  const tagSuggestions = popularTags.length > 0
    ? `\n\nTAGS EXISTANTS POPULAIRES (à réutiliser en priorité si pertinent pour chaque image) :\n${popularTags.join(', ')}`
    : '';

  const moodSuggestions = popularMoods.length > 0
    ? `\n\nMOODS EXISTANTS (à réutiliser en priorité si pertinent) :\n${popularMoods.join(', ')}`
    : '';

  return `Analysez chacune des ${imageCount} images artistiques/photographies fournies et pour CHAQUE image, fournissez :
${basePrompt}${tagSuggestions}${moodSuggestions}

IMPORTANT :
- Pour CHAQUE image : RÉUTILISEZ en priorité les tags/moods de la liste ci-dessus s'ils sont pertinents
- Cela permet de mieux organiser et regrouper les images similaires
- Ne créez un nouveau tag/mood que si aucun terme existant ne convient
- Utilisez exactement la même casse que dans la liste (ex: "architecture" pas "Architecture")
- Retournez un tableau JSON avec exactement ${imageCount} éléments, dans le MÊME ORDRE que les images fournies

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
}

/**
 * Analyze multiple images in a single Gemini API call (up to 75 images)
 * Much more efficient than calling analyzeImage() multiple times
 * Returns analyses AND usage metadata for API call tracking
 */
export async function analyzeImagesBatch(imagePaths: string[], configId?: string): Promise<ImageAnalysisBatchResult> {
  try {
    // Get the config (specified or default)
    const config = configId
      ? enrichmentConfigDb.getById(configId)
      : enrichmentConfigDb.getDefault();

    if (!config) {
      throw new Error('No enrichment config found');
    }

    if (imagePaths.length === 0) {
      return { analyses: [], configId: config.id };
    }

    // Gemini 3 Flash has 1M token context - 75 images uses ~150-300k tokens (safe margin)
    if (imagePaths.length > 75) {
      throw new Error('Cannot analyze more than 75 images in a single batch');
    }

    const model = genAI.getGenerativeModel({ model: config.model });

    // Get existing popular tags and moods to encourage reuse across all images
    const popularTags = getPopularTags(50);
    const popularMoods = getPopularMoods(20);

    // Prepare all images
    const imageData = imagePaths.map(imagePath => {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const mimeType = getMimeType(imagePath);
      return { mimeType, data: base64Image };
    });

    const prompt = buildBatchPrompt(config.prompt, imagePaths.length, popularTags, popularMoods);

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
      configId: config.id,
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
- Si un terme est unique ET sans équivalent, ne le retournez pas`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const geminiTags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const geminiMoods = Array.isArray(parsed.moods) ? parsed.moods : [];

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

// ===== FAMILY RECOGNITION FUNCTIONS =====

export interface PersonDetection {
  family_member_id: string;
  family_member_name: string;
  confidence: number;
  bounding_box?: BoundingBox;
}

export interface FamilyRecognitionResult {
  people: PersonDetection[];
}

/**
 * Build training examples prompt section
 */
function buildTrainingExamplesPrompt(members: FamilyMember[], uploadsDir: string): { prompt: string; images: Array<{ inlineData: { mimeType: string; data: string } }> } {
  const images: Array<{ inlineData: { mimeType: string; data: string } }> = [];
  let prompt = '\n\n=== EXEMPLES D\'ENTRAÎNEMENT ===\n\n';
  prompt += 'Voici des exemples de photos pour vous aider à identifier les personnes :\n\n';

  let exampleIndex = 1;
  for (const member of members) {
    const trainingImages = trainingImageDb.getByMemberId(member.id);

    if (trainingImages.length > 0) {
      prompt += `${member.name} (${member.relationship || 'membre de la famille'}):\n`;

      // Take up to 3 training images per person
      const selectedTraining = trainingImages.slice(0, 3);

      for (const training of selectedTraining) {
        const imagePath = path.join(uploadsDir, 'training', `${training.filename}.webp`);

        if (fs.existsSync(imagePath)) {
          try {
            const imageBuffer = fs.readFileSync(imagePath);
            const base64Image = imageBuffer.toString('base64');
            images.push({
              inlineData: {
                mimeType: 'image/webp',
                data: base64Image
              }
            });
            prompt += `  - Exemple ${exampleIndex} (voir image ci-dessous)\n`;
            exampleIndex++;
          } catch (error) {
            console.error(`Failed to load training image ${imagePath}:`, error);
          }
        }
      }
      prompt += '\n';
    }
  }

  return { prompt, images };
}

/**
 * Analyze an image to detect and recognize family members
 */
export async function recognizePeople(imagePath: string, uploadsDir: string): Promise<FamilyRecognitionResult> {
  try {
    // Get all family members
    const members = familyMemberDb.getAll();

    if (members.length === 0) {
      return { people: [] };
    }

    // Use Gemini Flash for speed
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build training examples
    const { prompt: trainingPrompt, images: trainingImages } = buildTrainingExamplesPrompt(members, uploadsDir);

    // Read target image
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);

    // Build member list
    const membersList = members.map(m => `- ${m.name} (${m.relationship || 'membre de la famille'})`).join('\n');

    // Build complete prompt
    const prompt = `Vous êtes un système de reconnaissance faciale pour une famille. Votre tâche est d'identifier les personnes présentes dans l'image fournie.

=== MEMBRES DE LA FAMILLE À RECONNAÎTRE ===

${membersList}

${trainingPrompt}

=== IMAGE À ANALYSER ===

Analysez maintenant l'image suivante (la DERNIÈRE image fournie) et identifiez toutes les personnes qui correspondent aux membres de la famille ci-dessus.

Pour chaque personne détectée, fournissez :
1. L'ID du membre de la famille (utilisez exactement l'un des IDs ci-dessous)
2. Le niveau de confiance (0.0 à 1.0)
3. Si possible, la position approximative (bounding box avec x, y, width, height en pourcentage de 0 à 100)

IDs des membres :
${members.map(m => `- ${m.name}: "${m.id}"`).join('\n')}

IMPORTANT :
- Ne retournez que les personnes que vous reconnaissez avec une confiance >= 0.5
- Si vous n'êtes pas sûr, ne devinez pas
- Si aucune personne de la famille n'est détectée, retournez un tableau vide

Répondez au format JSON suivant :
{
  "people": [
    {
      "family_member_id": "id-du-membre",
      "confidence": 0.85,
      "bounding_box": {
        "x": 20,
        "y": 30,
        "width": 40,
        "height": 50
      }
    }
  ]
}`;

    // Prepare content parts (training images first, then target image)
    const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt }
    ];

    // Add training images
    contentParts.push(...trainingImages);

    // Add target image (the one to analyze)
    contentParts.push({
      inlineData: {
        mimeType,
        data: base64Image
      }
    });

    const result = await model.generateContent(contentParts);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse Gemini response:', text);
      return { people: [] };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const people = Array.isArray(parsed.people) ? parsed.people : [];

    // Enrich with member names
    const enrichedPeople: PersonDetection[] = people.map((p: any) => {
      const member = familyMemberDb.getById(p.family_member_id);
      return {
        family_member_id: p.family_member_id,
        family_member_name: member?.name || 'Unknown',
        confidence: p.confidence || 0,
        bounding_box: p.bounding_box
      };
    });

    console.log(`[Family Recognition] Detected ${enrichedPeople.length} people in image`);

    return {
      people: enrichedPeople
    };
  } catch (error) {
    console.error('Family recognition error:', error);
    throw error;
  }
}
