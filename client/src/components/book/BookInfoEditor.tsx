import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Check } from 'lucide-react';
import { booksApi, getThumbnailUrl } from '../../api/client';
import type { Book, Image, BookPage, BookStatus } from '../../types';
import TagMoodSelector from './TagMoodSelector';
import { BookStatusEditor } from './BookStatusEditor';

interface BookInfoEditorProps {
  book: Book;
  pages: BookPage[];
  onSave: (updatedBook: Book) => void;
  onClose: () => void;
}

export function BookInfoEditor({ book, pages, onSave, onClose }: BookInfoEditorProps) {
  const [name, setName] = useState(book.name);
  const [description, setDescription] = useState(book.description || '');
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [selectedTags, setSelectedTags] = useState<string[]>(() => {
    if (book.tags) {
      try {
        return JSON.parse(book.tags);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [selectedMoods, setSelectedMoods] = useState<string[]>(() => {
    if (book.mood) {
      try {
        return JSON.parse(book.mood);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [coverImageId, setCoverImageId] = useState<string | null>(book.cover_image_id);
  const [saving, setSaving] = useState(false);

  // Images from book pages for cover selection
  const [bookImages, setBookImages] = useState<Image[]>([]);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  // Collect all images used in the book pages
  useEffect(() => {
    const images: Image[] = [];
    const seenIds = new Set<string>();

    pages.forEach(page => {
      if (page.images) {
        page.images.forEach(img => {
          if (!seenIds.has(img.id)) {
            seenIds.add(img.id);
            images.push(img);
          }
        });
      }
    });

    setBookImages(images);
  }, [pages]);

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      setSaving(true);
      const updatedBook = await booksApi.update(book.id, {
        name: name.trim(),
        description: description.trim() || null,
        tags: selectedTags.length > 0 ? JSON.stringify(selectedTags) : null,
        mood: selectedMoods.length > 0 ? JSON.stringify(selectedMoods) : null,
        cover_image_id: coverImageId,
        status
      });
      onSave(updatedBook);
      onClose();
    } catch (error) {
      console.error('Failed to update book:', error);
    } finally {
      setSaving(false);
    }
  };

  const selectedCoverImage = bookImages.find(img => img.id === coverImageId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-semibold">Modifier le book</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cover Image */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Image de couverture
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Sélectionnez une image parmi celles utilisées dans le book
            </p>

            {!showCoverPicker ? (
              <button
                type="button"
                onClick={() => setShowCoverPicker(true)}
                className="w-full aspect-video bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors relative group"
              >
                {coverImageId && selectedCoverImage ? (
                  <>
                    <img
                      src={getThumbnailUrl(selectedCoverImage.filename)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-sm font-medium">Changer</span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                    <ImageIcon className="w-8 h-8 mb-2" />
                    <span className="text-sm">Choisir une couverture</span>
                  </div>
                )}
              </button>
            ) : (
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-300">Sélectionnez une image</span>
                  <button
                    onClick={() => setShowCoverPicker(false)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Fermer
                  </button>
                </div>

                {bookImages.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Ajoutez des images aux pages du book pour en sélectionner une comme couverture
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {/* Option to remove cover */}
                    <button
                      onClick={() => {
                        setCoverImageId(null);
                        setShowCoverPicker(false);
                      }}
                      className={`aspect-square bg-gray-700 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-600 transition-colors ${
                        !coverImageId ? 'ring-2 ring-rose-500' : ''
                      }`}
                    >
                      <X className="w-5 h-5" />
                    </button>

                    {bookImages.map(img => (
                      <button
                        key={img.id}
                        onClick={() => {
                          setCoverImageId(img.id);
                          setShowCoverPicker(false);
                        }}
                        className={`aspect-square rounded-lg overflow-hidden relative group ${
                          coverImageId === img.id ? 'ring-2 ring-rose-500' : ''
                        }`}
                      >
                        <img
                          src={getThumbnailUrl(img.filename)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {coverImageId === img.id && (
                          <div className="absolute inset-0 bg-rose-500/30 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nom du book
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mon portfolio 2024"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Une brève description..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Tags & Moods */}
          <TagMoodSelector
            selectedTags={selectedTags}
            selectedMoods={selectedMoods}
            onTagsChange={setSelectedTags}
            onMoodsChange={setSelectedMoods}
          />

          {/* Status */}
          <BookStatusEditor
            status={status}
            onChange={setStatus}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            disabled={saving}
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
