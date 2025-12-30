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

export async function analyzeImage(imagePath: string): Promise<ImageAnalysis> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

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

export async function analyzeSimilarMetadata(
  tags: Array<{ tag: string; count: number }>,
  moods: Array<{ mood: string; count: number }>
): Promise<CleanupSuggestions> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const prompt = `Analysez ces tags et ambiances (moods) et identifiez les groupes qui ont le même sens ou sont des variantes (synonymes, pluriel/singulier, langues différentes, fautes d'orthographe, etc.).

TAGS:
${tags.map(t => `- "${t.tag}" (utilisé ${t.count} fois)`).join('\n')}

MOODS:
${moods.map(m => `- "${m.mood}" (utilisé ${m.count} fois)`).join('\n')}

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
