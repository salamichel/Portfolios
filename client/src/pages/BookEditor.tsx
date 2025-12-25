import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Plus, Trash2, Wand2, ChevronLeft, ChevronRight,
  LayoutGrid, BookOpen, Presentation
} from 'lucide-react';
import { booksApi, templatesApi, themesApi } from '../api/client';
import type { Book, BookPage, PageTemplate, Theme, LayoutSuggestion, Image, SlotAnnotation, TextSlotData } from '../types';
import { DoublePageSpread } from '../components/book/DoublePageSpread';
import { ImageSelector } from '../components/book/ImageSelector';
import { TemplateSelector } from '../components/book/TemplateSelector';
import { PageThumbnails } from '../components/book/PageThumbnails';
import { AnnotationEditor } from '../components/book/AnnotationEditor';
import { TextSlotEditor } from '../components/book/TextSlotEditor';
import { BookSlideshow } from '../components/book/BookSlideshow';

export function BookEditor() {
  const { id } = useParams<{ id: string }>();

  const [book, setBook] = useState<Book | null>(null);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals
  const [showImageSelector, setShowImageSelector] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  // Annotation editor
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);
  const [annotationSlotId, setAnnotationSlotId] = useState<string | null>(null);
  const [annotationImage, setAnnotationImage] = useState<Image | null>(null);

  // Text slot editor
  const [showTextSlotEditor, setShowTextSlotEditor] = useState(false);
  const [editingTextSlotId, setEditingTextSlotId] = useState<string | null>(null);

  // Slideshow
  const [showSlideshow, setShowSlideshow] = useState(false);

  // AI suggestions
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<LayoutSuggestion[]>([]);
  const [suggestionsReasoning, setSuggestionsReasoning] = useState('');
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);

  const loadBook = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [bookData, templatesData, themesData] = await Promise.all([
        booksApi.getById(id),
        templatesApi.getAll(),
        themesApi.getAll()
      ]);
      setBook(bookData);
      setPages(bookData.pages || []);
      setTemplates(templatesData);
      setThemes(themesData);
    } catch (error) {
      console.error('Failed to load book:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBook();
  }, [loadBook]);

  const currentPage = pages[currentPageIndex];

  const handleAddPage = async () => {
    if (!id) return;
    try {
      const defaultTemplate = templates.find(t => t.id === 'tpl-full-bleed-2') || templates[0];
      const newPage = await booksApi.addPage(id, {
        template_id: defaultTemplate?.id,
        page_data: { slots: [] }
      });
      setPages([...pages, newPage]);
      setCurrentPageIndex(pages.length);
    } catch (error) {
      console.error('Failed to add page:', error);
    }
  };

  const handleDeletePage = async () => {
    if (!id || !currentPage) return;
    if (!confirm('Supprimer cette page ?')) return;

    try {
      await booksApi.deletePage(id, currentPage.id);
      const newPages = pages.filter(p => p.id !== currentPage.id);
      setPages(newPages);
      if (currentPageIndex >= newPages.length) {
        setCurrentPageIndex(Math.max(0, newPages.length - 1));
      }
    } catch (error) {
      console.error('Failed to delete page:', error);
    }
  };

  const handleTemplateChange = async (templateId: string) => {
    if (!id || !currentPage) return;
    try {
      setSaving(true);
      const updated = await booksApi.updatePage(id, currentPage.id, {
        template_id: templateId,
        page_data: { slots: [] } // Reset slots when changing template
      });
      setPages(pages.map(p => p.id === currentPage.id ? updated : p));
      setShowTemplateSelector(false);
    } catch (error) {
      console.error('Failed to update template:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleImageAssign = async (imageId: string) => {
    if (!id || !currentPage || !selectedSlotId) return;

    try {
      setSaving(true);
      const currentSlots = currentPage.page_data?.slots || [];
      const newSlots = currentSlots.filter(s => s.slot_id !== selectedSlotId);
      newSlots.push({ slot_id: selectedSlotId, image_id: imageId });

      const updated = await booksApi.updatePage(id, currentPage.id, {
        page_data: { slots: newSlots }
      });
      setPages(pages.map(p => p.id === currentPage.id ? updated : p));
      setShowImageSelector(false);
      setSelectedSlotId(null);
    } catch (error) {
      console.error('Failed to assign image:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleSlotClick = (slotId: string) => {
    setSelectedSlotId(slotId);
    setShowImageSelector(true);
  };

  const handleRemoveImage = async (slotId: string) => {
    if (!id || !currentPage) return;

    try {
      setSaving(true);
      const newSlots = (currentPage.page_data?.slots || []).filter(s => s.slot_id !== slotId);
      const updated = await booksApi.updatePage(id, currentPage.id, {
        page_data: { slots: newSlots }
      });
      setPages(pages.map(p => p.id === currentPage.id ? updated : p));
    } catch (error) {
      console.error('Failed to remove image:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateSuggestions = async (imageIds: string[]) => {
    if (!id || imageIds.length === 0) return;

    try {
      setGeneratingSuggestions(true);
      const result = await booksApi.suggestLayout(id, imageIds);
      setSuggestions(result.suggestions);
      setSuggestionsReasoning(result.reasoning);
      setShowAISuggestions(true);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  const handleApplySuggestions = async () => {
    if (!id || suggestions.length === 0) return;

    try {
      setSaving(true);
      const newPages = await booksApi.applySuggestions(id, suggestions);
      setPages([...pages, ...newPages]);
      setShowAISuggestions(false);
      setSuggestions([]);
    } catch (error) {
      console.error('Failed to apply suggestions:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleReorderPages = async (newOrder: string[]) => {
    if (!id) return;
    try {
      const reordered = await booksApi.reorderPages(id, newOrder);
      setPages(reordered);
    } catch (error) {
      console.error('Failed to reorder pages:', error);
    }
  };

  const handleEditAnnotation = (slotId: string, image: Image) => {
    setAnnotationSlotId(slotId);
    setAnnotationImage(image);
    setShowAnnotationEditor(true);
  };

  const handleSaveAnnotation = async (annotation: SlotAnnotation) => {
    if (!id || !currentPage || !annotationSlotId) return;

    try {
      setSaving(true);
      const currentSlots = currentPage.page_data?.slots || [];
      const slotIndex = currentSlots.findIndex(s => s.slot_id === annotationSlotId);

      if (slotIndex >= 0) {
        // Update existing slot with annotation
        const updatedSlots = [...currentSlots];
        updatedSlots[slotIndex] = {
          ...updatedSlots[slotIndex],
          annotation
        };

        const updated = await booksApi.updatePage(id, currentPage.id, {
          page_data: { slots: updatedSlots }
        });
        setPages(pages.map(p => p.id === currentPage.id ? updated : p));
      }

      setShowAnnotationEditor(false);
      setAnnotationSlotId(null);
      setAnnotationImage(null);
    } catch (error) {
      console.error('Failed to save annotation:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditTextSlot = (slotId: string) => {
    setEditingTextSlotId(slotId);
    setShowTextSlotEditor(true);
  };

  const handleSaveTextSlot = async (textSlot: TextSlotData) => {
    if (!id || !currentPage || !editingTextSlotId) return;

    try {
      setSaving(true);
      const currentTextSlots = currentPage.page_data?.textSlots || [];
      const existingIndex = currentTextSlots.findIndex(s => s.slot_id === editingTextSlotId);

      let updatedTextSlots: TextSlotData[];
      if (existingIndex >= 0) {
        updatedTextSlots = [...currentTextSlots];
        updatedTextSlots[existingIndex] = textSlot;
      } else {
        updatedTextSlots = [...currentTextSlots, textSlot];
      }

      const updated = await booksApi.updatePage(id, currentPage.id, {
        page_data: {
          slots: currentPage.page_data?.slots || [],
          textSlots: updatedTextSlots
        }
      });
      setPages(pages.map(p => p.id === currentPage.id ? updated : p));

      setShowTextSlotEditor(false);
      setEditingTextSlotId(null);
    } catch (error) {
      console.error('Failed to save text slot:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Book non trouvé</p>
          <Link to="/books" className="text-rose-500 hover:underline mt-2 inline-block">
            Retour à la liste
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/books"
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{book.name}</h1>
              <p className="text-sm text-gray-400">{pages.length} page{pages.length > 1 ? 's' : ''}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {pages.length > 0 && (
              <button
                onClick={() => setShowSlideshow(true)}
                className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                <Presentation className="w-4 h-4" />
                <span className="hidden sm:inline">Présenter</span>
              </button>
            )}

            <button
              onClick={() => setShowImageSelector(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              disabled={generatingSuggestions}
            >
              <Wand2 className="w-4 h-4" />
              <span className="hidden sm:inline">Assistant IA</span>
            </button>

            <button
              onClick={handleAddPage}
              className="flex items-center gap-2 px-3 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouvelle page</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Page thumbnails sidebar */}
        <aside className="w-48 bg-gray-900 border-r border-gray-800 overflow-y-auto p-4 flex-shrink-0">
          <PageThumbnails
            pages={pages}
            currentIndex={currentPageIndex}
            onSelectPage={setCurrentPageIndex}
            onReorder={handleReorderPages}
          />
        </aside>

        {/* Main editor area */}
        <main className="flex-1 flex flex-col">
          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 py-4 border-b border-gray-800">
            <button
              onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
              disabled={currentPageIndex === 0}
              className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <span className="text-gray-400">
              Page {currentPageIndex + 1} / {pages.length || 1}
            </span>

            <button
              onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
              disabled={currentPageIndex >= pages.length - 1}
              className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Double page spread */}
          <div className="flex-1 flex items-center justify-center p-8 bg-gray-950">
            {currentPage ? (
              <DoublePageSpread
                page={currentPage}
                template={templates.find(t => t.id === currentPage.template_id)}
                onSlotClick={handleSlotClick}
                onRemoveImage={handleRemoveImage}
                onEditAnnotation={handleEditAnnotation}
                onEditTextSlot={handleEditTextSlot}
              />
            ) : (
              <div className="text-center">
                <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 mb-4">Aucune page dans ce book</p>
                <button
                  onClick={handleAddPage}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg mx-auto"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une page
                </button>
              </div>
            )}
          </div>

          {/* Page actions */}
          {currentPage && (
            <div className="flex items-center justify-center gap-4 py-4 border-t border-gray-800">
              <button
                onClick={() => setShowTemplateSelector(true)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
              >
                <LayoutGrid className="w-4 h-4" />
                Changer le template
              </button>

              <button
                onClick={handleDeletePage}
                className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Image Selector Modal */}
      {showImageSelector && book && (
        <ImageSelector
          themes={themes}
          onSelect={selectedSlotId ? handleImageAssign : undefined}
          onGenerateSuggestions={!selectedSlotId ? handleGenerateSuggestions : undefined}
          onClose={() => {
            setShowImageSelector(false);
            setSelectedSlotId(null);
          }}
          mode={selectedSlotId ? 'single' : 'multiple'}
          bookTags={book.tags ? (() => {
            try {
              return JSON.parse(book.tags!) as string[];
            } catch {
              return null;
            }
          })() : null}
          bookMoods={book.mood ? (() => {
            try {
              return JSON.parse(book.mood!) as string[];
            } catch {
              return null;
            }
          })() : null}
        />
      )}

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <TemplateSelector
          templates={templates}
          currentTemplateId={currentPage?.template_id}
          onSelect={handleTemplateChange}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}

      {/* AI Suggestions Modal */}
      {showAISuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Suggestions de l'IA</h2>
                <p className="text-sm text-gray-400">{suggestions.length} pages suggérées</p>
              </div>
              <button
                onClick={() => setShowAISuggestions(false)}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 p-4 bg-gray-800 rounded-lg">
                <p className="text-gray-300">{suggestionsReasoning}</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {suggestions.map((suggestion, index) => (
                  <div key={index} className="bg-gray-800 rounded-lg p-3">
                    <div className="text-sm font-medium mb-2">{suggestion.template_name}</div>
                    <p className="text-xs text-gray-400">{suggestion.reasoning}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowAISuggestions(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handleApplySuggestions}
                  disabled={saving}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg disabled:opacity-50"
                >
                  {saving ? 'Application...' : 'Appliquer les suggestions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Annotation Editor Modal */}
      {showAnnotationEditor && annotationImage && (
        <AnnotationEditor
          annotation={currentPage?.page_data?.slots?.find(s => s.slot_id === annotationSlotId)?.annotation}
          image={annotationImage}
          onSave={handleSaveAnnotation}
          onClose={() => {
            setShowAnnotationEditor(false);
            setAnnotationSlotId(null);
            setAnnotationImage(null);
          }}
        />
      )}

      {/* Text Slot Editor Modal */}
      {showTextSlotEditor && editingTextSlotId && (
        <TextSlotEditor
          textSlot={currentPage?.page_data?.textSlots?.find(s => s.slot_id === editingTextSlotId)}
          slotId={editingTextSlotId}
          onSave={handleSaveTextSlot}
          onClose={() => {
            setShowTextSlotEditor(false);
            setEditingTextSlotId(null);
          }}
        />
      )}

      {/* Slideshow */}
      {showSlideshow && (
        <BookSlideshow
          pages={pages}
          templates={templates}
          initialPageIndex={currentPageIndex}
          onClose={() => setShowSlideshow(false)}
        />
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-gray-800 px-4 py-2 rounded-lg flex items-center gap-2">
          <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-rose-500"></div>
          <span className="text-sm">Enregistrement...</span>
        </div>
      )}
    </div>
  );
}
