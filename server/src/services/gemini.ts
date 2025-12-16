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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = getMimeType(imagePath);

    const prompt = `Analyze this artistic/photography image and provide:
1. A creative, evocative title (max 10 words)
2. An artistic description that captures the mood, composition, and artistic elements (2-3 sentences)
3. Relevant tags for categorization (5-10 tags)
4. The overall mood/atmosphere (one or two words like "serene", "dramatic", "melancholic", etc.)

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
