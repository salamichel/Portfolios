import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Layout as LayoutIcon, Plus, Save, Copy, Trash2, Edit2 } from 'lucide-react';
import { templatesApi } from '../api/client';
import type { PageTemplate, TemplateLayout, LayoutSlot } from '../types';
import { TemplateCanvas } from '../components/template/TemplateCanvas';
import { SlotPropertiesPanel } from '../components/template/SlotPropertiesPanel';
import { TemplateMetadataModal } from '../components/template/TemplateMetadataModal';

export function TemplateEditor() {
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [editedLayout, setEditedLayout] = useState<TemplateLayout | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await templatesApi.getAll();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedTemplate) {
      setEditedLayout(selectedTemplate.layout);
      setSelectedSlotId(null);
    } else {
      setEditedLayout(null);
      setSelectedSlotId(null);
    }
  }, [selectedTemplate]);

  const handleTemplateSelect = (template: PageTemplate) => {
    setSelectedTemplate(template);
  };

  const handleLayoutChange = (layout: TemplateLayout) => {
    setEditedLayout(layout);
  };

  const handleSlotUpdate = (updatedSlot: LayoutSlot) => {
    if (!editedLayout) return;

    const updatedSlots = editedLayout.slots.map(slot =>
      slot.id === updatedSlot.id ? updatedSlot : slot
    );
    setEditedLayout({ slots: updatedSlots });
  };

  const handleSlotDelete = (slotId: string) => {
    if (!editedLayout) return;

    const updatedSlots = editedLayout.slots.filter(slot => slot.id !== slotId);
    setEditedLayout({ slots: updatedSlots });
    setSelectedSlotId(null);
  };

  const handleSave = async () => {
    if (!selectedTemplate || !editedLayout || selectedTemplate.is_predefined) return;

    try {
      setSaving(true);
      await templatesApi.update(selectedTemplate.id, { layout: editedLayout });

      // Refresh templates
      await loadTemplates();

      // Update selected template
      const updated = templates.find(t => t.id === selectedTemplate.id);
      if (updated) {
        setSelectedTemplate(updated);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      alert('Erreur lors de la sauvegarde du template');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async () => {
    if (!selectedTemplate) return;

    const name = prompt('Nom du nouveau template:', `${selectedTemplate.name} (copie)`);
    if (!name) return;

    try {
      const clonedTemplate = await templatesApi.create({
        name: name.trim(),
        description: selectedTemplate.description || undefined,
        layout: editedLayout || selectedTemplate.layout,
      });

      setTemplates([...templates, clonedTemplate]);
      setSelectedTemplate(clonedTemplate);
    } catch (error) {
      console.error('Failed to clone template:', error);
      alert('Erreur lors du clonage du template');
    }
  };

  const handleDelete = async () => {
    if (!selectedTemplate || selectedTemplate.is_predefined) return;

    if (!confirm(`Supprimer le template "${selectedTemplate.name}" ?`)) return;

    try {
      await templatesApi.delete(selectedTemplate.id);
      setTemplates(templates.filter(t => t.id !== selectedTemplate.id));
      setSelectedTemplate(null);
    } catch (error) {
      console.error('Failed to delete template:', error);
      alert('Erreur lors de la suppression du template');
    }
  };

  const handleCreateNew = async () => {
    const name = prompt('Nom du nouveau template:');
    if (!name) return;

    try {
      const newTemplate = await templatesApi.create({
        name: name.trim(),
        layout: {
          slots: []
        }
      });

      setTemplates([...templates, newTemplate]);
      setSelectedTemplate(newTemplate);
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('Erreur lors de la création du template');
    }
  };

  const handleSaveMetadata = async (name: string, description: string) => {
    if (!selectedTemplate || selectedTemplate.is_predefined) return;

    try {
      await templatesApi.update(selectedTemplate.id, {
        name,
        description: description || undefined,
      });

      // Refresh templates
      await loadTemplates();

      // Update selected template
      const updated = templates.find(t => t.id === selectedTemplate.id);
      if (updated) {
        setSelectedTemplate(updated);
      }
    } catch (error) {
      console.error('Failed to update template metadata:', error);
      alert('Erreur lors de la mise à jour du template');
    }
  };

  const predefinedTemplates = templates.filter(t => t.is_predefined);
  const customTemplates = templates.filter(t => !t.is_predefined);

  const selectedSlot = editedLayout?.slots.find(s => s.id === selectedSlotId) || null;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-40">
        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                <LayoutIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Éditeur de Templates</h1>
                <p className="text-sm text-gray-400">Créez et modifiez vos templates de mise en page</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="hidden sm:inline">Nouveau template</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Template List */}
        <aside className="w-80 border-r border-gray-800 bg-gray-900 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            {/* Predefined Templates */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                Templates système
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-rose-500"></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {predefinedTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'bg-rose-500/20 border-2 border-rose-500'
                          : 'bg-gray-800 border-2 border-transparent hover:border-gray-700'
                      }`}
                    >
                      <div className="font-medium text-white mb-1">{template.name}</div>
                      {template.description && (
                        <div className="text-xs text-gray-400 line-clamp-2">{template.description}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {template.layout.slots.length} slot{template.layout.slots.length > 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Custom Templates */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                Templates personnalisés
              </h3>
              {customTemplates.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Aucun template personnalisé</p>
              ) : (
                <div className="space-y-2">
                  {customTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        selectedTemplate?.id === template.id
                          ? 'bg-rose-500/20 border-2 border-rose-500'
                          : 'bg-gray-800 border-2 border-transparent hover:border-gray-700'
                      }`}
                    >
                      <div className="font-medium text-white mb-1">{template.name}</div>
                      {template.description && (
                        <div className="text-xs text-gray-400 line-clamp-2">{template.description}</div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        {template.layout.slots.length} slot{template.layout.slots.length > 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Center - Editor Canvas */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-950">
          {selectedTemplate ? (
            <div className="max-w-6xl mx-auto">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{selectedTemplate.name}</h2>
                    {!selectedTemplate.is_predefined && (
                      <button
                        onClick={() => setShowMetadataModal(true)}
                        className="p-1 hover:bg-gray-800 rounded transition-colors"
                        title="Modifier le nom et la description"
                      >
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                  {selectedTemplate.description && (
                    <p className="text-gray-400 mt-1">{selectedTemplate.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClone}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    title="Cloner ce template"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="text-sm">Cloner</span>
                  </button>
                  {!selectedTemplate.is_predefined && (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-3 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        <span className="text-sm">{saving ? 'Sauvegarde...' : 'Sauvegarder'}</span>
                      </button>
                      <button
                        onClick={handleDelete}
                        className="p-2 bg-gray-800 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Canvas - Double Page Spread Preview */}
              {editedLayout && (
                <TemplateCanvas
                  layout={editedLayout}
                  onLayoutChange={handleLayoutChange}
                  isEditable={!selectedTemplate.is_predefined}
                  selectedSlotId={selectedSlotId}
                  onSlotSelect={setSelectedSlotId}
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <LayoutIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-xl font-medium text-gray-300 mb-2">Aucun template sélectionné</h2>
                <p className="text-gray-500">Sélectionnez un template dans la liste ou créez-en un nouveau</p>
              </div>
            </div>
          )}
        </main>

        {/* Right Sidebar - Properties Panel */}
        {selectedTemplate && (
          <aside className="w-80 border-l border-gray-800 bg-gray-900 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-3">
                Propriétés du slot
              </h3>
              <SlotPropertiesPanel
                slot={selectedSlot}
                onSlotUpdate={handleSlotUpdate}
                onSlotDelete={handleSlotDelete}
              />
            </div>
          </aside>
        )}
      </div>

      {/* Metadata Modal */}
      {showMetadataModal && selectedTemplate && !selectedTemplate.is_predefined && (
        <TemplateMetadataModal
          name={selectedTemplate.name}
          description={selectedTemplate.description}
          onSave={handleSaveMetadata}
          onClose={() => setShowMetadataModal(false)}
        />
      )}
    </div>
  );
}
