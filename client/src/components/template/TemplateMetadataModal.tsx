import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { templatesApi } from '../../api/client';
import type { TemplateLayout } from '../../types';

interface TemplateMetadataModalProps {
  name: string;
  description: string | null;
  layout: TemplateLayout;
  onSave: (name: string, description: string) => void;
  onClose: () => void;
}

export function TemplateMetadataModal({ name, description, layout, onSave, onClose }: TemplateMetadataModalProps) {
  const [editedName, setEditedName] = useState(name);
  const [editedDescription, setEditedDescription] = useState(description || '');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editedName.trim()) {
      onSave(editedName.trim(), editedDescription.trim());
      onClose();
    }
  };

  const handleAIAssist = async () => {
    try {
      setIsGenerating(true);
      const result = await templatesApi.generateMetadata(layout);
      setEditedName(result.name);
      setEditedDescription(result.description);
    } catch (error) {
      console.error('Failed to generate metadata:', error);
      alert('Erreur lors de la génération par IA');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-900 rounded-2xl w-full max-w-md">
        <div className="border-b border-gray-800 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Modifier le template</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* AI Assistance Button */}
          <button
            type="button"
            onClick={handleAIAssist}
            disabled={isGenerating}
            className="w-full mb-4 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-5 h-5" />
            {isGenerating ? 'Génération en cours...' : 'Assistance IA'}
          </button>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nom du template
            </label>
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              placeholder="Nom du template"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (optionnel)
            </label>
            <textarea
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="Description du template..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!editedName.trim()}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sauvegarder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
