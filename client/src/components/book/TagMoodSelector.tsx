import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tags (optionnel)
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Sélectionnez des tags pour pré-filtrer les photos de votre livre
        </p>
        <div className="flex flex-wrap gap-2">
          {availableTags.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucun tag disponible</p>
          ) : (
            availableTags.map(({ tag, count }) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                    transition-colors duration-200
                    ${isSelected
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <span>{tag}</span>
                  <span className={`
                    text-xs px-1.5 py-0.5 rounded-full
                    ${isSelected ? 'bg-blue-400' : 'bg-gray-200'}
                  `}>
                    {count}
                  </span>
                  {isSelected && (
                    <X className="w-3 h-3" />
                  )}
                </button>
              );
            })
          )}
        </div>
        {selectedTags.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onTagsChange([])}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Tout désélectionner
            </button>
          </div>
        )}
      </div>

      {/* Moods Section */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Humeur (optionnel)
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Sélectionnez des humeurs pour pré-filtrer les photos de votre livre
        </p>
        <div className="flex flex-wrap gap-2">
          {availableMoods.length === 0 ? (
            <p className="text-sm text-gray-500 italic">Aucune humeur disponible</p>
          ) : (
            availableMoods.map(({ mood, count }) => {
              const isSelected = selectedMoods.includes(mood);
              return (
                <button
                  key={mood}
                  type="button"
                  onClick={() => toggleMood(mood)}
                  className={`
                    inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm
                    transition-colors duration-200
                    ${isSelected
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <span>{mood}</span>
                  <span className={`
                    text-xs px-1.5 py-0.5 rounded-full
                    ${isSelected ? 'bg-purple-400' : 'bg-gray-200'}
                  `}>
                    {count}
                  </span>
                  {isSelected && (
                    <X className="w-3 h-3" />
                  )}
                </button>
              );
            })
          )}
        </div>
        {selectedMoods.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => onMoodsChange([])}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              Tout désélectionner
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
