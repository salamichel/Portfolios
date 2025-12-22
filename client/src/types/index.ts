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
  page: 'left' | 'right';
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  width: number; // percentage 0-100
  height: number; // percentage 0-100
}

export interface TemplateLayout {
  slots: LayoutSlot[];
}

export interface PageTemplate {
  id: string;
  name: string;
  description: string | null;
  layout: TemplateLayout;
  is_predefined: boolean;
  created_at: string;
  updated_at: string;
}

export interface Book {
  id: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
  page_format: string;
  created_at: string;
  updated_at: string;
  page_count?: number;
  pages?: BookPage[];
}

// Page data stores image assignments to slots
export interface PageSlotData {
  slot_id: string;
  image_id: string;
}

export interface PageData {
  slots: PageSlotData[];
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
