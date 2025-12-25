import axios from 'axios';
import type { Theme, Image, PaginatedImages, Book, BookPage, PageTemplate, PageData, BookLayoutSuggestions, LayoutSuggestion, TagWithCount, MoodWithCount } from '../types';

const api = axios.create({
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
  getAll: (params?: { theme_id?: string; limit?: number; offset?: number; search?: string; tag?: string; mood?: string }) =>
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

  enrich: (id: string) => api.post<Image>(`/images/${id}/enrich`).then(res => res.data),

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

  create: (data: { name: string; description?: string; layout: { slots: any[] } }) =>
    api.post<PageTemplate>('/templates', data).then(res => res.data),

  update: (id: string, data: Partial<PageTemplate>) =>
    api.put<PageTemplate>(`/templates/${id}`, data).then(res => res.data),

  delete: (id: string) => api.delete(`/templates/${id}`)
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

  reorderPages: (bookId: string, orderedIds: string[]) =>
    api.put<BookPage[]>(`/books/${bookId}/pages/reorder`, { orderedIds }).then(res => res.data),

  // AI Layout suggestions
  suggestLayout: (bookId: string, imageIds: string[]) =>
    api.post<BookLayoutSuggestions>(`/books/${bookId}/suggest-layout`, { image_ids: imageIds }).then(res => res.data),

  applySuggestions: (bookId: string, suggestions: LayoutSuggestion[]) =>
    api.post<BookPage[]>(`/books/${bookId}/apply-suggestions`, { suggestions }).then(res => res.data)
};
