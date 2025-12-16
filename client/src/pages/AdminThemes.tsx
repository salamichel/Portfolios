import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { themesApi, getThumbnailUrl } from '../api/client';
import type { Theme } from '../types';
import {
  GripVertical,
  Search,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ArrowLeft,
  Plus,
  CheckSquare,
  Square,
  AlertTriangle
} from 'lucide-react';

const ITEMS_PER_PAGE = 50;

export function AdminThemes() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [filteredThemes, setFilteredThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<'single' | 'bulk' | null>(null);
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newThemeName, setNewThemeName] = useState('');
  const [newThemeDescription, setNewThemeDescription] = useState('');

  const editInputRef = useRef<HTMLInputElement>(null);

  const loadThemes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await themesApi.getAll();
      setThemes(data);
    } catch (error) {
      console.error('Failed to load themes:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  useEffect(() => {
    const filtered = themes.filter(theme =>
      theme.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredThemes(filtered);
    setCurrentPage(1);
  }, [themes, searchQuery]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const totalPages = Math.ceil(filteredThemes.length / ITEMS_PER_PAGE);
  const paginatedThemes = filteredThemes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedThemes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedThemes.map(t => t.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleStartEdit = (theme: Theme) => {
    setEditingId(theme.id);
    setEditingName(theme.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    try {
      setSaving(true);
      await themesApi.update(editingId, { name: editingName.trim() });
      setThemes(prev =>
        prev.map(t => (t.id === editingId ? { ...t, name: editingName.trim() } : t))
      );
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update theme:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleDeleteClick = (id: string) => {
    setSingleDeleteId(id);
    setDeleteTarget('single');
    setShowDeleteModal(true);
  };

  const handleBulkDeleteClick = () => {
    if (selectedIds.size === 0) return;
    setDeleteTarget('bulk');
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setSaving(true);
      if (deleteTarget === 'single' && singleDeleteId) {
        await themesApi.delete(singleDeleteId);
        setThemes(prev => prev.filter(t => t.id !== singleDeleteId));
      } else if (deleteTarget === 'bulk') {
        await themesApi.bulkDelete(Array.from(selectedIds));
        setThemes(prev => prev.filter(t => !selectedIds.has(t.id)));
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setSaving(false);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      setSingleDeleteId(null);
    }
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const newThemes = [...themes];
    const draggedIndex = newThemes.findIndex(t => t.id === draggedId);
    const targetIndex = newThemes.findIndex(t => t.id === targetId);

    const [removed] = newThemes.splice(draggedIndex, 1);
    newThemes.splice(targetIndex, 0, removed);

    setThemes(newThemes);
    setDraggedId(null);

    try {
      setSaving(true);
      await themesApi.reorder(newThemes.map(t => t.id));
    } catch (error) {
      console.error('Failed to reorder themes:', error);
      loadThemes();
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleCreateTheme = async () => {
    if (!newThemeName.trim()) return;

    try {
      setSaving(true);
      await themesApi.create({
        name: newThemeName.trim(),
        description: newThemeDescription.trim() || undefined
      });
      await loadThemes();
      setShowCreateModal(false);
      setNewThemeName('');
      setNewThemeDescription('');
    } catch (error) {
      console.error('Failed to create theme:', error);
    } finally {
      setSaving(false);
    }
  };

  const getThemeToDelete = () => {
    if (deleteTarget === 'single' && singleDeleteId) {
      return themes.find(t => t.id === singleDeleteId);
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                title="Retour au portfolio"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-semibold">Gestion des thèmes</h1>
                <p className="text-sm text-gray-400">
                  {themes.length} thème{themes.length > 1 ? 's' : ''}
                  {saving && ' • Sauvegarde...'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouveau thème
            </button>
          </div>

          {/* Search and actions bar */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un thème..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-rose-500"
              />
            </div>

            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDeleteClick}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer ({selectedIds.size})
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Table */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[auto_48px_1fr_120px_100px] gap-4 px-4 py-3 bg-gray-700/50 border-b border-gray-700 text-sm font-medium text-gray-400">
            <div className="flex items-center">
              <button
                onClick={handleSelectAll}
                className="p-1 hover:bg-gray-600 rounded"
              >
                {selectedIds.size === paginatedThemes.length && paginatedThemes.length > 0 ? (
                  <CheckSquare className="w-5 h-5 text-rose-500" />
                ) : (
                  <Square className="w-5 h-5" />
                )}
              </button>
            </div>
            <div></div>
            <div>Nom du thème</div>
            <div className="text-center">Images</div>
            <div className="text-center">Actions</div>
          </div>

          {/* Table body */}
          <div className="divide-y divide-gray-700">
            {paginatedThemes.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400">
                {searchQuery ? 'Aucun thème trouvé' : 'Aucun thème'}
              </div>
            ) : (
              paginatedThemes.map((theme) => (
                <div
                  key={theme.id}
                  draggable={!searchQuery}
                  onDragStart={(e) => handleDragStart(e, theme.id)}
                  onDragOver={(e) => handleDragOver(e, theme.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, theme.id)}
                  onDragEnd={handleDragEnd}
                  className={`
                    grid grid-cols-[auto_48px_1fr_120px_100px] gap-4 px-4 py-3 items-center
                    transition-colors
                    ${draggedId === theme.id ? 'opacity-50' : ''}
                    ${dragOverId === theme.id ? 'bg-rose-500/20 border-t-2 border-rose-500' : 'hover:bg-gray-700/50'}
                    ${selectedIds.has(theme.id) ? 'bg-rose-500/10' : ''}
                  `}
                >
                  {/* Checkbox */}
                  <div className="flex items-center">
                    <button
                      onClick={() => handleSelectOne(theme.id)}
                      className="p-1 hover:bg-gray-600 rounded"
                    >
                      {selectedIds.has(theme.id) ? (
                        <CheckSquare className="w-5 h-5 text-rose-500" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                  </div>

                  {/* Drag handle */}
                  <div
                    className={`cursor-grab active:cursor-grabbing ${searchQuery ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    <GripVertical className="w-5 h-5 text-gray-500" />
                  </div>

                  {/* Theme info */}
                  <div className="flex items-center gap-3 min-w-0">
                    {theme.cover_image_id ? (
                      <img
                        src={getThumbnailUrl(theme.cover_image_id)}
                        alt=""
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-700 flex items-center justify-center flex-shrink-0">
                        <ImageIcon className="w-5 h-5 text-gray-500" />
                      </div>
                    )}

                    {editingId === theme.id ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          ref={editInputRef}
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="flex-1 px-3 py-1 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-rose-500 min-w-0"
                        />
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="p-1.5 bg-green-600 hover:bg-green-700 rounded transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="p-1.5 bg-gray-600 hover:bg-gray-700 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="truncate">{theme.name}</span>
                    )}
                  </div>

                  {/* Image count */}
                  <div className="text-center text-gray-400">
                    {theme.image_count ?? 0}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => handleStartEdit(theme)}
                      className="p-2 hover:bg-gray-600 rounded transition-colors"
                      title="Renommer"
                    >
                      <Edit3 className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(theme.id)}
                      className="p-2 hover:bg-red-600/20 rounded transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Page {currentPage} sur {totalPages}
              {' • '}
              {filteredThemes.length} thème{filteredThemes.length > 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-10 h-10 rounded-lg transition-colors ${
                        currentPage === pageNum
                          ? 'bg-rose-500 text-white'
                          : 'hover:bg-gray-800'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold">Confirmer la suppression</h3>
            </div>

            <p className="text-gray-300 mb-6">
              {deleteTarget === 'single' ? (
                <>
                  Êtes-vous sûr de vouloir supprimer le thème{' '}
                  <strong>"{getThemeToDelete()?.name}"</strong> ?
                </>
              ) : (
                <>
                  Êtes-vous sûr de vouloir supprimer{' '}
                  <strong>{selectedIds.size} thème{selectedIds.size > 1 ? 's' : ''}</strong> ?
                </>
              )}
              <br />
              <span className="text-sm text-gray-400">
                Les images associées ne seront pas supprimées mais n'auront plus de thème.
              </span>
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTarget(null);
                  setSingleDeleteId(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create theme modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-800 rounded-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Créer un nouveau thème</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nom du thème *
                </label>
                <input
                  type="text"
                  value={newThemeName}
                  onChange={(e) => setNewThemeName(e.target.value)}
                  placeholder="Ex: Portraits, Paysages..."
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={newThemeDescription}
                  onChange={(e) => setNewThemeDescription(e.target.value)}
                  placeholder="Description optionnelle..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewThemeName('');
                  setNewThemeDescription('');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateTheme}
                disabled={saving || !newThemeName.trim()}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Création...' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
