import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Sparkles, Trash2, X, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { imagesApi, getImageUrl, getThumbnailUrl } from '../api/client';
import type { Image, Theme } from '../types';

interface ImageGalleryProps {
  themeId?: string;
  themes: Theme[];
  searchQuery?: string;
  onImageUpdate?: () => void;
}

export function ImageGallery({ themeId, themes, searchQuery, onImageUpdate }: ImageGalleryProps) {
  const [images, setImages] = useState<Image[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 50;

  const loadImages = useCallback(async (reset = false) => {
    if (loading) return;

    setLoading(true);
    try {
      const offset = reset ? 0 : images.length;
      const result = await imagesApi.getAll({
        theme_id: themeId,
        limit: PAGE_SIZE,
        offset,
        search: searchQuery
      });

      if (reset) {
        setImages(result.images);
      } else {
        setImages(prev => [...prev, ...result.images]);
      }
      setTotal(result.total);
      setHasMore(offset + result.images.length < result.total);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [themeId, searchQuery, images.length, loading]);

  // Initial load and filter changes
  useEffect(() => {
    loadImages(true);
  }, [themeId, searchQuery]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadImages();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, loadImages]);

  const handleEnrich = async (image: Image) => {
    setEnriching(image.id);
    try {
      const enriched = await imagesApi.enrich(image.id);
      setImages(prev => prev.map(img => img.id === enriched.id ? enriched : img));
      if (selectedImage?.id === enriched.id) {
        setSelectedImage(enriched);
      }
      onImageUpdate?.();
    } catch (error) {
      console.error('Failed to enrich image:', error);
    } finally {
      setEnriching(null);
    }
  };

  const handleDelete = async (image: Image) => {
    if (!confirm('Supprimer cette image ?')) return;

    try {
      await imagesApi.delete(image.id);
      setImages(prev => prev.filter(img => img.id !== image.id));
      setTotal(prev => prev - 1);
      if (selectedImage?.id === image.id) {
        setSelectedImage(null);
      }
      onImageUpdate?.();
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  const handleUpdateTheme = async (image: Image, newThemeId: string | null) => {
    try {
      const updated = await imagesApi.update(image.id, { theme_id: newThemeId });
      setImages(prev => prev.map(img => img.id === updated.id ? updated : img));
      if (selectedImage?.id === updated.id) {
        setSelectedImage(updated);
      }
      onImageUpdate?.();
    } catch (error) {
      console.error('Failed to update image:', error);
    }
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < images.length) {
      setSelectedImage(images[newIndex]);
    }
  };

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return tags.split(',').map(t => t.trim());
    }
  };

  if (images.length === 0 && !loading) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p className="text-lg">Aucune image trouvée</p>
        <p className="text-sm mt-2">Téléversez des images pour commencer</p>
      </div>
    );
  }

  return (
    <>
      {/* Stats */}
      <div className="mb-4 text-sm text-gray-400">
        {total} image{total > 1 ? 's' : ''} {themeId ? 'dans ce thème' : 'au total'}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {images.map(image => (
          <div
            key={image.id}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-800"
            onClick={() => setSelectedImage(image)}
          >
            <img
              src={getThumbnailUrl(image.filename)}
              alt={image.title || image.original_name}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* AI badge */}
            {image.ai_enriched && (
              <div className="absolute top-2 left-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
            )}

            {/* Title on hover */}
            <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <p className="text-sm font-medium truncate">{image.title || image.original_name}</p>
              {image.mood && (
                <p className="text-xs text-gray-300">{image.mood}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center mt-4">
        {loading && <Loader2 className="w-6 h-6 animate-spin text-gray-400" />}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex"
          onClick={() => setSelectedImage(null)}
        >
          {/* Navigation */}
          <button
            onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10"
            disabled={images.findIndex(i => i.id === selectedImage.id) === 0}
          >
            <ChevronLeft className="w-8 h-8" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10 md:right-[340px]"
            disabled={images.findIndex(i => i.id === selectedImage.id) === images.length - 1}
          >
            <ChevronRight className="w-8 h-8" />
          </button>

          {/* Close button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-10 md:right-[340px]"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image */}
          <div
            className="flex-1 flex items-center justify-center p-4 md:pr-[320px]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getImageUrl(selectedImage.filename)}
              alt={selectedImage.title || selectedImage.original_name}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Sidebar */}
          <div
            className="hidden md:block w-[320px] bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold mb-4">
              {selectedImage.title || selectedImage.original_name}
            </h2>

            {selectedImage.description && (
              <p className="text-gray-300 mb-4">{selectedImage.description}</p>
            )}

            {selectedImage.mood && (
              <div className="mb-4">
                <span className="text-sm text-gray-400">Ambiance:</span>
                <span className="ml-2 px-2 py-1 bg-gray-800 rounded text-sm">{selectedImage.mood}</span>
              </div>
            )}

            {/* Tags */}
            {parseTags(selectedImage.tags).length > 0 && (
              <div className="mb-4">
                <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
                  <Tag className="w-4 h-4" />
                  Tags
                </div>
                <div className="flex flex-wrap gap-2">
                  {parseTags(selectedImage.tags).map((tag, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-800 rounded-full text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Theme selector */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Thème</label>
              <select
                value={selectedImage.theme_id || ''}
                onChange={(e) => handleUpdateTheme(selectedImage, e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
              >
                <option value="">Sans thème</option>
                {themes.map(theme => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
            </div>

            {/* Info */}
            <div className="text-sm text-gray-400 space-y-1 mb-6">
              <p>{selectedImage.width} × {selectedImage.height}px</p>
              <p>{(selectedImage.size / 1024 / 1024).toFixed(2)} MB</p>
              <p>{new Date(selectedImage.created_at).toLocaleDateString('fr-FR')}</p>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              {!selectedImage.ai_enriched && (
                <button
                  onClick={() => handleEnrich(selectedImage)}
                  disabled={enriching === selectedImage.id}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 py-2 px-4 rounded-lg transition-colors"
                >
                  {enriching === selectedImage.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Enrichir avec Gemini
                </button>
              )}

              <button
                onClick={() => handleDelete(selectedImage)}
                className="w-full flex items-center justify-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-2 px-4 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
