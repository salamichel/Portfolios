import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Sparkles, Trash2, X, ChevronLeft, ChevronRight, Tag, Pencil, Save, XCircle } from 'lucide-react';
import { imagesApi, getMediumImageUrl, getThumbnailUrl } from '../api/client';
import type { Image, Theme } from '../types';

interface EditFormData {
  title: string;
  description: string;
  mood: string;
  tags: string;
}

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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({ title: '', description: '', mood: '', tags: '' });
  const [saving, setSaving] = useState(false);
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

  const startEditing = (image: Image) => {
    const tags = parseTags(image.tags);
    setEditForm({
      title: image.title || '',
      description: image.description || '',
      mood: image.mood || '',
      tags: tags.join(', ')
    });
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditForm({ title: '', description: '', mood: '', tags: '' });
  };

  const handleSaveMetadata = async () => {
    if (!selectedImage) return;

    setSaving(true);
    try {
      // Parse tags from comma-separated string
      const tagsArray = editForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Note: filename is NEVER modified - it's the storage reference
      const updated = await imagesApi.update(selectedImage.id, {
        title: editForm.title || null,
        description: editForm.description || null,
        mood: editForm.mood || null,
        tags: JSON.stringify(tagsArray)
      });

      setImages(prev => prev.map(img => img.id === updated.id ? updated : img));
      setSelectedImage(updated);
      setIsEditing(false);
      onImageUpdate?.();
    } catch (error) {
      console.error('Failed to save metadata:', error);
    } finally {
      setSaving(false);
    }
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    if (!selectedImage) return;
    const currentIndex = images.findIndex(img => img.id === selectedImage.id);
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex >= 0 && newIndex < images.length) {
      // Cancel editing when navigating to another image
      if (isEditing) {
        cancelEditing();
      }
      setSelectedImage(images[newIndex]);
    }
  };

  const closeLightbox = () => {
    if (isEditing) {
      cancelEditing();
    }
    setSelectedImage(null);
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
          onClick={closeLightbox}
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
            onClick={closeLightbox}
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
              src={getMediumImageUrl(selectedImage.filename)}
              alt={selectedImage.title || selectedImage.original_name}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Sidebar */}
          <div
            className="hidden md:block w-[320px] bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filename - Read-only storage reference */}
            <div className="mb-3 pb-3 border-b border-gray-800">
              <span className="text-xs text-gray-500">Fichier (référence):</span>
              <p className="text-xs text-gray-400 truncate" title={selectedImage.original_name}>
                {selectedImage.original_name}
              </p>
            </div>

            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Titre</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    placeholder="Titre de l'image"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white resize-none"
                    rows={3}
                    placeholder="Description de l'image"
                  />
                </div>

                {/* Mood */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Ambiance</label>
                  <input
                    type="text"
                    value={editForm.mood}
                    onChange={(e) => setEditForm(prev => ({ ...prev, mood: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    placeholder="Ex: Serein, Dramatique, Joyeux..."
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Tags (séparés par virgule)</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white"
                    placeholder="nature, paysage, été..."
                  />
                </div>

                {/* Save/Cancel buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveMetadata}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-2 px-4 rounded-lg transition-colors"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Sauvegarder
                  </button>
                  <button
                    onClick={cancelEditing}
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 py-2 px-4 rounded-lg transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-semibold flex-1">
                    {selectedImage.title || selectedImage.original_name}
                  </h2>
                  <button
                    onClick={() => startEditing(selectedImage)}
                    className="ml-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
                    title="Modifier les métadonnées"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>

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
              </>
            )}

            {/* Theme selector - always visible */}
            <div className="mb-4 mt-4 pt-4 border-t border-gray-800">
              <label className="block text-sm text-gray-400 mb-2">Thème</label>
              <select
                value={selectedImage.theme_id || ''}
                onChange={(e) => handleUpdateTheme(selectedImage, e.target.value || null)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2"
                disabled={isEditing}
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

            {/* Actions - hidden when editing */}
            {!isEditing && (
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
            )}
          </div>
        </div>
      )}
    </>
  );
}
