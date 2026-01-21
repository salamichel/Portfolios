import axios from 'axios';
import type { Theme, Image, PaginatedImages, Book, BookPage, PageTemplate, PageData, BookLayoutSuggestions, LayoutSuggestion, TagWithCount, MoodWithCount, EnrichmentConfig, GeminiModel } from '../types';

export const api = axios.create({
  baseURL: '/api'
});

// Themes API
export const themesApi = {
  getAll: () => api.get<Theme[]>('/themes').then(res => res.data),

  getById: (id: string) => api.get<Theme>(`/themes/${id}`).then(res => res.data),

  create: (data: { name: string; description?: string }) =>
    api.post<Theme>('/themes', data).then(res => res.data),

  update: (id: string, data: Partial<Theme>) =>
    api.put<Theme>(`/themes/${id}`, data).then(res => res.data),

  delete: (id: string) => api.delete(`/themes/${id}`),

  reorder: (orderedIds: string[]) =>
    api.put<Theme[]>('/themes/reorder', { orderedIds }).then(res => res.data),

  bulkDelete: (ids: string[]) =>
    api.delete<{ deleted: number }>('/themes/bulk', { data: { ids } }).then(res => res.data)
};

// Images API
export const imagesApi = {
  getAll: (params?: { theme_id?: string; limit?: number; offset?: number; search?: string; tag?: string; mood?: string; person?: string; sortBy?: string; sortOrder?: string }) =>
    api.get<PaginatedImages>('/images', { params }).then(res => res.data),

  getById: (id: string) => api.get<Image>(`/images/${id}`).then(res => res.data),

  getAllTags: () => api.get<string[]>('/images/meta/tags').then(res => res.data),

  getAllMoods: () => api.get<string[]>('/images/meta/moods').then(res => res.data),

  upload: (
    files: File[],
    options?: { theme_id?: string; auto_enrich?: boolean },
    onProgress?: (progress: number) => void
  ) => {
    const formData = new FormData();
    files.forEach(file => formData.append('images', file));
    if (options?.theme_id) formData.append('theme_id', options.theme_id);
    if (options?.auto_enrich) formData.append('auto_enrich', 'true');

    return api.post<Image[]>('/images/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      }
    }).then(res => res.data);
  },

  enrich: (id: string, configId?: string) =>
    api.post<Image>(`/images/${id}/enrich`, { config_id: configId }).then(res => res.data),

  getUnenriched: () => api.get<{ images: Image[]; count: number }>('/images/unenriched').then(res => res.data),

  batchEnrich: (imageIds: string[], configId?: string) => api.post<{
    total: number;
    successful: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
    report_id?: string;
  }>('/images/batch-enrich', { image_ids: imageIds, config_id: configId }).then(res => res.data),

  enrichAll: () => api.post<{
    message: string;
    total: number;
    image_ids: string[];
  }>('/images/enrich-all').then(res => res.data),

  update: (id: string, data: Partial<Image>) =>
    api.put<Image>(`/images/${id}`, data).then(res => res.data),

  delete: (id: string) => api.delete(`/images/${id}`),

  getTags: () => api.get<TagWithCount[]>('/images/metadata/tags').then(res => res.data),

  getMoods: () => api.get<MoodWithCount[]>('/images/metadata/moods').then(res => res.data)
};

// Helper to get the base name without extension
const getBaseName = (filename: string) => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
};

// Use optimized WebP versions for better performance
export const getImageUrl = (filename: string) => `/optimized/${getBaseName(filename)}.webp`;
export const getMediumImageUrl = (filename: string) => `/medium/medium_${getBaseName(filename)}.webp`;
export const getThumbnailUrl = (filename: string) => `/thumbnails/thumb_${getBaseName(filename)}.webp`;

// Keep original URLs available if needed
export const getOriginalImageUrl = (filename: string) => `/uploads/${filename}`;

// Templates API
export const templatesApi = {
  getAll: () => api.get<PageTemplate[]>('/templates').then(res => res.data),

  getById: (id: string) => api.get<PageTemplate>(`/templates/${id}`).then(res => res.data),

  create: (data: { name: string; description?: string; layout: { slots: any[] }; category?: string }) =>
    api.post<PageTemplate>('/templates', data).then(res => res.data),

  update: (id: string, data: Partial<PageTemplate>) =>
    api.put<PageTemplate>(`/templates/${id}`, data).then(res => res.data),

  delete: (id: string) => api.delete(`/templates/${id}`),

  generateMetadata: (layout: { slots: any[] }) =>
    api.post<{ name: string; description: string; category?: string }>('/templates/generate-metadata', { layout }).then(res => res.data)
};

// Books API
export const booksApi = {
  getAll: () => api.get<Book[]>('/books').then(res => res.data),

  getById: (id: string) => api.get<Book & { pages: BookPage[] }>(`/books/${id}`).then(res => res.data),

  create: (data: { name: string; description?: string; page_format?: string; tags?: string; mood?: string }) =>
    api.post<Book>('/books', data).then(res => res.data),

  update: (id: string, data: Partial<Book>) =>
    api.put<Book>(`/books/${id}`, data).then(res => res.data),

  delete: (id: string) => api.delete(`/books/${id}`),

  // Pages
  addPage: (bookId: string, data: { template_id?: string; page_data?: PageData; position?: number }) =>
    api.post<BookPage>(`/books/${bookId}/pages`, data).then(res => res.data),

  updatePage: (bookId: string, pageId: string, data: { template_id?: string; page_data?: PageData; position?: number }) =>
    api.put<BookPage>(`/books/${bookId}/pages/${pageId}`, data).then(res => res.data),

  deletePage: (bookId: string, pageId: string) =>
    api.delete(`/books/${bookId}/pages/${pageId}`),

  bulkDeletePages: (bookId: string, ids: string[]) =>
    api.delete<{ deleted: number }>(`/books/${bookId}/pages`, { data: { ids } }).then(res => res.data),

  reorderPages: (bookId: string, orderedIds: string[]) =>
    api.put<BookPage[]>(`/books/${bookId}/pages/reorder`, { orderedIds }).then(res => res.data),

  // AI Layout suggestions
  suggestLayout: (bookId: string, imageIds: string[], useCache: boolean = true) =>
    api.post<BookLayoutSuggestions>(`/books/${bookId}/suggest-layout`, { image_ids: imageIds, use_cache: useCache }).then(res => res.data),

  applySuggestions: (bookId: string, suggestions: LayoutSuggestion[]) =>
    api.post<BookPage[]>(`/books/${bookId}/apply-suggestions`, { suggestions }).then(res => res.data)
};

// Cleanup API
export interface SimilarityGroup {
  canonical: string;
  similar: string[];
  reason: string;
}

export interface CleanupSuggestions {
  tags: SimilarityGroup[];
  moods: SimilarityGroup[];
}

export interface CleanupAnalysisResponse {
  suggestions: CleanupSuggestions;
  stats: {
    totalTags: number;
    totalMoods: number;
    suggestedTagMerges: number;
    suggestedMoodMerges: number;
  };
}

export const cleanupApi = {
  analyze: () => api.post<CleanupAnalysisResponse>('/cleanup/analyze').then(res => res.data),

  mergeTag: (oldTag: string, newTag: string) =>
    api.post<{ success: boolean; updatedImages: number; message: string }>('/cleanup/merge-tag', { oldTag, newTag }).then(res => res.data),

  mergeMood: (oldMood: string, newMood: string) =>
    api.post<{ success: boolean; updatedImages: number; message: string }>('/cleanup/merge-mood', { oldMood, newMood }).then(res => res.data),

  deleteTag: (tag: string) =>
    api.delete<{ success: boolean; updatedImages: number; message: string }>(`/cleanup/tag/${encodeURIComponent(tag)}`).then(res => res.data),

  deleteMood: (mood: string) =>
    api.delete<{ success: boolean; updatedImages: number; message: string }>(`/cleanup/mood/${encodeURIComponent(mood)}`).then(res => res.data),

  applySuggestions: (tagMerges: SimilarityGroup[], moodMerges: SimilarityGroup[]) =>
    api.post<{ success: boolean; results: any; message: string }>('/cleanup/apply-suggestions', { tagMerges, moodMerges }).then(res => res.data)
};

// Duplicates API
export interface DuplicateImage {
  id: string;
  filename: string;
  title: string;
  upload_date: string;
  theme_id: string | null;
  tags: string[];
  mood: string | null;
  fileSize: number;
}

export interface DuplicateGroup {
  hash: string;
  count: number;
  images: DuplicateImage[];
  totalSize: number;
}

export interface DuplicateAnalysisResponse {
  duplicateGroups: DuplicateGroup[];
  stats: {
    totalImages: number;
    duplicateGroups: number;
    totalDuplicates: number;
    potentialSpaceSaved: number;
    errors: number;
  };
  errors?: string[];
}

export const duplicatesApi = {
  analyze: () => api.get<DuplicateAnalysisResponse>('/cleanup/duplicates/analyze').then(res => res.data),

  deleteImage: (imageId: string) =>
    api.delete<{ success: boolean; message: string }>(`/cleanup/duplicates/${imageId}`).then(res => res.data)
};

// Orphans API
export interface OrphanImage {
  id: string;
  filename: string;
  title: string;
  created_at: string;
  theme_id: string | null;
  tags: string[];
  mood: string | null;
}

export interface OrphanAnalysisResponse {
  orphans: OrphanImage[];
  stats: {
    totalImages: number;
    orphanedImages: number;
    percentageOrphaned: string;
  };
}

export interface OrphanCleanupResponse {
  success: boolean;
  stats: {
    totalImagesChecked: number;
    orphansDeleted: number;
  };
  deletedImages: Array<{
    id: string;
    filename: string;
    title: string;
  }>;
  message: string;
}

export const orphansApi = {
  analyze: () => api.get<OrphanAnalysisResponse>('/cleanup/orphans/analyze').then(res => res.data),

  cleanup: () => api.post<OrphanCleanupResponse>('/cleanup/orphans/cleanup').then(res => res.data)
};

// Enrichment Configs API
export const enrichmentConfigsApi = {
  getAll: () => api.get<EnrichmentConfig[]>('/enrichment-configs').then(res => res.data),

  getById: (id: string) => api.get<EnrichmentConfig>(`/enrichment-configs/${id}`).then(res => res.data),

  getDefault: () => api.get<EnrichmentConfig>('/enrichment-configs/default').then(res => res.data),

  getModels: () => api.get<GeminiModel[]>('/enrichment-configs/models').then(res => res.data),

  create: (data: { name: string; prompt: string; model: GeminiModel; is_default?: boolean }) =>
    api.post<EnrichmentConfig>('/enrichment-configs', data).then(res => res.data),

  update: (id: string, data: Partial<{ name: string; prompt: string; model: GeminiModel; is_default: boolean }>) =>
    api.put<EnrichmentConfig>(`/enrichment-configs/${id}`, data).then(res => res.data),

  delete: (id: string) => api.delete(`/enrichment-configs/${id}`),

  setDefault: (id: string) => api.post<EnrichmentConfig>(`/enrichment-configs/${id}/set-default`).then(res => res.data)
};
