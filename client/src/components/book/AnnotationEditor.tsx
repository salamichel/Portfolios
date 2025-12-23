import { useState, useEffect } from 'react';
import { X, Wand2, Type, AlignLeft, FileText } from 'lucide-react';
import type { SlotAnnotation, Image } from '../../types';

interface AnnotationEditorProps {
  annotation?: SlotAnnotation;
  image?: Image;
  onSave: (annotation: SlotAnnotation) => void;
  onClose: () => void;
}

export function AnnotationEditor({ annotation, image, onSave, onClose }: AnnotationEditorProps) {
  const [title, setTitle] = useState(annotation?.title || '');
  const [description, setDescription] = useState(annotation?.description || '');
  const [paragraph, setParagraph] = useState(annotation?.paragraph || '');
  const [showTitle, setShowTitle] = useState(annotation?.show_title ?? true);
  const [showDescription, setShowDescription] = useState(annotation?.show_description ?? false);
  const [showParagraph, setShowParagraph] = useState(annotation?.show_paragraph ?? false);
  const [position, setPosition] = useState<'bottom' | 'top' | 'overlay' | 'side'>(annotation?.position || 'bottom');
  const [useImageMetadata, setUseImageMetadata] = useState(annotation?.use_image_metadata ?? false);

  // Apply image metadata when toggled
  useEffect(() => {
    if (useImageMetadata && image) {
      if (image.title) setTitle(image.title);
      if (image.description) setDescription(image.description);
    }
  }, [useImageMetadata, image]);

  const handleImportMetadata = () => {
    if (!image) return;
    if (image.title) setTitle(image.title);
    if (image.description) setDescription(image.description);
    setUseImageMetadata(true);
  };

  const handleSave = () => {
    onSave({
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      paragraph: paragraph.trim() || undefined,
      show_title: showTitle,
      show_description: showDescription,
      show_paragraph: showParagraph,
      position,
      use_image_metadata: useImageMetadata
    });
  };

  const hasMetadata = image?.title || image?.description;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Annoter l'image</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Import from AI metadata */}
          {hasMetadata && (
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-indigo-300">Métadonnées disponibles</p>
                  <p className="text-sm text-gray-400">Cette image a été enrichie par l'IA</p>
                </div>
                <button
                  onClick={handleImportMetadata}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-sm"
                >
                  <Wand2 className="w-4 h-4" />
                  Importer
                </button>
              </div>
              {image?.mood && (
                <p className="mt-2 text-sm text-gray-400">Ambiance: {image.mood}</p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Type className="w-4 h-4" />
                Titre
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showTitle}
                  onChange={(e) => setShowTitle(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-rose-500 focus:ring-rose-500"
                />
                <span className="text-gray-400">Afficher</span>
              </label>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'image"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <AlignLeft className="w-4 h-4" />
                Description
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDescription}
                  onChange={(e) => setShowDescription(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-rose-500 focus:ring-rose-500"
                />
                <span className="text-gray-400">Afficher</span>
              </label>
            </div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description courte"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Paragraph */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <FileText className="w-4 h-4" />
                Paragraphe
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showParagraph}
                  onChange={(e) => setShowParagraph(e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-rose-500 focus:ring-rose-500"
                />
                <span className="text-gray-400">Afficher</span>
              </label>
            </div>
            <textarea
              value={paragraph}
              onChange={(e) => setParagraph(e.target.value)}
              placeholder="Texte libre, commentaire, histoire..."
              rows={4}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Position du texte
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'bottom', label: 'Bas' },
                { value: 'top', label: 'Haut' },
                { value: 'overlay', label: 'Sur l\'image' },
                { value: 'side', label: 'Côté' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPosition(opt.value as typeof position)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    position === opt.value
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview hint */}
          <div className="text-sm text-gray-500">
            {showTitle || showDescription || showParagraph ? (
              <p>Les annotations seront affichées en position "{position === 'bottom' ? 'bas' : position === 'top' ? 'haut' : position === 'overlay' ? 'sur l\'image' : 'côté'}"</p>
            ) : (
              <p>Cochez au moins une option pour afficher les annotations</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
