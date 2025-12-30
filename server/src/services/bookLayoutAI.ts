import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Image, PageTemplate, TemplateLayout, PageData, LayoutSlot, SlotAnnotation } from '../database.js';
import { ProcessingReportTracker } from './processingReportService.js';

// Use dedicated book API key, fallback to general Gemini key for backward compatibility
const genAI = new GoogleGenerativeAI(process.env.GEMINI_BOOK_API_KEY || process.env.GEMINI_API_KEY || '');

// Configuration constants
const AI_REQUEST_TIMEOUT_MS = parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '45000', 10); // 45 seconds default
const AI_MAX_RETRIES = parseInt(process.env.AI_MAX_RETRIES || '3', 10); // 3 retries default
const AI_RETRY_BASE_DELAY_MS = 2000; // Start with 2 seconds
const AI_CACHE_TTL_MS = parseInt(process.env.AI_CACHE_TTL_MS || '900000', 10); // 15 minutes default

// Simple in-memory cache for AI suggestions
interface CacheEntry {
  suggestions: BookLayoutSuggestions;
  timestamp: number;
}

const suggestionsCache = new Map<string, CacheEntry>();

/**
 * Generate cache key from image IDs
 */
function generateCacheKey(imageIds: string[]): string {
  // Sort IDs to ensure same images in different order produce same key
  return imageIds.slice().sort().join('|');
}

/**
 * Get cached suggestions if available and not expired
 */
function getCachedSuggestions(imageIds: string[]): BookLayoutSuggestions | null {
  const key = generateCacheKey(imageIds);
  const entry = suggestionsCache.get(key);

  if (!entry) {
    return null;
  }

  // Check if cache entry has expired
  const now = Date.now();
  if (now - entry.timestamp > AI_CACHE_TTL_MS) {
    suggestionsCache.delete(key);
    return null;
  }

  console.log(`Cache hit for ${imageIds.length} images (age: ${Math.round((now - entry.timestamp) / 1000)}s)`);
  return entry.suggestions;
}

/**
 * Store suggestions in cache
 */
function cacheSuggestions(imageIds: string[], suggestions: BookLayoutSuggestions): void {
  const key = generateCacheKey(imageIds);
  suggestionsCache.set(key, {
    suggestions,
    timestamp: Date.now()
  });

  // Cleanup old entries (simple garbage collection)
  const now = Date.now();
  for (const [k, entry] of suggestionsCache.entries()) {
    if (now - entry.timestamp > AI_CACHE_TTL_MS) {
      suggestionsCache.delete(k);
    }
  }

  console.log(`Cached suggestions for ${imageIds.length} images (cache size: ${suggestionsCache.size})`);
}

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

// Helper function to add rich text formatting to content
function enrichTextWithFormatting(
  content: string,
  slotType: string,
  context: { isFirstPage?: boolean; isChapterStart?: boolean; mood?: string }
): string {
  if (!content) return content;

  const { isFirstPage, isChapterStart, mood } = context;
  const slotId = slotType.toLowerCase();

  // Title or chapter slots get heading formatting
  if (slotId.includes('title') || slotId.includes('chapter')) {
    if (isFirstPage) {
      // Main book title: large heading with bold
      return `# **${content}**`;
    } else if (isChapterStart) {
      // Chapter title: medium heading with mood subtitle
      const moodText = mood && mood !== 'unknown' ? `\n*${mood.charAt(0).toUpperCase() + mood.slice(1)}*` : '';
      return `## **${content}**${moodText}`;
    } else {
      // Regular title: bold
      return `**${content}**`;
    }
  }

  // Caption or legend: emphasize first part
  if (slotId.includes('caption') || slotId.includes('legend')) {
    // Split by separator and make alternating parts bold
    const parts = content.split(' • ');
    if (parts.length > 1) {
      return parts.map((part, idx) => idx % 2 === 0 ? `**${part}**` : `*${part}*`).join(' • ');
    }
    return `*${content}*`;
  }

  // Description: add emphasis to first sentence
  if (slotId.includes('description') || slotId.includes('desc')) {
    const sentences = content.split(/\n\n|\. /);
    if (sentences.length > 1) {
      const first = sentences[0].trim();
      const rest = sentences.slice(1).join('. ').trim();
      return `**${first}.**\n\n*${rest}*`;
    }
    return `*${content}*`;
  }

  // Generic text zones: smart emphasis on key words
  if (slotId.includes('text')) {
    // If it's a comma-separated list (tags), make some bold
    if (content.includes(',')) {
      const items = content.split(',').map(s => s.trim());
      return items.map((item, idx) => idx < 2 ? `**${item}**` : item).join(', ');
    }
    // Otherwise add italic emphasis
    return `*${content}*`;
  }

  return content;
}

// Helper function to create automatic annotation for images with enriched metadata
function createAutoAnnotation(image: Image): SlotAnnotation | undefined {
  // Only create annotation if image has AI-enriched metadata or title
  if (!image.ai_enriched && !image.title) {
    return undefined;
  }

  return {
    title: image.title || undefined,
    description: image.description || undefined,
    show_title: Boolean(image.title),
    show_description: false, // Keep description hidden by default
    show_paragraph: false,
    position: 'bottom',
    use_image_metadata: true
  };
}

// Generate suggested content for text zones based on images metadata
function generateTextContent(
  template: PageTemplate,
  assignedImages: Image[],
  context: { isFirstPage?: boolean; isChapterStart?: boolean; mood?: string }
): TextZoneInfo[] {
  const analysis = analyzeTemplate(template);
  const { isFirstPage, isChapterStart, mood } = context;

  return analysis.textSlotDescriptions.map(desc => {
    const slotId = desc.slot_id.toLowerCase();
    let suggested_content = '';

    // Generate content based on slot type and context
    if (slotId.includes('title') || slotId.includes('chapter')) {
      if (isFirstPage) {
        // Use first image title or mood for book title
        const mainImage = assignedImages[0];
        if (mainImage?.title) {
          suggested_content = mainImage.title;
        } else if (mood && mood !== 'unknown') {
          suggested_content = mood.charAt(0).toUpperCase() + mood.slice(1);
        }
      } else if (isChapterStart && mood && mood !== 'unknown') {
        suggested_content = mood.charAt(0).toUpperCase() + mood.slice(1);
      } else if (assignedImages[0]?.title) {
        suggested_content = assignedImages[0].title;
      }
    } else if (slotId.includes('caption') || slotId.includes('legend')) {
      // Combine image titles for caption
      const titles = assignedImages
        .filter((img: Image) => img.title)
        .map((img: Image) => img.title);
      if (titles.length > 0) {
        suggested_content = titles.join(' • ');
      }
    } else if (slotId.includes('description') || slotId.includes('desc')) {
      // Use first image description or combine descriptions
      const descriptions = assignedImages
        .filter((img: Image) => img.description)
        .map((img: Image) => img.description);
      if (descriptions.length > 0) {
        suggested_content = descriptions.join('\n\n');
      }
    } else if (slotId.includes('text')) {
      // For generic text zones, use description or create from tags
      const mainImage = assignedImages[0];
      if (mainImage?.description) {
        suggested_content = mainImage.description;
      } else {
        // Combine tags from all images
        const allTags: string[] = [];
        for (const img of assignedImages) {
          if (img.tags) {
            try {
              const tags = JSON.parse(img.tags);
              allTags.push(...tags);
            } catch {
              allTags.push(...img.tags.split(',').map(t => t.trim()));
            }
          }
        }
        if (allTags.length > 0) {
          const uniqueTags = [...new Set(allTags)].slice(0, 5);
          suggested_content = uniqueTags.join(', ');
        }
      }
    }

    // Apply rich text formatting
    if (suggested_content) {
      suggested_content = enrichTextWithFormatting(suggested_content, desc.slot_id, context);
    }

    return {
      slot_id: desc.slot_id,
      description: desc.description,
      suggested_content: suggested_content || undefined
    };
  });
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
        // Zig-zag templates are excellent for rich narrative with metadata
        if (template.id === 'tpl-zigzag-3-rows' || template.id === 'tpl-zigzag-3-reverse') {
          score += 25; // High score for narrative storytelling
          // Additional bonus if we have exactly 3 images with metadata
          if (count >= 3) {
            const richImages = images.slice(0, 3).filter(img => img.has_metadata).length;
            if (richImages >= 2) {
              score += 10; // Extra bonus for well-documented images
            }
          }
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
  templates: PageTemplate[],
  options: { useCache?: boolean; previousPages?: LayoutSuggestion[]; bookId?: string; tracker?: ProcessingReportTracker } = {}
): Promise<BookLayoutSuggestions> {
  const { useCache = true, previousPages, bookId, tracker: existingTracker } = options;

  // Create tracker if bookId is provided and no tracker exists
  const tracker = existingTracker || (bookId ? new ProcessingReportTracker(bookId, images.length) : null);

  // Check cache first if enabled
  if (useCache) {
    const imageIds = images.map(img => img.id);
    const cached = getCachedSuggestions(imageIds);
    if (cached) {
      // Mark as cache hit if tracker is available
      if (tracker) {
        tracker.markCacheHit();
      }
      return cached;
    }
  }

  // Analyze all images
  const analyses = images.map(analyzeImageProperties);

  // Try AI-based suggestions if API key is available
  if (process.env.GEMINI_API_KEY) {
    try {
      const suggestions = await getAISuggestions(images, analyses, templates, { previousPages, tracker });

      // Cache the results
      if (useCache) {
        const imageIds = images.map(img => img.id);
        cacheSuggestions(imageIds, suggestions);
      }

      // Mark as complete if tracker is available
      if (tracker) {
        tracker.complete();
      }

      return suggestions;
    } catch (error) {
      console.error('AI suggestion failed, falling back to heuristics:', error);

      // Mark as failed if tracker is available
      if (tracker) {
        tracker.fail(error instanceof Error ? error.message : String(error));
      }
    }
  }

  // Fallback to heuristic-based suggestions
  return getHeuristicSuggestions(images, analyses, templates);
}

/**
 * Helper function to add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Helper function to add delay (for retry backoff)
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Helper function to retry a function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: (retryAttempt?: number) => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { maxRetries = AI_MAX_RETRIES, baseDelayMs = AI_RETRY_BASE_DELAY_MS, onRetry } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn(attempt > 0 ? attempt : undefined);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Check if error is retryable (network errors, timeouts, rate limits)
      const isRetryable =
        lastError.message.includes('timeout') ||
        lastError.message.includes('network') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('429') || // Rate limit
        lastError.message.includes('503') || // Service unavailable
        lastError.message.includes('500');   // Internal server error

      if (!isRetryable) {
        // Non-retryable error, throw immediately
        throw lastError;
      }

      // Calculate exponential backoff delay: 2s, 4s, 8s
      const delayMs = baseDelayMs * Math.pow(2, attempt);

      if (onRetry) {
        onRetry(lastError, attempt + 1);
      }

      console.log(`AI request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delayMs}ms...`, lastError.message);

      await delay(delayMs);
    }
  }

  throw lastError || new Error('Unknown error during retry');
}

/**
 * Helper function to safely parse AI JSON response
 * Handles responses wrapped in markdown code blocks or with surrounding text
 */
function parseAIResponse(text: string): any {
  let jsonText = text.trim();

  // Try to extract JSON from markdown code blocks
  if (jsonText.includes('```json')) {
    const match = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1].trim();
    }
  } else if (jsonText.includes('```')) {
    const match = jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (match) {
      jsonText = match[1].trim();
    }
  } else {
    // Try to extract JSON object from text
    const match = jsonText.match(/(\{[\s\S]*\})/);
    if (match) {
      jsonText = match[1];
    }
  }

  // Parse JSON
  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`Failed to parse AI response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract and normalize UUID from potentially malformed image_id
 * Handles cases where AI concatenates parts of UUIDs incorrectly
 */
function normalizeImageId(imageId: string, validImageIds: Set<string>): string | null {
  // If the ID is already valid, return it as-is
  if (validImageIds.has(imageId)) {
    return imageId;
  }

  // Try to extract a valid UUID pattern (8-4-4-4-12 format)
  // UUID regex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const matches = imageId.match(uuidRegex);

  if (matches) {
    // Try each match to see if it's valid
    for (const match of matches) {
      if (validImageIds.has(match)) {
        console.log(`Corrected malformed image_id "${imageId}" to "${match}"`);
        return match;
      }
    }
  }

  // Try partial matching - check if any valid ID contains this string or vice versa
  for (const validId of validImageIds) {
    if (imageId.includes(validId) || validId.includes(imageId)) {
      console.log(`Fuzzy matched image_id "${imageId}" to "${validId}"`);
      return validId;
    }
  }

  return null;
}

/**
 * Validates and normalizes AI response schema and data integrity
 * Returns valid suggestions and filters out invalid ones
 */
function validateAIResponse(
  parsed: any,
  images: Image[],
  templates: PageTemplate[]
): { isValid: boolean; errors: string[]; validSuggestions: any[] } {
  const errors: string[] = [];
  const validSuggestions: any[] = [];

  // Check basic structure
  if (!parsed || typeof parsed !== 'object') {
    errors.push('Response is not an object');
    return { isValid: false, errors, validSuggestions: [] };
  }

  if (!Array.isArray(parsed.suggestions)) {
    errors.push('Missing or invalid "suggestions" array');
    return { isValid: false, errors, validSuggestions: [] };
  }

  // Build lookup maps for fast validation
  const validImageIds = new Set(images.map(img => img.id));
  const validTemplateIds = new Set(templates.map(t => t.id));

  // Validate and normalize each suggestion
  parsed.suggestions.forEach((suggestion: any, index: number) => {
    const prefix = `Suggestion ${index + 1}`;
    const suggestionErrors: string[] = [];

    // Check template_id
    if (!suggestion.template_id) {
      suggestionErrors.push(`${prefix}: Missing template_id`);
    } else if (!validTemplateIds.has(suggestion.template_id)) {
      suggestionErrors.push(`${prefix}: Invalid template_id "${suggestion.template_id}"`);
    }

    // Check and normalize image_ids
    if (!Array.isArray(suggestion.image_ids)) {
      suggestionErrors.push(`${prefix}: Missing or invalid image_ids array`);
    } else {
      // Normalize image IDs in place
      const normalizedIds: string[] = [];
      suggestion.image_ids.forEach((imageId: string, imgIndex: number) => {
        const normalized = normalizeImageId(imageId, validImageIds);
        if (!normalized) {
          suggestionErrors.push(`${prefix}: Invalid image_id "${imageId}" at index ${imgIndex}`);
        } else {
          normalizedIds.push(normalized);
        }
      });

      // Replace with normalized IDs
      suggestion.image_ids = normalizedIds;

      // Check if image count matches template slots
      if (suggestion.template_id && validTemplateIds.has(suggestion.template_id)) {
        const template = templates.find(t => t.id === suggestion.template_id);
        if (template) {
          const imageSlotCount = template.layout.slots.filter(s => s.type === 'image').length;
          if (suggestion.image_ids.length !== imageSlotCount) {
            suggestionErrors.push(`${prefix}: Template "${template.name}" requires ${imageSlotCount} images but got ${suggestion.image_ids.length}`);
          }
        }
      }
    }

    // Validate text_content if present
    if (suggestion.text_content !== undefined && suggestion.text_content !== null && typeof suggestion.text_content !== 'object') {
      suggestionErrors.push(`${prefix}: text_content must be an object`);
    }

    // If this suggestion has no errors, add it to valid suggestions
    if (suggestionErrors.length === 0) {
      validSuggestions.push(suggestion);
    } else {
      // Log this suggestion's errors but don't fail completely
      console.warn(`Skipping invalid suggestion ${index + 1}:`, suggestionErrors.join('; '));
      errors.push(...suggestionErrors);
    }
  });

  return {
    isValid: validSuggestions.length > 0,
    errors,
    validSuggestions
  };
}

/**
 * Prepare image descriptions for AI prompt
 */
function prepareImageDescriptions(images: Image[], analyses: ImageAnalysis[]) {
  return analyses.map((a, i) => ({
    index: i,
    id: a.id,
    orientation: a.orientation,
    aspect_ratio: a.aspect_ratio.toFixed(2),
    mood: a.mood || 'unknown',
    tags: a.tags.slice(0, 5),
    title: images[i].title || null,
    description: images[i].description || null,
    has_metadata: a.has_metadata
  }));
}

/**
 * Prepare template descriptions for AI prompt
 */
function prepareTemplateDescriptions(templates: PageTemplate[]) {
  return templates.map(t => {
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
}

/**
 * Build AI prompt for layout suggestions
 */
function buildAIPrompt(
  imageDescriptions: any[],
  templateDescriptions: any[],
  options: { previousPages?: LayoutSuggestion[] } = {}
): string {
  const { previousPages } = options;

  let contextSection = '';
  if (previousPages && previousPages.length > 0) {
    const lastPages = previousPages.slice(-2); // Last 2 pages for context
    contextSection = `\n\nCONTEXTE DES PAGES PRÉCÉDENTES (pour assurer la cohérence narrative) :
${lastPages.map((p, idx) => `Page ${previousPages.length - lastPages.length + idx + 1}: Template "${p.template_name}" - ${p.reasoning}`).join('\n')}

Assure une transition fluide et une continuité narrative avec ces pages précédentes.\n`;
  }

  return `Tu es un directeur artistique et rédacteur expert en mise en page de livres photo.

Voici ${imageDescriptions.length} images à disposer dans un book :
${JSON.stringify(imageDescriptions, null, 2)}

Voici les templates de mise en page disponibles :
${JSON.stringify(templateDescriptions, null, 2)}${contextSection}

Crée une disposition cohérente et artistique en suivant ces principes :
1. Grouper les images par ambiance/mood similaire
2. Alterner les rythmes visuels (pages calmes / pages dynamiques)
3. Respecter les orientations des images (panoramique pour paysages, etc.)
4. Créer des transitions fluides entre les pages
5. Mettre en valeur les images fortes en pleine page
6. IMPORTANT: Utilise les templates avec zones de texte pour enrichir la narration :
   - Propose un template avec titre (tpl-title-image) pour la première page
   - Propose des templates avec légendes (tpl-images-caption, tpl-gallery-text) pour les images ayant des métadonnées
   - Propose des templates image+texte (tpl-image-text-right, tpl-text-image-left) pour créer du rythme
   - Propose des templates zig-zag (tpl-zigzag-3-rows, tpl-zigzag-3-reverse) pour une narration dynamique
   - Propose un template chapitre (tpl-chapter-intro) lors des changements d'ambiance
7. Pour chaque zone de texte, génère un contenu approprié basé sur les métadonnées des images (title, description, tags, mood)
8. MISE EN FORME DU TEXTE : Utilise les balises Markdown pour enrichir le texte :
   - **texte** pour mettre en gras (emphase forte)
   - *texte* pour mettre en italique (emphase légère, citations)
   - # Titre pour un grand titre (xlarge)
   - ## Sous-titre pour un titre moyen (large)
   - Varie les tailles et les emphases pour créer une hiérarchie visuelle
   - Exemples :
     * "# **Voyage en Islande**\\n*Une aventure au cœur des glaciers*"
     * "**Lumière du soir** sur les *fjords norvégiens*"
     * "## Chapitre 2\\nLes montagnes nous **appellent** avec leur *silence majestueux*"

NOTE: Le nombre d'images par template correspond à "image_slot_count", pas au nombre total de slots.

Réponds en JSON avec ce format exact :
{
  "suggestions": [
    {
      "template_id": "id du template",
      "image_ids": ["id1", "id2"],
      "reasoning": "courte explication du choix",
      "text_content": {
        "slot_id": "contenu suggéré avec balises Markdown pour le formatage"
      }
    }
  ],
  "overall_reasoning": "explication de la logique globale"
}

IMPORTANT: Pour "text_content", utilise les slot_id des zones de texte du template choisi comme clés, et génère un texte court et évocateur avec formatage Markdown comme valeur. Inspire-toi des titres, descriptions et ambiances des images.`;
}

/**
 * Call Gemini API with retry and timeout
 */
async function callGeminiAPI(prompt: string, tracker?: ProcessingReportTracker | null): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

  return await retryWithBackoff(
    async (retryAttempt?: number) => {
      const callStartTime = Date.now();
      try {
        const result = await withTimeout(
          model.generateContent(prompt),
          AI_REQUEST_TIMEOUT_MS
        );
        const response = await result.response;
        const text = response.text();
        const callDuration = Date.now() - callStartTime;

        // Track successful API call
        if (tracker) {
          // Get usage metadata if available
          const usageMetadata = response.usageMetadata;
          const tokens = {
            prompt: usageMetadata?.promptTokenCount || 0,
            completion: usageMetadata?.candidatesTokenCount || 0,
            total: usageMetadata?.totalTokenCount || 0
          };
          tracker.trackApiCall(tokens, callDuration, retryAttempt, prompt, text);
        }

        return text;
      } catch (error) {
        const callDuration = Date.now() - callStartTime;

        // Track failed API call
        if (tracker) {
          tracker.trackApiError(
            error instanceof Error ? error.message : String(error),
            callDuration,
            retryAttempt,
            prompt
          );
        }

        throw error;
      }
    },
    {
      onRetry: (error, attempt) => {
        console.log(`Gemini API retry ${attempt}/${AI_MAX_RETRIES}:`, error.message);
      }
    }
  );
}

/**
 * Convert a single AI suggestion to PageData
 */
function convertSuggestionToPageData(
  suggestion: any,
  template: PageTemplate,
  images: Image[],
  position: number
): { pageData: PageData; textZones: TextZoneInfo[] } {
  const imageSlots = template.layout.slots.filter(s => s.type === 'image');
  const textSlots = template.layout.slots.filter(s => s.type === 'text');

  // Get assigned images for fallback content generation
  const assignedImages = suggestion.image_ids
    .map((id: string) => images.find((img: Image) => img.id === id))
    .filter((img: Image | undefined): img is Image => img !== undefined);

  // Determine context for formatting
  const isFirstPage = position === 0;
  const isChapterStart = position > 0 && suggestion.reasoning?.toLowerCase().includes('chapitre');
  const mood = assignedImages[0]?.mood || undefined;
  const context = { isFirstPage, isChapterStart, mood };

  // Build text zones with suggested content from AI or fallback
  const textZones: TextZoneInfo[] = textSlots.map(slot => {
    let aiContent = suggestion.text_content?.[slot.id];
    const analysis = analyzeTemplate(template);
    const slotDesc = analysis.textSlotDescriptions.find(d => d.slot_id === slot.id);

    // Apply rich text formatting to AI-generated content
    if (aiContent) {
      aiContent = enrichTextWithFormatting(aiContent, slot.id, context);
    }

    return {
      slot_id: slot.id,
      description: slotDesc?.description || 'Zone de texte',
      suggested_content: aiContent || undefined
    };
  });

  // If AI didn't provide content, fallback to heuristic generation
  if (textZones.some(tz => !tz.suggested_content) && assignedImages.length > 0) {
    const fallbackContent = generateTextContent(template, assignedImages, {
      isFirstPage,
      mood
    });
    for (const tz of textZones) {
      if (!tz.suggested_content) {
        const fallback = fallbackContent.find(fc => fc.slot_id === tz.slot_id);
        if (fallback?.suggested_content) {
          tz.suggested_content = fallback.suggested_content;
        }
      }
    }
  }

  const pageData: PageData = {
    slots: suggestion.image_ids.map((imageId: string, slotIndex: number) => {
      const image = assignedImages.find((img: Image) => img.id === imageId);
      const annotation = image ? createAutoAnnotation(image) : undefined;

      return {
        slot_id: imageSlots[slotIndex]?.id || `slot-${slotIndex}`,
        image_id: imageId,
        annotation
      };
    }),
    // Pre-fill text slots with suggested content
    textSlots: textZones
      .filter(tz => tz.suggested_content)
      .map(tz => ({
        slot_id: tz.slot_id,
        content: tz.suggested_content!
      }))
  };

  return { pageData, textZones };
}

async function getAISuggestions(
  images: Image[],
  analyses: ImageAnalysis[],
  templates: PageTemplate[],
  options: { previousPages?: LayoutSuggestion[]; tracker?: ProcessingReportTracker | null } = {}
): Promise<BookLayoutSuggestions> {
  const { previousPages, tracker } = options;

  // Prepare data for AI
  const imageDescriptions = prepareImageDescriptions(images, analyses);
  const templateDescriptions = prepareTemplateDescriptions(templates);

  // Build prompt with optional context
  const prompt = buildAIPrompt(imageDescriptions, templateDescriptions, { previousPages });

  // Call Gemini API
  const text = await callGeminiAPI(prompt, tracker);

  // Extract and parse JSON from response
  const parsed = parseAIResponse(text);

  // Validate AI response and get valid suggestions
  const validation = validateAIResponse(parsed, images, templates);
  if (!validation.isValid) {
    console.error('AI response validation failed - no valid suggestions found:', validation.errors);
    throw new Error(`Invalid AI response: no valid suggestions found`);
  }

  // Log if some suggestions were skipped
  if (validation.errors.length > 0) {
    console.warn(`AI response had ${validation.errors.length} validation errors, using ${validation.validSuggestions.length} valid suggestions`);
  }

  // Convert AI suggestions to our format
  const suggestions: LayoutSuggestion[] = [];
  let position = 0;

  for (const suggestion of validation.validSuggestions) {
    const template = templates.find(t => t.id === suggestion.template_id);
    if (!template) {
      console.warn(`Skipping suggestion with invalid template_id: ${suggestion.template_id}`);
      continue;
    }

    // Convert suggestion to page data
    const { pageData, textZones } = convertSuggestionToPageData(
      suggestion,
      template,
      images,
      position
    );

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
  images: Image[],
  analyses: ImageAnalysis[],
  templates: PageTemplate[]
): BookLayoutSuggestions {
  const suggestions: LayoutSuggestion[] = [];
  let remainingAnalyses = [...analyses];
  let position = 0;

  // Create a map from analysis ID to full image
  const imageMap = new Map(images.map((img: Image) => [img.id, img]));

  // Group by mood for coherent spreads
  const moodGroups = groupImagesByCharacteristics(remainingAnalyses);
  let isFirstMoodGroup = true;

  for (const [mood, moodAnalyses] of moodGroups) {
    let moodRemaining = [...moodAnalyses];
    let isFirstInMood = true;

    while (moodRemaining.length > 0) {
      // Determine context for template selection
      const isFirstPage = position === 0;
      const isChapterStart = isFirstInMood && !isFirstPage && isFirstMoodGroup === false;

      const { template, assignedImages: assignedAnalyses, textZones } = selectBestTemplate(
        moodRemaining,
        templates,
        {
          preferTextZones: true,
          isFirstPage,
          isChapterStart
        }
      );

      // Get full images for content generation
      const assignedFullImages = assignedAnalyses
        .map((a: ImageAnalysis) => imageMap.get(a.id))
        .filter((img: Image | undefined): img is Image => img !== undefined);

      // Generate text content for this page
      const textZonesWithContent = generateTextContent(template, assignedFullImages, {
        isFirstPage,
        isChapterStart,
        mood: mood !== 'unknown' ? mood : undefined
      });

      // Get only image slots from the template
      const imageSlots = template.layout.slots.filter(s => s.type === 'image');

      const pageData: PageData = {
        slots: assignedAnalyses.map((analysis, idx) => {
          const image = assignedFullImages.find(img => img.id === analysis.id);
          const annotation = image ? createAutoAnnotation(image) : undefined;

          return {
            slot_id: imageSlots[idx]?.id || `slot-${idx}`,
            image_id: analysis.id,
            annotation
          };
        }),
        // Pre-fill text slots with generated content
        textSlots: textZonesWithContent
          .filter(tz => tz.suggested_content)
          .map(tz => ({
            slot_id: tz.slot_id,
            content: tz.suggested_content!
          }))
      };

      // Build reasoning with text zone info
      let reasoning = `Images ${mood !== 'unknown' ? `d'ambiance "${mood}"` : 'groupées'} - ${template.name}`;
      if (textZonesWithContent.length > 0) {
        const withContent = textZonesWithContent.filter(tz => tz.suggested_content).length;
        reasoning += ` (${textZonesWithContent.length} zone${textZonesWithContent.length > 1 ? 's' : ''} de texte`;
        if (withContent > 0) {
          reasoning += `, ${withContent} pré-remplie${withContent > 1 ? 's' : ''}`;
        }
        reasoning += ')';
      }

      suggestions.push({
        template_id: template.id,
        template_name: template.name,
        page_data: pageData,
        position: position++,
        reasoning,
        text_zones: textZonesWithContent.length > 0 ? textZonesWithContent : undefined
      });

      // Remove assigned images
      const assignedIds = new Set(assignedAnalyses.map(a => a.id));
      moodRemaining = moodRemaining.filter((img: ImageAnalysis) => !assignedIds.has(img.id));
      isFirstInMood = false;
    }

    isFirstMoodGroup = false;
  }

  return {
    suggestions,
    total_pages: suggestions.length,
    reasoning: 'Disposition basée sur l\'analyse des caractéristiques des images (orientation, ambiance, tags). Les zones de texte sont pré-remplies avec les métadonnées de vos images.'
  };
}

/**
 * Generate template metadata (name and description) based on layout analysis
 */
export async function generateTemplateMetadata(layout: TemplateLayout): Promise<{ name: string; description: string; category?: string }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const slots = layout.slots;
  const totalSlots = slots.length;
  const imageSlots = slots.filter((s: LayoutSlot) => s.type === 'image').length;
  const textSlots = slots.filter((s: LayoutSlot) => s.type === 'text').length;
  const leftPageSlots = slots.filter((s: LayoutSlot) => s.page === 'left').length;
  const rightPageSlots = slots.filter((s: LayoutSlot) => s.page === 'right').length;
  const spanningSlots = slots.filter((s: LayoutSlot) => s.width > 100).length;

  const layoutDescription = slots.map((slot: LayoutSlot) => {
    const spanning = slot.width > 100 ? ' (spanning both pages)' : '';
    return `- ${slot.type} slot on ${slot.page} page at (${slot.x}%, ${slot.y}%) with size ${slot.width}x${slot.height}%${spanning}`;
  }).join('\n');

  const totalSlotsStr = String(totalSlots);
  const imageSlotsStr = String(imageSlots);
  const textSlotsStr = String(textSlots);
  const leftPageSlotsStr = String(leftPageSlots);
  const rightPageSlotsStr = String(rightPageSlots);
  const spanningSlotsStr = String(spanningSlots);

  const prompt = `Analyze this book template layout and generate a concise French name, description, and category.

Layout analysis:
- Total slots: ${totalSlotsStr}
- Image slots: ${imageSlotsStr}
- Text slots: ${textSlotsStr}
- Left page slots: ${leftPageSlotsStr}
- Right page slots: ${rightPageSlotsStr}
- Spanning slots (panoramic): ${spanningSlotsStr}

Slot details:
${layoutDescription}

Generate:
1. A short, descriptive French name (3-5 words max) that captures the layout style
2. A brief French description (1-2 sentences) explaining what this template is good for
3. The most appropriate category from: cover, chapter, standard, gallery, highlight, narrative
   - cover: For book covers and opening pages
   - chapter: For chapter introductions and section dividers
   - standard: For general multipurpose layouts
   - gallery: For displaying multiple images (grids, mosaics)
   - highlight: For emphasizing single images (panoramic, centered)
   - narrative: For combining images with text content

Respond ONLY with valid JSON in this format:
{
  "name": "Template name in French",
  "description": "Template description in French",
  "category": "one of: cover, chapter, standard, gallery, highlight, narrative"
}`;

  try {
    // Call Gemini API with retry and timeout
    const text = await retryWithBackoff(
      async () => {
        const result = await withTimeout(
          model.generateContent(prompt),
          AI_REQUEST_TIMEOUT_MS
        );
        return result.response.text().trim();
      },
      {
        onRetry: (error, attempt) => {
          console.log(`Template metadata generation retry ${attempt}/${AI_MAX_RETRIES}:`, error.message);
        }
      }
    );

    let jsonText = text;
    if (text.includes('```json')) {
      jsonText = text.split('```json')[1].split('```')[0].trim();
    } else if (text.includes('```')) {
      jsonText = text.split('```')[1].split('```')[0].trim();
    }

    const parsed = JSON.parse(jsonText);
    return {
      name: parsed.name || 'Nouveau template',
      description: parsed.description || 'Template personnalisé',
      category: parsed.category || 'standard'
    };
  } catch (error) {
    console.error('Failed to generate template metadata:', error);
    const parts: string[] = [];
    if (spanningSlots > 0) parts.push('Panoramique');
    if (imageSlots > 0) parts.push(`${imageSlots} image${imageSlots > 1 ? 's' : ''}`);
    if (textSlots > 0) parts.push(`${textSlots} texte${textSlots > 1 ? 's' : ''}`);

    return {
      name: parts.join(' + ') || 'Template personnalisé',
      description: `Template avec ${totalSlots} zone${totalSlots > 1 ? 's' : ''} sur double page`,
      category: 'standard'
    };
  }
}
