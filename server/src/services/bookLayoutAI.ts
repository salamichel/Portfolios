import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Image, PageTemplate, TemplateLayout, PageData } from '../database.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface TextZoneInfo {
  slot_id: string;
  description: string;
  suggested_content?: string;
}

export interface LayoutSuggestion {
  template_id: string;
  template_name: string;
  page_data: PageData;
  position: number;
  reasoning: string;
  text_zones?: TextZoneInfo[];
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

interface TemplateAnalysis {
  template: PageTemplate;
  imageSlotCount: number;
  textSlotCount: number;
  hasTextZones: boolean;
  textSlotDescriptions: { slot_id: string; description: string }[];
}

function analyzeTemplate(template: PageTemplate): TemplateAnalysis {
  const imageSlots = template.layout.slots.filter(s => s.type === 'image');
  const textSlots = template.layout.slots.filter(s => s.type === 'text');

  // Generate descriptions for text zones based on slot ID and position
  const textSlotDescriptions = textSlots.map(slot => {
    let description = '';
    const slotId = slot.id.toLowerCase();

    if (slotId.includes('title') || slotId.includes('chapter')) {
      description = 'Titre ou en-tête';
    } else if (slotId.includes('caption') || slotId.includes('legend')) {
      description = 'Légende pour les images';
    } else if (slotId.includes('description') || slotId.includes('desc')) {
      description = 'Description ou texte explicatif';
    } else if (slotId.includes('text')) {
      description = 'Zone de texte libre';
    } else {
      description = 'Zone de texte';
    }

    return { slot_id: slot.id, description };
  });

  return {
    template,
    imageSlotCount: imageSlots.length,
    textSlotCount: textSlots.length,
    hasTextZones: textSlots.length > 0,
    textSlotDescriptions
  };
}

function getTextZonesForTemplate(template: PageTemplate): TextZoneInfo[] {
  const analysis = analyzeTemplate(template);
  return analysis.textSlotDescriptions.map(desc => ({
    slot_id: desc.slot_id,
    description: desc.description
  }));
}

function selectBestTemplate(
  images: ImageAnalysis[],
  templates: PageTemplate[],
  options: { preferTextZones?: boolean; isFirstPage?: boolean; isChapterStart?: boolean } = {}
): { template: PageTemplate; assignedImages: ImageAnalysis[]; textZones: TextZoneInfo[] } {
  const count = images.length;
  const { preferTextZones = false, isFirstPage = false, isChapterStart = false } = options;

  // Analyze all templates
  const analyzedTemplates = templates.map(analyzeTemplate);

  // Find templates that can accommodate the images (based on IMAGE slots only)
  const compatibleTemplates = analyzedTemplates.filter(ta => {
    return ta.imageSlotCount <= count && ta.imageSlotCount > 0;
  });

  if (compatibleTemplates.length === 0) {
    // Default to single image template
    const singleTemplate = analyzedTemplates.find(ta => ta.imageSlotCount === 1);
    const chosen = singleTemplate || analyzedTemplates[0];
    return {
      template: chosen.template,
      assignedImages: [images[0]],
      textZones: getTextZonesForTemplate(chosen.template)
    };
  }

  // Score templates based on image characteristics
  let bestAnalysis = compatibleTemplates[0];
  let bestScore = 0;

  for (const analysis of compatibleTemplates) {
    let score = 0;
    const template = analysis.template;
    const imageSlotCount = analysis.imageSlotCount;

    // Prefer templates that use more images (but not too many)
    score += imageSlotCount * 10;

    // Check if orientations match well
    const landscapeCount = images.slice(0, imageSlotCount).filter(i => i.orientation === 'landscape').length;
    const portraitCount = images.slice(0, imageSlotCount).filter(i => i.orientation === 'portrait').length;

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

    // Text zone bonuses based on context
    if (analysis.hasTextZones) {
      // General preference for text zones when requested
      if (preferTextZones) {
        score += 15;
      }

      // First page benefits from title template
      if (isFirstPage && template.id === 'tpl-title-image') {
        score += 30;
      }

      // Chapter start benefits from chapter intro
      if (isChapterStart && template.id === 'tpl-chapter-intro') {
        score += 30;
      }

      // Images with rich metadata benefit from caption templates
      const hasRichMetadata = images.slice(0, imageSlotCount).some(img => img.has_metadata);
      if (hasRichMetadata) {
        if (template.id === 'tpl-images-caption') {
          score += 20;
        }
        if (template.id === 'tpl-gallery-text') {
          score += 18;
        }
        if (template.id === 'tpl-image-text-right' || template.id === 'tpl-text-image-left') {
          score += 15;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestAnalysis = analysis;
    }
  }

  return {
    template: bestAnalysis.template,
    assignedImages: images.slice(0, bestAnalysis.imageSlotCount),
    textZones: getTextZonesForTemplate(bestAnalysis.template)
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
    title: images[i].title || 'untitled',
    has_metadata: a.has_metadata
  }));

  // Analyze templates to include text zone information
  const templateDescriptions = templates.map(t => {
    const analysis = analyzeTemplate(t);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      image_slot_count: analysis.imageSlotCount,
      has_text_zones: analysis.hasTextZones,
      text_zones: analysis.textSlotDescriptions,
      has_panoramic: t.layout.slots.some(s => s.width > 100)
    };
  });

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
6. IMPORTANT: Utilise les templates avec zones de texte pour enrichir la narration :
   - Propose un template avec titre (tpl-title-image) pour la première page
   - Propose des templates avec légendes (tpl-images-caption, tpl-gallery-text) pour les images ayant des métadonnées (has_metadata: true)
   - Propose des templates image+texte (tpl-image-text-right, tpl-text-image-left) pour créer du rythme
   - Propose un template chapitre (tpl-chapter-intro) lors des changements d'ambiance

NOTE: Le nombre d'images par template correspond à "image_slot_count", pas au nombre total de slots.

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

    // Get only image slots for proper assignment
    const imageSlots = template.layout.slots.filter(s => s.type === 'image');
    const textZones = getTextZonesForTemplate(template);

    const pageData: PageData = {
      slots: suggestion.image_ids.map((imageId: string, slotIndex: number) => ({
        slot_id: imageSlots[slotIndex]?.id || `slot-${slotIndex}`,
        image_id: imageId
      }))
    };

    // Add text zone info to reasoning if present
    let reasoning = suggestion.reasoning;
    if (textZones.length > 0) {
      reasoning += ` (${textZones.length} zone${textZones.length > 1 ? 's' : ''} de texte)`;
    }

    suggestions.push({
      template_id: template.id,
      template_name: template.name,
      page_data: pageData,
      position: position++,
      reasoning,
      text_zones: textZones.length > 0 ? textZones : undefined
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
  let isFirstMoodGroup = true;

  for (const [mood, moodImages] of moodGroups) {
    let moodRemaining = [...moodImages];
    let isFirstInMood = true;

    while (moodRemaining.length > 0) {
      // Determine context for template selection
      const isFirstPage = position === 0;
      const isChapterStart = isFirstInMood && !isFirstPage && isFirstMoodGroup === false;

      const { template, assignedImages, textZones } = selectBestTemplate(
        moodRemaining,
        templates,
        {
          preferTextZones: true,
          isFirstPage,
          isChapterStart
        }
      );

      // Get only image slots from the template
      const imageSlots = template.layout.slots.filter(s => s.type === 'image');

      const pageData: PageData = {
        slots: assignedImages.map((img, idx) => ({
          slot_id: imageSlots[idx]?.id || `slot-${idx}`,
          image_id: img.id
        }))
      };

      // Build reasoning with text zone info
      let reasoning = `Images ${mood !== 'unknown' ? `d'ambiance "${mood}"` : 'groupées'} - ${template.name}`;
      if (textZones.length > 0) {
        reasoning += ` (${textZones.length} zone${textZones.length > 1 ? 's' : ''} de texte disponible${textZones.length > 1 ? 's' : ''})`;
      }

      suggestions.push({
        template_id: template.id,
        template_name: template.name,
        page_data: pageData,
        position: position++,
        reasoning,
        text_zones: textZones.length > 0 ? textZones : undefined
      });

      // Remove assigned images
      const assignedIds = new Set(assignedImages.map(a => a.id));
      moodRemaining = moodRemaining.filter(img => !assignedIds.has(img.id));
      isFirstInMood = false;
    }

    isFirstMoodGroup = false;
  }

  return {
    suggestions,
    total_pages: suggestions.length,
    reasoning: 'Disposition basée sur l\'analyse des caractéristiques des images (orientation, ambiance, tags). Les templates avec zones de texte sont proposés pour enrichir votre mise en page.'
  };
}
