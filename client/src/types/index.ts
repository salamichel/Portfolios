export interface Theme {
  id: string;
  name: string;
  description: string | null;
  cover_image_id: string | null;
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
