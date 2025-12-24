import { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { imagesApi } from '../../api/client';
import type { TagWithCount, MoodWithCount } from '../../types';

interface TagMoodSelectorProps {
  selectedTags: string[];
  selectedMoods: string[];
  onTagsChange: (tags: string[]) => void;
  onMoodsChange: (moods: string[]) => void;
}

export default function TagMoodSelector({
  selectedTags,
  selectedMoods,
  onTagsChange,
  onMoodsChange
}: TagMoodSelectorProps) {
  const [availableTags, setAvailableTags] = useState<TagWithCount[]>([]);
  const [availableMoods, setAvailableMoods] = useState<MoodWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [moodsOpen, setMoodsOpen] = useState(false);

  const tagsRef = useRef<HTMLDivElement>(null);
  const moodsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [tags, moods] = await Promise.all([
          imagesApi.getTags(),
          imagesApi.getMoods()
        ]);
        setAvailableTags(tags);
        setAvailableMoods(moods);
      } catch (error) {
        console.error('Failed to fetch metadata:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagsRef.current && !tagsRef.current.contains(event.target as Node)) {
        setTagsOpen(false);
      }
      if (moodsRef.current && !moodsRef.current.contains(event.target as Node)) {
        setMoodsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const toggleMood = (mood: string) => {
    if (selectedMoods.includes(mood)) {
      onMoodsChange(selectedMoods.filter(m => m !== mood));
    } else {
      onMoodsChange([...selectedMoods, mood]);
    }
  };

  const removeTag = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  const removeMood = (mood: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onMoodsChange(selectedMoods.filter(m => m !== mood));
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500">
        Chargement des tags et humeurs...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Tags Section */}
      <div ref={tagsRef} className="relative">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Tags (optionnel)
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Sélectionnez parmi les tags de vos photos pour pré-filtrer ce livre
        </p>

        {/* Custom Select */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setTagsOpen(!tagsOpen)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-left text-white focus:outline-none focus:border-blue-500 flex items-center justify-between gap-2"
          >
            <div className="flex-1 flex flex-wrap gap-1.5 min-h-[24px]">
              {selectedTags.length === 0 ? (
                <span className="text-gray-400">Sélectionnez des tags...</span>
              ) : (
                selectedTags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500 text-white text-sm rounded"
                  >
                    {tag}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-blue-200"
                      onClick={(e) => removeTag(tag, e)}
                    />
                  </span>
                ))
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${tagsOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {tagsOpen && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {availableTags.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">
                  Aucun tag dans vos photos
                </div>
              ) : (
                availableTags.map(({ tag, count }) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm text-white">{tag}</span>
                      </div>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                        {count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Moods Section */}
      <div ref={moodsRef} className="relative">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Humeur (optionnel)
        </label>
        <p className="text-xs text-gray-400 mb-2">
          Sélectionnez parmi les humeurs de vos photos pour pré-filtrer ce livre
        </p>

        {/* Custom Select */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoodsOpen(!moodsOpen)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-left text-white focus:outline-none focus:border-purple-500 flex items-center justify-between gap-2"
          >
            <div className="flex-1 flex flex-wrap gap-1.5 min-h-[24px]">
              {selectedMoods.length === 0 ? (
                <span className="text-gray-400">Sélectionnez des humeurs...</span>
              ) : (
                selectedMoods.map(mood => (
                  <span
                    key={mood}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500 text-white text-sm rounded"
                  >
                    {mood}
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-purple-200"
                      onClick={(e) => removeMood(mood, e)}
                    />
                  </span>
                ))
              )}
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${moodsOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {moodsOpen && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {availableMoods.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">
                  Aucune humeur dans vos photos
                </div>
              ) : (
                availableMoods.map(({ mood, count }) => {
                  const isSelected = selectedMoods.includes(mood);
                  return (
                    <button
                      key={mood}
                      type="button"
                      onClick={() => toggleMood(mood)}
                      className="w-full px-3 py-2 text-left hover:bg-gray-700 flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                          isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-600'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm text-white">{mood}</span>
                      </div>
                      <span className="text-xs px-1.5 py-0.5 bg-gray-700 text-gray-300 rounded">
                        {count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
