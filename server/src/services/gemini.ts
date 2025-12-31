import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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

    const prompt = `Analysez cette image artistique/photographie et fournissez :
1. Un titre créatif et évocateur (max 10 mots)
2. Une description artistique qui capture l'ambiance, la composition et les éléments artistiques (2 à 3 phrases)
3. Des mots-clés pertinents pour la catégorisation (5 à 10 tags)
4. L'ambiance/atmosphère générale (un ou deux mots comme « serein », « dramatique », « mélancolique », etc.)

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

    return {
      title: parsed.title || 'Untitled',
      description: parsed.description || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      mood: parsed.mood || 'undefined'
    };
  } catch (error) {
    console.error('Gemini analysis error:', error);
    throw error;
  }
}

/**
 * Analyze multiple images in a single Gemini API call (up to 10 images)
 * Much more efficient than calling analyzeImage() multiple times
 * Returns analyses AND usage metadata for API call tracking
 */
export async function analyzeImagesBatch(imagePaths: string[]): Promise<ImageAnalysisBatchResult> {
  try {
    if (imagePaths.length === 0) {
      return { analyses: [] };
    }

    // Gemini supports up to 20 images per request
    if (imagePaths.length > 20) {
      throw new Error('Cannot analyze more than 20 images in a single batch');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

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
4. L'ambiance/atmosphère générale (un ou deux mots comme « serein », « dramatique », « mélancolique », etc.)

IMPORTANT : Retournez un tableau JSON avec exactement ${imagePaths.length} éléments, dans le MÊME ORDRE que les images fournies.

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

    const analyses = parsed.map(item => ({
      title: item.title || 'Untitled',
      description: item.description || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      mood: item.mood || 'undefined'
    }));

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

// Maximum number of tags to analyze (prioritize most used tags)
const MAX_TAGS_TO_ANALYZE = 300;

/**
 * Analyze tags and moods for similarities
 * Tags are expected to be sorted by count (descending) - most popular first
 * Only analyzes the top MAX_TAGS_TO_ANALYZE tags to avoid token limits
 */
export async function analyzeSimilarMetadata(
  tags: Array<{ tag: string; count: number }>,
  moods: Array<{ mood: string; count: number }>
): Promise<CleanupSuggestions> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

    // Limit to most popular tags (already sorted by count desc from database)
    const tagsToAnalyze = tags.slice(0, MAX_TAGS_TO_ANALYZE);
    const skippedCount = tags.length - tagsToAnalyze.length;

    if (skippedCount > 0) {
      console.log(`[Gemini] Analyzing top ${tagsToAnalyze.length} tags (skipping ${skippedCount} less popular tags)`);
    } else {
      console.log(`[Gemini] Analyzing all ${tags.length} tags`);
    }

    const prompt = `Analysez ces tags et ambiances (moods) et identifiez les groupes qui ont le même sens ou sont des variantes (synonymes, pluriel/singulier, langues différentes, fautes d'orthographe, etc.).

TAGS (triés par popularité décroissante):
${tagsToAnalyze.map(t => `- "${t.tag}" (${t.count} images)`).join('\n')}

MOODS:
${moods.map(m => `- "${m.mood}" (${m.count} images)`).join('\n')}

Pour chaque groupe de termes similaires :
1. Choisissez le terme CANONICAL (le plus utilisé ou le plus clair)
2. Listez les termes SIMILAIRES qui doivent être fusionnés avec lui
3. Expliquez brièvement pourquoi ils sont similaires

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

Notes importantes :
- Ne groupez que les termes vraiment similaires/synonymes
- Préférez le terme le plus utilisé comme canonical
- Si un terme est unique, ne le retournez pas
- Soyez intelligent pour détecter : pluriel/singulier, accents, casse, langues, synonymes`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      moods: Array.isArray(parsed.moods) ? parsed.moods : []
    };
  } catch (error) {
    console.error('Gemini similarity analysis error:', error);
    throw error;
  }
}
