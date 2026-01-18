import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, Sparkles, Trash2, X, ChevronLeft, ChevronRight, Tag, Pencil, Save, XCircle, Info, Smile, BookOpen, Check, Users, ArrowUpDown, ArrowUp, ArrowDown, FolderOpen } from 'lucide-react';
import { imagesApi, getMediumImageUrl, getThumbnailUrl, api } from '../api/client';
import type { Image, Theme, TagWithCount, MoodWithCount, ImagePerson, FamilyMember } from '../types';
import { CreateBookFromPhotoModal } from './book/CreateBookFromPhotoModal';
import { CreateBookFromPhotosModal } from './book/CreateBookFromPhotosModal';

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
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'created_at' | 'original_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [availableTags, setAvailableTags] = useState<TagWithCount[]>([]);
  const [availableMoods, setAvailableMoods] = useState<MoodWithCount[]>([]);
  const [showCreateBookModal, setShowCreateBookModal] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [showCreateBookFromPhotosModal, setShowCreateBookFromPhotosModal] = useState(false);
  const [detectedPeople, setDetectedPeople] = useState<ImagePerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [selectedPersonToAdd, setSelectedPersonToAdd] = useState<string>('');
  const [addingPerson, setAddingPerson] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 50;

  const loadImages = useCallback(async (reset = false) => {
    if (loading) return;

    console.log(`[loadImages] Called with reset=${reset}, selectedPerson=${selectedPerson}`);
    setLoading(true);
    try {
      const offset = reset ? 0 : images.length;
      const result = await imagesApi.getAll({
        theme_id: selectedTheme || themeId || undefined,
        limit: PAGE_SIZE,
        offset,
        search: searchQuery,
        tag: selectedTag || undefined,
        mood: selectedMood || undefined,
        person: selectedPerson || undefined,
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      console.log(`[loadImages] Received ${result.images.length} images (total: ${result.total})`);

      if (reset) {
        setImages(result.images);
      } else {
        // When adding more images, merge to avoid duplicates
        const allImages = [...images, ...result.images];
        const uniqueImages = allImages.filter((img, index, self) =>
          index === self.findIndex(i => i.id === img.id)
        );
        setImages(uniqueImages);
      }
      setTotal(result.total);
      setHasMore(offset + result.images.length < result.total);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [themeId, searchQuery, selectedTag, selectedMood, selectedPerson, selectedTheme, sortBy, sortOrder, images.length, loading]);

  // Load tags and moods with counts
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [tags, moods] = await Promise.all([
          imagesApi.getTags(),
          imagesApi.getMoods()
        ]);
        setAvailableTags(tags);
        setAvailableMoods(moods);
      } catch (error) {
        console.error('Failed to load metadata:', error);
      }
    };
    loadMetadata();
  }, []);

  // Load family members
  useEffect(() => {
    const loadFamilyMembers = async () => {
      try {
        const response = await api.get('/family/members');
        setFamilyMembers(response.data);
      } catch (error) {
        console.error('Failed to load family members:', error);
      }
    };
    loadFamilyMembers();
  }, []);

  // Initial load and filter changes
  useEffect(() => {
    loadImages(true);
  }, [themeId, searchQuery, selectedTag, selectedMood, selectedPerson, selectedTheme, sortBy, sortOrder]);

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

  // Keyboard shortcuts for lightbox navigation
  useEffect(() => {
    if (!selectedImage) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          navigateImage('prev');
          break;
        case 'ArrowRight':
          e.preventDefault();
          navigateImage('next');
          break;
        case 'Escape':
          e.preventDefault();
          closeLightbox();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, images, isEditing]);

  // Load detected people when image is selected
  useEffect(() => {
    if (!selectedImage) {
      setDetectedPeople([]);
      return;
    }

    const loadPeople = async () => {
      console.log(`[Frontend] Loading people for image: ${selectedImage.filename} (${selectedImage.id})`);
      setLoadingPeople(true);
      try {
        const url = `/family/images/${selectedImage.id}/people`;
        console.log(`[Frontend] Calling API: GET ${url}`);
        const response = await api.get(url);
        console.log(`[Frontend] Received ${response.data.length} people:`, response.data);
        setDetectedPeople(response.data);
      } catch (error) {
        console.error('[Frontend] Failed to load detected people:', error);
        setDetectedPeople([]);
      } finally {
        setLoadingPeople(false);
      }
    };

    loadPeople();
  }, [selectedImage]);

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

  const handleAddPerson = async () => {
    if (!selectedImage || !selectedPersonToAdd) return;

    setAddingPerson(true);
    try {
      const response = await api.post(`/family/images/${selectedImage.id}/people`, {
        family_member_id: selectedPersonToAdd
      });

      setDetectedPeople(prev => [...prev, response.data]);
      setSelectedPersonToAdd('');
    } catch (error: any) {
      console.error('Failed to add person:', error);
      if (error.response?.status === 409) {
        alert('Cette personne est déjà taguée sur cette image');
      } else {
        alert('Échec de l\'ajout de la personne');
      }
    } finally {
      setAddingPerson(false);
    }
  };

  const handleRemovePerson = async (personId: string) => {
    if (!confirm('Retirer cette personne de l\'image ?')) return;

    try {
      await api.delete(`/family/people/${personId}`);
      const remainingPeople = detectedPeople.filter(p => p.id !== personId);
      setDetectedPeople(remainingPeople);

      // If no more people detected, reset family_analyzed flag so it can be re-analyzed
      if (selectedImage && remainingPeople.length === 0) {
        await api.post(`/images/${selectedImage.id}/mark-family-analyzed`, {}, {
          params: { reset: true }
        });
      }
    } catch (error) {
      console.error('Failed to remove person:', error);
      alert('Échec de la suppression');
    }
  };

  const handleMarkNoPeople = async () => {
    if (!selectedImage) return;
    if (!confirm('Marquer cette image comme n\'ayant pas de personne ? Elle ne sera plus analysée.')) return;

    try {
      await api.post(`/images/${selectedImage.id}/mark-no-people`);
      if (selectedImage) {
        setSelectedImage({ ...selectedImage, no_people_marked: true });
      }
      setDetectedPeople([]);
      alert('Image marquée comme sans personne');
    } catch (error) {
      console.error('Failed to mark as no people:', error);
      alert('Échec du marquage');
    }
  };

  const handleUnmarkNoPeople = async () => {
    if (!selectedImage) return;
    if (!confirm('Retirer le marquage "sans personne" ? L\'image sera ré-analysée lors de la prochaine reconnaissance.')) return;

    try {
      await api.post(`/images/${selectedImage.id}/unmark-no-people`);
      if (selectedImage) {
        setSelectedImage({ ...selectedImage, no_people_marked: false });
      }
      alert('Marquage retiré');
    } catch (error) {
      console.error('Failed to unmark as no people:', error);
      alert('Échec du retrait du marquage');
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
      // Parse tags from comma-separated string and remove duplicates
      const tagsArray = editForm.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Remove duplicates while preserving order
      const uniqueTags = Array.from(new Set(tagsArray));

      // Note: filename is NEVER modified - it's the storage reference
      const updated = await imagesApi.update(selectedImage.id, {
        title: editForm.title || null,
        description: editForm.description || null,
        mood: editForm.mood || null,
        tags: JSON.stringify(uniqueTags)
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
      setShowMobileDetails(false);
      setSelectedImage(images[newIndex]);
    }
  };

  const closeLightbox = () => {
    if (isEditing) {
      cancelEditing();
    }
    setShowMobileDetails(false);
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

  const getTagCount = (tag: string): number => {
    // Case-insensitive search for better matching
    const tagData = availableTags.find(t => t.tag.toLowerCase() === tag.toLowerCase());
    return tagData?.count || 0;
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(tag);
    closeLightbox();
  };

  const handlePersonClick = (personId: string) => {
    setSelectedPerson(personId);
    closeLightbox();
  };

  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedImages(new Set(images.map(img => img.id)));
  };

  const deselectAll = () => {
    setSelectedImages(new Set());
  };

  const handleCreateBookFromSelectedPhotos = () => {
    if (selectedImages.size === 0) return;
    setShowCreateBookFromPhotosModal(true);
  };

  const getSelectedImageObjects = () => {
    return images.filter(img => selectedImages.has(img.id));
  };

  return (
    <>
      {/* Stats and selection controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {total} image{total > 1 ? 's' : ''} {themeId ? 'dans ce thème' : 'au total'}
          {selectedImages.size > 0 && (
            <span className="ml-2 text-indigo-400">
              • {selectedImages.size} sélectionnée{selectedImages.size > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {selectedImages.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={deselectAll}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Tout désélectionner
            </button>
            <button
              onClick={selectAll}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Tout sélectionner
            </button>
          </div>
        )}
      </div>

      {/* Advanced filters - always visible */}
      <div className="mb-4 p-4 bg-gray-800 rounded-lg space-y-3">
        <div className="flex flex-wrap gap-3">
          {/* Theme filter */}
          {!themeId && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-gray-400 mb-1">Thème</label>
              <div className="relative">
                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedTheme || ''}
                  onChange={(e) => setSelectedTheme(e.target.value || null)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-rose-500 appearance-none cursor-pointer"
                >
                  <option value="">Tous les thèmes</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>{theme.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Tag filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Tag</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedTag || ''}
                onChange={(e) => setSelectedTag(e.target.value || null)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-rose-500 appearance-none cursor-pointer"
              >
                <option value="">Tous les tags</option>
                {availableTags.map(({ tag, count }) => (
                  <option key={tag} value={tag}>{tag} ({count})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Mood filter */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Ambiance</label>
            <div className="relative">
              <Smile className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={selectedMood || ''}
                onChange={(e) => setSelectedMood(e.target.value || null)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-rose-500 appearance-none cursor-pointer"
              >
                <option value="">Toutes les ambiances</option>
                {availableMoods.map(({ mood, count }) => (
                  <option key={mood} value={mood}>{mood} ({count})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Person filter */}
          {familyMembers.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-gray-400 mb-1">Personne</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <select
                  value={selectedPerson || ''}
                  onChange={(e) => setSelectedPerson(e.target.value || null)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-rose-500 appearance-none cursor-pointer"
                >
                  <option value="">Toutes les personnes</option>
                  <option value="none">Sans personne identifiée</option>
                  {familyMembers.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Sorting controls */}
        <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-700">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Trier par</label>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'created_at' | 'original_name')}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-rose-500 appearance-none cursor-pointer"
              >
                <option value="created_at">Date d'ajout</option>
                <option value="original_name">Nom de fichier</option>
              </select>
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm text-gray-400 mb-1">Ordre</label>
            <div className="relative">
              {sortOrder === 'asc' ? (
                <ArrowUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              ) : (
                <ArrowDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              )}
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-rose-500 appearance-none cursor-pointer"
              >
                <option value="asc">Croissant (A→Z, ancien→récent)</option>
                <option value="desc">Décroissant (Z→A, récent→ancien)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Active filters */}
        {(selectedTheme || selectedTag || selectedMood || selectedPerson) && (
          <div className="flex flex-wrap gap-2 items-center pt-2 border-t border-gray-700">
            <span className="text-sm text-gray-400">Actifs:</span>
            {selectedTheme && (
              <button
                onClick={() => setSelectedTheme(null)}
                className="flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30"
              >
                <FolderOpen className="w-3 h-3" />
                {themes.find(t => t.id === selectedTheme)?.name || 'Thème'}
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(null)}
                className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30"
              >
                <Tag className="w-3 h-3" />
                {selectedTag}
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedMood && (
              <button
                onClick={() => setSelectedMood(null)}
                className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm hover:bg-purple-500/30"
              >
                <Smile className="w-3 h-3" />
                {selectedMood}
                <X className="w-3 h-3" />
              </button>
            )}
            {selectedPerson && (
              <button
                onClick={() => setSelectedPerson(null)}
                className="flex items-center gap-1 px-2 py-1 bg-pink-500/20 text-pink-400 rounded text-sm hover:bg-pink-500/30"
              >
                <Users className="w-3 h-3" />
                {selectedPerson === 'none'
                  ? 'Sans personne'
                  : familyMembers.find(m => m.id === selectedPerson)?.name || 'Personne'}
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty state or Grid */}
      {images.length === 0 && !loading ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg">Aucune image trouvée</p>
          <p className="text-sm mt-2">
            {selectedTag || selectedMood || selectedPerson || searchQuery
              ? 'Essayez de modifier les filtres de recherche'
              : 'Téléversez des images pour commencer'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {images.map(image => {
          const isSelected = selectedImages.has(image.id);
          return (
            <div
              key={image.id}
              className="group relative aspect-square overflow-hidden rounded-lg bg-gray-800"
            >
              <img
                src={getThumbnailUrl(image.filename)}
                alt={image.title || image.original_name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer"
                loading="lazy"
                onClick={() => setSelectedImage(image)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

              {/* Selection checkbox */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleImageSelection(image.id);
                }}
                className={`absolute top-2 right-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600'
                    : 'bg-black/30 border-white/50 hover:border-white'
                }`}
              >
                {isSelected && <Check className="w-4 h-4 text-white" />}
              </button>

              {/* AI badge */}
              {image.ai_enriched && (
                <div className="absolute top-2 left-2 pointer-events-none">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </div>
              )}

              {/* Title and people badges on hover */}
              <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {/* People badges */}
                {image.people && image.people.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {image.people.slice(0, 3).map((person) => (
                      <span
                        key={person.id}
                        className="px-1.5 py-0.5 bg-purple-600/90 text-white text-xs rounded-full font-medium"
                        title={`${person.member?.name || 'Inconnu'} (${Math.round((person.confidence || 0) * 100)}%)`}
                      >
                        {person.member?.name || '?'}
                      </span>
                    ))}
                    {image.people.length > 3 && (
                      <span className="px-1.5 py-0.5 bg-purple-600/90 text-white text-xs rounded-full font-medium">
                        +{image.people.length - 3}
                      </span>
                    )}
                  </div>
                )}
                {/* Title */}
                <p className="text-sm font-medium truncate">{image.title || image.original_name}</p>
                {image.mood && (
                  <p className="text-xs text-gray-300">{image.mood}</p>
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-10 flex items-center justify-center mt-4">
        {loading && <Loader2 className="w-6 h-6 animate-spin text-gray-400" />}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col md:flex-row"
          onClick={closeLightbox}
        >
          {/* Navigation - Previous */}
          <button
            onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
            disabled={images.findIndex(i => i.id === selectedImage.id) === 0}
          >
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
          </button>

          {/* Navigation - Next */}
          <button
            onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}
            className="absolute right-2 md:right-[340px] top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
            disabled={images.findIndex(i => i.id === selectedImage.id) === images.length - 1}
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
          </button>

          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 md:right-[340px] p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors z-20"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image container - centered properly */}
          <div
            className="flex-1 flex items-center justify-center p-4 pb-20 md:pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={getMediumImageUrl(selectedImage.filename)}
              alt={selectedImage.title || selectedImage.original_name}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Mobile bottom action bar */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3 flex items-center justify-around z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowMobileDetails(true)}
              className="flex flex-col items-center gap-1 text-gray-300 hover:text-white"
            >
              <Info className="w-5 h-5" />
              <span className="text-xs">Détails</span>
            </button>

            <button
              onClick={() => startEditing(selectedImage)}
              className="flex flex-col items-center gap-1 text-gray-300 hover:text-white"
            >
              <Pencil className="w-5 h-5" />
              <span className="text-xs">Modifier</span>
            </button>

            {!selectedImage.ai_enriched && (
              <button
                onClick={() => handleEnrich(selectedImage)}
                disabled={enriching === selectedImage.id}
                className="flex flex-col items-center gap-1 text-amber-400 hover:text-amber-300"
              >
                {enriching === selectedImage.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                <span className="text-xs">Enrichir</span>
              </button>
            )}

            <button
              onClick={() => setShowCreateBookModal(true)}
              className="flex flex-col items-center gap-1 text-indigo-400 hover:text-indigo-300"
            >
              <BookOpen className="w-5 h-5" />
              <span className="text-xs">Book</span>
            </button>

            <button
              onClick={() => handleDelete(selectedImage)}
              className="flex flex-col items-center gap-1 text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-xs">Supprimer</span>
            </button>
          </div>

          {/* Mobile details panel (slide-up) */}
          {showMobileDetails && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={() => setShowMobileDetails(false)}
            >
              <div
                className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Détails</h3>
                  <button
                    onClick={() => setShowMobileDetails(false)}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Filename */}
                <div className="mb-4 pb-4 border-b-2 border-gray-700 bg-gray-800/50 rounded-lg p-3">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fichier (référence)</span>
                  <p className="text-sm text-gray-200 mt-1 break-words leading-relaxed">{selectedImage.original_name}</p>
                </div>

                {/* Title */}
                <h4 className="text-lg font-medium mb-2">
                  {selectedImage.title || selectedImage.original_name}
                </h4>

                {/* Description */}
                {selectedImage.description && (
                  <p className="text-gray-300 mb-4">{selectedImage.description}</p>
                )}

                {/* Mood */}
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
                      {parseTags(selectedImage.tags).map((tag, i) => {
                        const count = getTagCount(tag);
                        return (
                          <button
                            key={i}
                            onClick={() => handleTagClick(tag)}
                            className="group relative px-3 py-1.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/40 hover:to-indigo-500/40 border border-blue-500/30 hover:border-blue-400/50 rounded-full text-sm transition-all cursor-pointer shadow-sm hover:shadow-md"
                          >
                            <span className="text-blue-200 group-hover:text-blue-100 font-medium">{tag}</span>
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-600/60 text-blue-100 text-xs rounded-full font-semibold">
                              {count || 1}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detected People */}
                {(loadingPeople || detectedPeople.length > 0 || familyMembers.length > 0) && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
                      <Users className="w-4 h-4" />
                      Personnes
                    </div>
                    {loadingPeople ? (
                      <div className="text-sm text-gray-500">Chargement...</div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {detectedPeople.map((person) => (
                            <div
                              key={person.id}
                              className="group relative px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/40 hover:to-pink-500/40 border border-purple-500/30 hover:border-purple-400/50 rounded-full text-sm flex items-center gap-2 cursor-pointer transition-all"
                              onClick={() => person.family_member_id && handlePersonClick(person.family_member_id)}
                            >
                              <span className="text-purple-200 font-medium">
                                {person.member?.name || 'Inconnu'}
                              </span>
                              {person.confidence !== null && person.confidence > 0 && person.confidence < 1 && (
                                <span className="px-1.5 py-0.5 bg-purple-600/60 text-purple-100 text-xs rounded-full font-semibold">
                                  {Math.round(person.confidence * 100)}%
                                </span>
                              )}
                              {person.verified && (
                                <span className="text-green-400">✓</span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePerson(person.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                title="Retirer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add person dropdown */}
                        {familyMembers.length > 0 && (
                          <div className="flex gap-2 mb-2">
                            <select
                              value={selectedPersonToAdd}
                              onChange={(e) => setSelectedPersonToAdd(e.target.value)}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                              disabled={addingPerson}
                            >
                              <option value="">+ Ajouter une personne</option>
                              {familyMembers
                                .filter(member => !detectedPeople.some(p => p.family_member_id === member.id))
                                .map(member => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={handleAddPerson}
                              disabled={!selectedPersonToAdd || addingPerson}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm transition-colors"
                            >
                              {addingPerson ? '...' : 'OK'}
                            </button>
                          </div>
                        )}

                        {/* Mark as no people button */}
                        {familyMembers.length > 0 && (
                          <div className="flex gap-2">
                            {!selectedImage?.no_people_marked ? (
                              <button
                                onClick={handleMarkNoPeople}
                                className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors text-gray-200"
                                title="Marquer cette image comme n'ayant aucune personne"
                              >
                                ✗ Pas de personne
                              </button>
                            ) : (
                              <button
                                onClick={handleUnmarkNoPeople}
                                className="flex-1 px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-sm transition-colors text-amber-100"
                                title="Retirer le marquage pour ré-analyser"
                              >
                                ↻ Ré-analyser
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
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
                <div className="text-sm text-gray-400 space-y-1">
                  <p>{selectedImage.width} × {selectedImage.height}px</p>
                  <p>{(selectedImage.size / 1024 / 1024).toFixed(2)} MB</p>
                  <p>{new Date(selectedImage.created_at).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
            </div>
          )}

          {/* Mobile edit panel (slide-up) */}
          {isEditing && (
            <div
              className="md:hidden fixed inset-0 bg-black/50 z-40"
              onClick={cancelEditing}
            >
              <div
                className="absolute bottom-0 left-0 right-0 bg-gray-900 rounded-t-2xl p-6 max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Modifier les métadonnées</h3>
                  <button
                    onClick={cancelEditing}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
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

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveMetadata}
                      disabled={saving}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-3 px-4 rounded-lg transition-colors"
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
                      className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 px-4 rounded-lg transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                      Annuler
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sidebar */}
          <div
            className="hidden md:block w-[320px] bg-gray-900 border-l border-gray-800 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Filename - Read-only storage reference */}
            <div className="mb-4 pb-4 border-b-2 border-gray-700 bg-gray-800/50 rounded-lg p-3">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Fichier (référence)</span>
              <p className="text-sm text-gray-200 mt-1 break-words leading-relaxed">
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
                      {parseTags(selectedImage.tags).map((tag, i) => {
                        const count = getTagCount(tag);
                        return (
                          <button
                            key={i}
                            onClick={() => handleTagClick(tag)}
                            className="group relative px-3 py-1.5 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/40 hover:to-indigo-500/40 border border-blue-500/30 hover:border-blue-400/50 rounded-full text-sm transition-all cursor-pointer shadow-sm hover:shadow-md"
                          >
                            <span className="text-blue-200 group-hover:text-blue-100 font-medium">{tag}</span>
                            <span className="ml-2 px-1.5 py-0.5 bg-blue-600/60 text-blue-100 text-xs rounded-full font-semibold">
                              {count || 1}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Detected People */}
                {(loadingPeople || detectedPeople.length > 0 || familyMembers.length > 0) && (
                  <div className="mb-4">
                    <div className="flex items-center gap-1 text-sm text-gray-400 mb-2">
                      <Users className="w-4 h-4" />
                      Personnes
                    </div>
                    {loadingPeople ? (
                      <div className="text-sm text-gray-500">Chargement...</div>
                    ) : (
                      <>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {detectedPeople.map((person) => (
                            <div
                              key={person.id}
                              className="group relative px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/40 hover:to-pink-500/40 border border-purple-500/30 hover:border-purple-400/50 rounded-full text-sm flex items-center gap-2 cursor-pointer transition-all"
                              onClick={() => person.family_member_id && handlePersonClick(person.family_member_id)}
                            >
                              <span className="text-purple-200 font-medium">
                                {person.member?.name || 'Inconnu'}
                              </span>
                              {person.confidence !== null && person.confidence > 0 && person.confidence < 1 && (
                                <span className="px-1.5 py-0.5 bg-purple-600/60 text-purple-100 text-xs rounded-full font-semibold">
                                  {Math.round(person.confidence * 100)}%
                                </span>
                              )}
                              {person.verified && (
                                <span className="text-green-400">✓</span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePerson(person.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                                title="Retirer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Add person dropdown */}
                        {familyMembers.length > 0 && (
                          <div className="flex gap-2 mb-2">
                            <select
                              value={selectedPersonToAdd}
                              onChange={(e) => setSelectedPersonToAdd(e.target.value)}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
                              disabled={addingPerson}
                            >
                              <option value="">+ Ajouter une personne</option>
                              {familyMembers
                                .filter(member => !detectedPeople.some(p => p.family_member_id === member.id))
                                .map(member => (
                                  <option key={member.id} value={member.id}>
                                    {member.name}
                                  </option>
                                ))}
                            </select>
                            <button
                              onClick={handleAddPerson}
                              disabled={!selectedPersonToAdd || addingPerson}
                              className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-sm transition-colors"
                            >
                              {addingPerson ? '...' : 'OK'}
                            </button>
                          </div>
                        )}

                        {/* Mark as no people button */}
                        {familyMembers.length > 0 && (
                          <div className="flex gap-2">
                            {!selectedImage?.no_people_marked ? (
                              <button
                                onClick={handleMarkNoPeople}
                                className="flex-1 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors text-gray-200"
                                title="Marquer cette image comme n'ayant aucune personne"
                              >
                                ✗ Pas de personne
                              </button>
                            ) : (
                              <button
                                onClick={handleUnmarkNoPeople}
                                className="flex-1 px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-sm transition-colors text-amber-100"
                                title="Retirer le marquage pour ré-analyser"
                              >
                                ↻ Ré-analyser
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
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
                <button
                  onClick={() => setShowCreateBookModal(true)}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 py-2 px-4 rounded-lg transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Créer un book
                </button>

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

      {/* Floating action button for selected photos */}
      {selectedImages.size > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={handleCreateBookFromSelectedPhotos}
            className="flex items-center gap-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-6 py-4 rounded-full shadow-2xl transition-all transform hover:scale-105"
          >
            <BookOpen className="w-5 h-5" />
            <span className="font-medium">
              Créer un book ({selectedImages.size} photo{selectedImages.size > 1 ? 's' : ''})
            </span>
          </button>
        </div>
      )}

      {/* Create Book from Photo Modal */}
      {showCreateBookModal && selectedImage && (
        <CreateBookFromPhotoModal
          image={selectedImage}
          onClose={() => setShowCreateBookModal(false)}
        />
      )}

      {/* Create Book from Multiple Photos Modal */}
      {showCreateBookFromPhotosModal && (
        <CreateBookFromPhotosModal
          images={getSelectedImageObjects()}
          onClose={() => {
            setShowCreateBookFromPhotosModal(false);
            deselectAll();
          }}
        />
      )}
    </>
  );
}
