import axios from 'axios';
import type { Theme, Image, PaginatedImages } from '../types';

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

  delete: (id: string) => api.delete(`/themes/${id}`)
};

// Images API
export const imagesApi = {
  getAll: (params?: { theme_id?: string; limit?: number; offset?: number; search?: string }) =>
    api.get<PaginatedImages>('/images', { params }).then(res => res.data),

  getById: (id: string) => api.get<Image>(`/images/${id}`).then(res => res.data),

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

  delete: (id: string) => api.delete(`/images/${id}`)
};

// Helper to get the base name without extension
const getBaseName = (filename: string) => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(0, lastDot) : filename;
};

// Use optimized WebP versions for better performance
export const getImageUrl = (filename: string) => `/optimized/${getBaseName(filename)}.webp`;
export const getThumbnailUrl = (filename: string) => `/thumbnails/thumb_${getBaseName(filename)}.webp`;

// Keep original URLs available if needed
export const getOriginalImageUrl = (filename: string) => `/uploads/${filename}`;
