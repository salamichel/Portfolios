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
