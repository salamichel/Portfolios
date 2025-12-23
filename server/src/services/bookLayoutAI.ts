import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Image, PageTemplate, TemplateLayout, PageData } from '../database.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface LayoutSuggestion {
  template_id: string;
  template_name: string;
  page_data: PageData;
  position: number;
  reasoning: string;
}

export interface BookLayoutSuggestions {
  suggestions: LayoutSuggestion[];
  total_pages: number;
  reasoning: string;
}

interface ImageAnalysis {
  id: string;
  orientation: 'portrait' | 'landscape' | 'square';
  aspect_ratio: number;
  mood: string | null;
  tags: string[];
  has_metadata: boolean;
}

function analyzeImageProperties(image: Image): ImageAnalysis {
  const width = image.width || 1;
  const height = image.height || 1;
  const aspect_ratio = width / height;

  let orientation: 'portrait' | 'landscape' | 'square';
  if (aspect_ratio > 1.1) {
    orientation = 'landscape';
  } else if (aspect_ratio < 0.9) {
    orientation = 'portrait';
  } else {
    orientation = 'square';
  }

  let tags: string[] = [];
  if (image.tags) {
    try {
      tags = JSON.parse(image.tags);
    } catch {
      tags = image.tags.split(',').map(t => t.trim());
    }
  }

  return {
    id: image.id,
    orientation,
    aspect_ratio,
    mood: image.mood,
    tags,
    has_metadata: image.ai_enriched || Boolean(image.title && image.description)
  };
}

function groupImagesByCharacteristics(analyses: ImageAnalysis[]): Map<string, ImageAnalysis[]> {
  const groups = new Map<string, ImageAnalysis[]>();

  // Group by mood first
  for (const analysis of analyses) {
    const mood = analysis.mood?.toLowerCase() || 'unknown';
    if (!groups.has(mood)) {
      groups.set(mood, []);
    }
    groups.get(mood)!.push(analysis);
  }

  return groups;
}

function selectBestTemplate(
  images: ImageAnalysis[],
  templates: PageTemplate[]
): { template: PageTemplate; assignedImages: ImageAnalysis[] } {
  const count = images.length;

  // Find templates that can accommodate the images
  const compatibleTemplates = templates.filter(t => {
    const slotCount = t.layout.slots.length;
    return slotCount <= count;
  });

  if (compatibleTemplates.length === 0) {
    // Default to single image template
    const singleTemplate = templates.find(t => t.layout.slots.length === 1);
    return {
      template: singleTemplate || templates[0],
      assignedImages: [images[0]]
    };
  }

  // Score templates based on image characteristics
  let bestTemplate = compatibleTemplates[0];
  let bestScore = 0;

  for (const template of compatibleTemplates) {
    let score = 0;
    const slotCount = template.layout.slots.length;

    // Prefer templates that use more images (but not too many)
    score += slotCount * 10;

    // Check if orientations match well
    const landscapeCount = images.slice(0, slotCount).filter(i => i.orientation === 'landscape').length;
    const portraitCount = images.slice(0, slotCount).filter(i => i.orientation === 'portrait').length;

    // Panoramic template for landscape images
    if (template.id === 'tpl-panoramic' && landscapeCount > 0) {
      score += 20;
    }

    // Full bleed for strong single images
    if (template.id === 'tpl-full-bleed-2' && count >= 2) {
      score += 15;
    }

    // Grid layouts for multiple similar images
    if (template.id.includes('grid') && count >= 4) {
      score += 15;
    }

    // 1 large + 2 small for mixed orientations
    if ((template.id === 'tpl-1-large-2-small' || template.id === 'tpl-2-small-1-large') && count >= 3) {
      if (landscapeCount > 0 && portraitCount > 0) {
        score += 20;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  return {
    template: bestTemplate,
    assignedImages: images.slice(0, bestTemplate.layout.slots.length)
  };
}

export async function suggestBookLayout(
  images: Image[],
  templates: PageTemplate[]
): Promise<BookLayoutSuggestions> {
  // Analyze all images
  const analyses = images.map(analyzeImageProperties);

  // Try AI-based suggestions if API key is available
  if (process.env.GEMINI_API_KEY) {
    try {
      return await getAISuggestions(images, analyses, templates);
    } catch (error) {
      console.error('AI suggestion failed, falling back to heuristics:', error);
    }
  }

  // Fallback to heuristic-based suggestions
  return getHeuristicSuggestions(analyses, templates);
}

async function getAISuggestions(
  images: Image[],
  analyses: ImageAnalysis[],
  templates: PageTemplate[]
): Promise<BookLayoutSuggestions> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const imageDescriptions = analyses.map((a, i) => ({
    index: i,
    id: a.id,
    orientation: a.orientation,
    aspect_ratio: a.aspect_ratio.toFixed(2),
    mood: a.mood || 'unknown',
    tags: a.tags.slice(0, 5),
    title: images[i].title || 'untitled'
  }));

  const templateDescriptions = templates.map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
    slot_count: t.layout.slots.length,
    has_panoramic: t.layout.slots.some(s => s.width > 100)
  }));

  const prompt = `Tu es un directeur artistique expert en mise en page de livres photo.

Voici ${images.length} images à disposer dans un book :
${JSON.stringify(imageDescriptions, null, 2)}

Voici les templates de mise en page disponibles :
${JSON.stringify(templateDescriptions, null, 2)}

Crée une disposition cohérente et artistique en suivant ces principes :
1. Grouper les images par ambiance/mood similaire
2. Alterner les rythmes visuels (pages calmes / pages dynamiques)
3. Respecter les orientations des images (panoramique pour paysages, etc.)
4. Créer des transitions fluides entre les pages
5. Mettre en valeur les images fortes en pleine page

Réponds en JSON avec ce format exact :
{
  "suggestions": [
    {
      "template_id": "id du template",
      "image_ids": ["id1", "id2"],
      "reasoning": "courte explication du choix"
    }
  ],
  "overall_reasoning": "explication de la logique globale"
}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();

  // Extract JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Convert AI suggestions to our format
  const suggestions: LayoutSuggestion[] = [];
  let position = 0;

  for (const suggestion of parsed.suggestions) {
    const template = templates.find(t => t.id === suggestion.template_id);
    if (!template) continue;

    const pageData: PageData = {
      slots: suggestion.image_ids.map((imageId: string, slotIndex: number) => ({
        slot_id: template.layout.slots[slotIndex]?.id || `slot-${slotIndex}`,
        image_id: imageId
      }))
    };

    suggestions.push({
      template_id: template.id,
      template_name: template.name,
      page_data: pageData,
      position: position++,
      reasoning: suggestion.reasoning
    });
  }

  return {
    suggestions,
    total_pages: suggestions.length,
    reasoning: parsed.overall_reasoning || 'Disposition générée par IA'
  };
}

function getHeuristicSuggestions(
  analyses: ImageAnalysis[],
  templates: PageTemplate[]
): BookLayoutSuggestions {
  const suggestions: LayoutSuggestion[] = [];
  let remainingImages = [...analyses];
  let position = 0;

  // Group by mood for coherent spreads
  const moodGroups = groupImagesByCharacteristics(remainingImages);

  for (const [mood, moodImages] of moodGroups) {
    let moodRemaining = [...moodImages];

    while (moodRemaining.length > 0) {
      const { template, assignedImages } = selectBestTemplate(moodRemaining, templates);

      const pageData: PageData = {
        slots: assignedImages.map((img, idx) => ({
          slot_id: template.layout.slots[idx]?.id || `slot-${idx}`,
          image_id: img.id
        }))
      };

      suggestions.push({
        template_id: template.id,
        template_name: template.name,
        page_data: pageData,
        position: position++,
        reasoning: `Images ${mood !== 'unknown' ? `d'ambiance "${mood}"` : 'groupées'} - ${template.name}`
      });

      // Remove assigned images
      const assignedIds = new Set(assignedImages.map(a => a.id));
      moodRemaining = moodRemaining.filter(img => !assignedIds.has(img.id));
    }
  }

  return {
    suggestions,
    total_pages: suggestions.length,
    reasoning: 'Disposition basée sur l\'analyse des caractéristiques des images (orientation, ambiance, tags)'
  };
}
