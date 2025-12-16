import { useState } from 'react';
import { Plus, Pencil, Trash2, Folder, X, Check, Upload } from 'lucide-react';
import { themesApi, getThumbnailUrl } from '../api/client';
import type { Theme } from '../types';

interface ThemeManagerProps {
  themes: Theme[];
  selectedTheme: string | null;
  onSelectTheme: (themeId: string | null) => void;
  onThemesChange: () => void;
  onUploadToTheme?: (themeId: string) => void;
}

export function ThemeManager({ themes, selectedTheme, onSelectTheme, onThemesChange, onUploadToTheme }: ThemeManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingTheme, setEditingTheme] = useState<Theme | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dragOverThemeId, setDragOverThemeId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingTheme) {
        await themesApi.update(editingTheme.id, { name, description });
      } else {
        await themesApi.create({ name, description });
      }
      resetForm();
      onThemesChange();
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const handleDelete = async (theme: Theme) => {
    if (!confirm(`Supprimer le thème "${theme.name}" ? Les images ne seront pas supprimées.`)) return;

    try {
      await themesApi.delete(theme.id);
      if (selectedTheme === theme.id) {
        onSelectTheme(null);
      }
      onThemesChange();
    } catch (error) {
      console.error('Failed to delete theme:', error);
    }
  };

  const startEdit = (theme: Theme) => {
    setEditingTheme(theme);
    setName(theme.name);
    setDescription(theme.description || '');
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingTheme(null);
    setName('');
    setDescription('');
  };

  // Get cover image for theme
  const getCoverImage = (theme: Theme): string | null => {
    if (theme.cover_image_id && theme.images) {
      const coverImage = theme.images.find(img => img.id === theme.cover_image_id);
      if (coverImage) return getThumbnailUrl(coverImage.filename);
    }
    return null;
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent, themeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragOverThemeId !== themeId) {
      setDragOverThemeId(themeId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverThemeId(null);
  };

  const handleDrop = (e: React.DragEvent, themeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverThemeId(null);

    // Check if files are being dropped
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onUploadToTheme) {
      onUploadToTheme(themeId);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Thèmes</h2>
        <button
          onClick={() => setShowForm(true)}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          title="Nouveau thème"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom du thème"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400"
            autoFocus
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnel)"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 py-2 px-4 rounded-lg transition-colors"
            >
              <Check className="w-4 h-4" />
              {editingTheme ? 'Modifier' : 'Créer'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 border border-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* All Images Button */}
      <button
        onClick={() => onSelectTheme(null)}
        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
          selectedTheme === null ? 'bg-rose-500/20 text-rose-400' : 'hover:bg-gray-800'
        }`}
      >
        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
          <Folder className="w-5 h-5" />
        </div>
        <div className="text-left flex-1">
          <p className="font-medium">Toutes les images</p>
          <p className="text-sm text-gray-400">
            {themes.reduce((acc, t) => acc + (t.image_count || 0), 0)} images
          </p>
        </div>
      </button>

      {/* Theme List */}
      <div className="space-y-2">
        {themes.map(theme => {
          const coverImage = getCoverImage(theme);
          const isDragOver = dragOverThemeId === theme.id;
          return (
            <div
              key={theme.id}
              className={`group flex items-center gap-3 p-3 rounded-lg transition-all cursor-pointer ${
                isDragOver
                  ? 'bg-rose-500/30 border-2 border-dashed border-rose-500 scale-[1.02]'
                  : selectedTheme === theme.id
                    ? 'bg-rose-500/20 text-rose-400 border-2 border-transparent'
                    : 'hover:bg-gray-800 border-2 border-transparent'
              }`}
              onClick={() => onSelectTheme(theme.id)}
              onDragOver={(e) => handleDragOver(e, theme.id)}
              onDragEnter={(e) => handleDragOver(e, theme.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, theme.id)}
            >
              <div className="w-10 h-10 bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
                {isDragOver ? (
                  <Upload className="w-5 h-5 text-rose-400 animate-pulse" />
                ) : coverImage ? (
                  <img src={coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Folder className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{theme.name}</p>
                <p className="text-sm text-gray-400">
                  {isDragOver ? 'Déposez pour ajouter...' : `${theme.image_count || 0} images`}
                </p>
              </div>
              <div className="hidden group-hover:flex items-center gap-1">
                {onUploadToTheme && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onUploadToTheme(theme.id); }}
                    className="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded"
                    title="Ajouter des images"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(theme); }}
                  className="p-1.5 hover:bg-gray-600 rounded"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(theme); }}
                  className="p-1.5 hover:bg-red-500/20 text-red-400 rounded"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {themes.length === 0 && !showForm && (
        <p className="text-center text-gray-400 py-4 text-sm">
          Aucun thème créé.<br />
          Créez un thème pour organiser vos images.
        </p>
      )}
    </div>
  );
}
