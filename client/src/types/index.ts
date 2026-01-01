export interface Theme {
  id: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  image_count?: number;
  images?: Image[];
}

export interface Image {
  id: string;
  filename: string;
  original_name: string;
  theme_id: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  mood: string | null;
  ai_enriched: boolean;
  enrichment_config_id: string | null;
  width: number | null;
  height: number | null;
  size: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedImages {
  images: Image[];
  total: number;
}

export interface UploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

// Layout slot definition for templates
export interface LayoutSlot {
  id: string;
  type: 'image' | 'text'; // Type of slot
  page: 'left' | 'right';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface TemplateLayout {
  slots: LayoutSlot[];
}

export type TemplateCategory = 'cover' | 'chapter' | 'standard' | 'gallery' | 'highlight' | 'narrative';

export interface PageTemplate {
  id: string;
  name: string;
  description: string | null;
  layout: TemplateLayout;
  category: TemplateCategory;
  is_predefined: boolean;
  created_at: string;
  updated_at: string;
}

export type BookStatus = 'draft' | 'in_progress' | 'pending_review' | 'published';

export interface Book {
  id: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
  page_format: string;
  tags: string | null;
  mood: string | null;
  status: BookStatus;
  created_at: string;
  updated_at: string;
  page_count?: number;
  pages?: BookPage[];
}

export interface TagWithCount {
  tag: string;
  count: number;
}

export interface MoodWithCount {
  mood: string;
  count: number;
}

// Annotation for a slot
export interface SlotAnnotation {
  title?: string;
  description?: string;
  paragraph?: string;
  show_title?: boolean;
  show_description?: boolean;
  show_paragraph?: boolean;
  position?: 'bottom' | 'top' | 'overlay' | 'side';
  use_image_metadata?: boolean; // Use AI-enriched metadata from image
}

// Page data stores image assignments to slots
export interface PageSlotData {
  slot_id: string;
  image_id: string;
  annotation?: SlotAnnotation;
}

// Text style options
export interface TextStyle {
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right';
  color?: string; // hex color
}

export interface TextSlotData {
  slot_id: string;
  content: string;
  style?: TextStyle;
}

export interface PageData {
  slots: PageSlotData[];
  textSlots?: TextSlotData[];
}

export interface BookPage {
  id: string;
  book_id: string;
  template_id: string | null;
  position: number;
  page_data: PageData | null;
  created_at: string;
  updated_at: string;
  template?: Partial<PageTemplate>;
  images?: Image[];
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

export type GeminiModel = 'gemini-3-flash-preview' | 'gemini-2.5-pro' | 'gemini-2.5-flash' | 'gemini-3-pro-preview';

export interface EnrichmentConfig {
  id: string;
  name: string;
  prompt: string;
  model: GeminiModel;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
