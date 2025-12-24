import { useState, useEffect, useCallback } from 'react';
import { X, Search, Check, Wand2, Loader2, Sparkles } from 'lucide-react';
import { imagesApi, getThumbnailUrl } from '../../api/client';
import type { Theme, Image } from '../../types';

interface ImageSelectorProps {
  themes: Theme[];
  onSelect?: (imageId: string) => void;
  onGenerateSuggestions?: (imageIds: string[]) => void;
  onClose: () => void;
  mode: 'single' | 'multiple';
  bookTags?: string[] | null;
  bookMoods?: string[] | null;
}

export function ImageSelector({ themes, onSelect, onGenerateSuggestions, onClose, mode, bookTags, bookMoods }: ImageSelectorProps) {
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Filter images by book tags/moods
  const filterImagesByBookCriteria = (image: Image): boolean => {
    // If no filters are set, show all images
    if ((!bookTags || bookTags.length === 0) && (!bookMoods || bookMoods.length === 0)) {
      return true;
    }

    let matchesTags = true;
    let matchesMoods = true;

    // Check tags
    if (bookTags && bookTags.length > 0) {
      if (!image.tags) {
        matchesTags = false;
      } else {
        try {
          const imageTags = JSON.parse(image.tags) as string[];
          matchesTags = bookTags.some(tag => imageTags.includes(tag));
        } catch {
          matchesTags = false;
        }
      }
    }

    // Check moods
    if (bookMoods && bookMoods.length > 0) {
      if (!image.mood) {
        matchesMoods = false;
      } else {
        matchesMoods = bookMoods.includes(image.mood);
      }
    }

    // Return true if image matches either tags OR moods (if both are specified)
    // If only one filter is specified, only check that one
    if (bookTags && bookTags.length > 0 && bookMoods && bookMoods.length > 0) {
      return matchesTags || matchesMoods;
    } else if (bookTags && bookTags.length > 0) {
      return matchesTags;
    } else if (bookMoods && bookMoods.length > 0) {
      return matchesMoods;
    }

    return true;
  };

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      const result = await imagesApi.getAll({
        theme_id: selectedThemeId || undefined,
        search: searchQuery || undefined,
        limit,
        offset
      });

      // Apply book tags/moods filter
      const filteredImages = result.images.filter(filterImagesByBookCriteria);

      if (offset === 0) {
        setImages(filteredImages);
      } else {
        setImages(prev => [...prev, ...filteredImages]);
      }
      setTotal(result.total);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedThemeId, searchQuery, offset, bookTags, bookMoods]);

  useEffect(() => {
    setOffset(0);
  }, [selectedThemeId, searchQuery]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleImageClick = (image: Image) => {
    if (mode === 'single' && onSelect) {
      onSelect(image.id);
    } else {
      setSelectedImages(prev => {
        const newSet = new Set(prev);
        if (newSet.has(image.id)) {
          newSet.delete(image.id);
        } else {
          newSet.add(image.id);
        }
        return newSet;
      });
    }
  };

  const handleConfirmSelection = () => {
    if (onGenerateSuggestions && selectedImages.size > 0) {
      setGenerating(true);
      onGenerateSuggestions(Array.from(selectedImages));
    }
  };

  const handleLoadMore = () => {
    if (images.length < total) {
      setOffset(prev => prev + limit);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-900 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-gray-800 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">
                {mode === 'single' ? 'Choisir une image' : 'Sélectionner des images pour l\'assistant IA'}
              </h2>
              {((bookTags && bookTags.length > 0) || (bookMoods && bookMoods.length > 0)) && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {bookTags && bookTags.length > 0 && (
                    <div className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">
                      Filtré par tags: {bookTags.join(', ')}
                    </div>
                  )}
                  {bookMoods && bookMoods.length > 0 && (
                    <div className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
                      Filtré par humeur: {bookMoods.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {/* Theme filter */}
            <select
              value={selectedThemeId || ''}
              onChange={(e) => setSelectedThemeId(e.target.value || null)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-rose-500"
            >
              <option value="">Tous les thèmes</option>
              {themes
                .filter(theme => (theme.image_count || 0) > 0)
                .map(theme => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name} ({theme.image_count})
                  </option>
                ))}
            </select>
          </div>

          {mode === 'multiple' && selectedImages.size > 0 && (
            <div className="mt-4 flex items-center justify-between bg-rose-500/10 rounded-lg px-4 py-2">
              <span className="text-rose-400">
                {selectedImages.size} image{selectedImages.size > 1 ? 's' : ''} sélectionnée{selectedImages.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={handleConfirmSelection}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Générer la mise en page
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && images.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-400">
              Aucune image trouvée
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {images.map(image => {
                  const isSelected = selectedImages.has(image.id);
                  return (
                    <button
                      key={image.id}
                      onClick={() => handleImageClick(image)}
                      className={`
                        relative aspect-square rounded-lg overflow-hidden group
                        ring-2 transition-all
                        ${isSelected ? 'ring-rose-500 ring-offset-2 ring-offset-gray-900' : 'ring-transparent hover:ring-gray-600'}
                      `}
                    >
                      <img
                        src={getThumbnailUrl(image.filename)}
                        alt={image.title || image.original_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {/* AI enriched indicator */}
                      {image.ai_enriched && (
                        <div className="absolute top-2 left-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center" title="Enrichie par l'IA">
                          <Sparkles className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Selection indicator */}
                      {mode === 'multiple' && isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div className="p-2 w-full">
                          <p className="text-white text-xs truncate">
                            {image.title || image.original_name}
                          </p>
                          {image.mood && (
                            <p className="text-gray-300 text-xs truncate">{image.mood}</p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Load more */}
              {images.length < total && (
                <div className="text-center mt-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={loading}
                    className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg disabled:opacity-50"
                  >
                    {loading ? 'Chargement...' : `Charger plus (${images.length}/${total})`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
