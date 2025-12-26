import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, BookOpen, Loader2, Sparkles } from 'lucide-react';
import { booksApi } from '../../api/client';
import type { Image } from '../../types';

interface CreateBookFromPhotosModalProps {
  images: Image[];
  onClose: () => void;
}

export function CreateBookFromPhotosModal({ images, onClose }: CreateBookFromPhotosModalProps) {
  const navigate = useNavigate();
  const [bookName, setBookName] = useState('');
  const [bookDescription, setBookDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [currentStep, setCurrentStep] = useState<'form' | 'ai-generation' | 'creating'>('form');
  const [error, setError] = useState<string | null>(null);

  // Collect all tags and moods from images
  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return tags.split(',').map(t => t.trim()).filter(t => t);
    }
  };

  const allTags = Array.from(
    new Set(images.flatMap(img => parseTags(img.tags)))
  );

  const allMoods = Array.from(
    new Set(images.map(img => img.mood).filter(m => m))
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName.trim() || creating || images.length === 0) return;

    setCreating(true);
    setError(null);

    try {
      setCurrentStep('form');

      // Step 1: Create the book
      const book = await booksApi.create({
        name: bookName.trim(),
        description: bookDescription.trim() || undefined,
        tags: allTags.length > 0 ? JSON.stringify(allTags) : undefined,
        mood: allMoods.length > 0 ? JSON.stringify(allMoods) : undefined
      });

      // Step 2: Use AI to suggest layouts for the images
      setCurrentStep('ai-generation');
      const imageIds = images.map(img => img.id);
      const suggestions = await booksApi.suggestLayout(book.id, imageIds);

      // Step 3: Apply the AI suggestions to create pages
      setCurrentStep('creating');
      await booksApi.applySuggestions(book.id, suggestions.suggestions);

      // Step 4: Set the first image as cover
      if (images.length > 0) {
        await booksApi.update(book.id, {
          cover_image_id: images[0].id
        });
      }

      // Navigate to the book editor
      navigate(`/books/${book.id}`);
    } catch (error) {
      console.error('Failed to create book:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la création du livre'
      );
      setCreating(false);
      setCurrentStep('form');
    }
  };

  const getStepMessage = () => {
    switch (currentStep) {
      case 'form':
        return 'Création du livre...';
      case 'ai-generation':
        return 'Génération des layouts avec IA...';
      case 'creating':
        return 'Création des pages...';
      default:
        return 'Traitement en cours...';
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 rounded-xl w-full max-w-2xl border border-gray-700 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Créer un book</h2>
              <p className="text-sm text-gray-400">
                À partir de {images.length} photo{images.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
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
              disabled={creating}
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
              disabled={creating}
            />
          </div>

          {/* Preview images */}
          <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Les pages seront générées automatiquement avec IA
            </p>

            {/* Images preview grid */}
            <div className="grid grid-cols-6 gap-2 max-h-32 overflow-y-auto">
              {images.map((image, idx) => (
                <div
                  key={image.id}
                  className="aspect-square rounded overflow-hidden bg-gray-700 relative"
                >
                  <img
                    src={`/api/images/${image.filename}/thumbnail`}
                    alt={image.title || image.original_name}
                    className="w-full h-full object-cover"
                  />
                  {idx === 0 && (
                    <div className="absolute top-0 left-0 right-0 bg-indigo-600 text-white text-xs py-0.5 text-center">
                      Couverture
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Metadata preview */}
            {(allTags.length > 0 || allMoods.length > 0) && (
              <div className="pt-2 space-y-1">
                {allMoods.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500">Ambiances:</span>
                    {allMoods.slice(0, 5).map((mood, i) => (
                      <span key={i} className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
                        {mood}
                      </span>
                    ))}
                    {allMoods.length > 5 && (
                      <span className="text-xs text-gray-500">+{allMoods.length - 5}</span>
                    )}
                  </div>
                )}

                {allTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-gray-500">Tags:</span>
                    {allTags.slice(0, 8).map((tag, i) => (
                      <span key={i} className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                    {allTags.length > 8 && (
                      <span className="text-xs text-gray-500">+{allTags.length - 8}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Progress indicator */}
          {creating && (
            <div className="bg-indigo-500/10 border border-indigo-500/50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <div>
                  <p className="text-sm text-indigo-400 font-medium">{getStepMessage()}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Cela peut prendre quelques secondes...</p>
                </div>
              </div>
            </div>
          )}

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
                  {getStepMessage()}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Créer avec IA
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
