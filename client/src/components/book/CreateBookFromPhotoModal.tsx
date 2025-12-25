import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, Loader2 } from 'lucide-react';
import { booksApi } from '../../api/client';
import type { Image } from '../../types';

interface CreateBookFromPhotoModalProps {
  image: Image;
  onClose: () => void;
}

export function CreateBookFromPhotoModal({ image, onClose }: CreateBookFromPhotoModalProps) {
  const navigate = useNavigate();
  const [bookName, setBookName] = useState(image.title || image.original_name.replace(/\.[^/.]+$/, ''));
  const [bookDescription, setBookDescription] = useState(image.description || '');
  const [creating, setCreating] = useState(false);

  // Parse tags from image
  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return tags.split(',').map(t => t.trim()).filter(t => t);
    }
  };

  const imageTags = parseTags(image.tags);
  const imageMood = image.mood;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim() || creating) return;

    setCreating(true);
    try {
      // Create the book with mood/tags from the photo
      const book = await booksApi.create({
        name: bookName.trim(),
        description: bookDescription.trim() || undefined,
        tags: imageTags.length > 0 ? JSON.stringify(imageTags) : undefined,
        mood: imageMood ? JSON.stringify([imageMood]) : undefined
      });

      // Add the first page with the photo using centered-single template
      await booksApi.addPage(book.id, {
        template_id: 'tpl-centered-single',
        page_data: {
          slots: [{ slot_id: 'center', image_id: image.id }],
          textSlots: []
        },
        position: 0
      });

      // Update the book cover with this image
      await booksApi.update(book.id, {
        cover_image_id: image.id
      });

      // Navigate to the book editor
      navigate(`/books/${book.id}`);
    } catch (error) {
      console.error('Failed to create book:', error);
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl w-full max-w-md border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Créer un book</h2>
              <p className="text-sm text-gray-400">À partir de cette photo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          {/* Book name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nom du book *</label>
            <input
              type="text"
              value={bookName}
              onChange={(e) => setBookName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              placeholder="Mon nouveau book"
              required
              autoFocus
            />
          </div>

          {/* Book description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={bookDescription}
              onChange={(e) => setBookDescription(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white resize-none focus:outline-none focus:border-indigo-500"
              rows={2}
              placeholder="Description optionnelle..."
            />
          </div>

          {/* Photo info */}
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <p className="text-sm text-gray-400">Cette photo sera ajoutée comme première page :</p>

            {/* Mood */}
            {imageMood && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Ambiance:</span>
                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                  {imageMood}
                </span>
              </div>
            )}

            {/* Tags */}
            {imageTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-gray-500">Tags:</span>
                {imageTags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {!imageMood && imageTags.length === 0 && (
              <p className="text-xs text-gray-500 italic">
                Aucune ambiance ou tag défini pour cette photo
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
              disabled={creating}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!bookName.trim() || creating}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <BookOpen className="w-4 h-4" />
                  Créer le book
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
