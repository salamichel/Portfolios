import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Plus, BookOpen, Trash2, Edit2, ArrowLeft, Calendar, FileText } from 'lucide-react';
import { booksApi, getThumbnailUrl } from '../api/client';
import type { Book } from '../types';
import TagMoodSelector from '../components/book/TagMoodSelector';

export function BookList() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBookName, setNewBookName] = useState('');
  const [newBookDescription, setNewBookDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const loadBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await booksApi.getAll();
      setBooks(data);
    } catch (error) {
      console.error('Failed to load books:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookName.trim()) return;

    try {
      setCreating(true);
      const book = await booksApi.create({
        name: newBookName.trim(),
        description: newBookDescription.trim() || undefined,
        tags: selectedTags.length > 0 ? JSON.stringify(selectedTags) : undefined,
        mood: selectedMoods.length > 0 ? JSON.stringify(selectedMoods) : undefined
      });
      setBooks([book, ...books]);
      setShowCreateModal(false);
      setNewBookName('');
      setNewBookDescription('');
      setSelectedTags([]);
      setSelectedMoods([]);
    } catch (error) {
      console.error('Failed to create book:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBook = async (book: Book) => {
    if (!confirm(`Supprimer le book "${book.name}" ?`)) return;

    try {
      await booksApi.delete(book.id);
      setBooks(books.filter(b => b.id !== book.id));
    } catch (error) {
      console.error('Failed to delete book:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Mes Books</h1>
                <p className="text-sm text-gray-400">Mise en page de portfolios</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">Nouveau book</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-gray-300 mb-2">Aucun book</h2>
            <p className="text-gray-500 mb-6">Créez votre premier book pour commencer la mise en page</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Créer un book
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map(book => (
              <div
                key={book.id}
                className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-gray-600 transition-colors group"
              >
                {/* Preview */}
                <Link
                  to={`/books/${book.id}`}
                  className="block aspect-video bg-gray-900 relative overflow-hidden"
                >
                  {book.cover_image_id ? (
                    <img
                      src={getThumbnailUrl(book.cover_image_id)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-24 h-16 bg-gray-800 rounded-lg flex items-center justify-center shadow-lg">
                        <BookOpen className="w-8 h-8 text-gray-600" />
                      </div>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-medium">Ouvrir</span>
                  </div>
                </Link>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Link
                      to={`/books/${book.id}`}
                      className="font-medium text-white hover:text-rose-400 transition-colors"
                    >
                      {book.name}
                    </Link>

                    <div className="flex items-center gap-1">
                      <Link
                        to={`/books/${book.id}`}
                        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-4 h-4 text-gray-400" />
                      </Link>
                      <button
                        onClick={() => handleDeleteBook(book)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {book.description && (
                    <p className="text-sm text-gray-400 mb-3 line-clamp-2">{book.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {book.page_count || 0} page{(book.page_count || 0) > 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(book.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md">
            <div className="border-b border-gray-800 p-4">
              <h2 className="text-xl font-semibold">Nouveau book</h2>
            </div>

            <form onSubmit={handleCreateBook} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nom du book
                </label>
                <input
                  type="text"
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  placeholder="Mon portfolio 2024"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={newBookDescription}
                  onChange={(e) => setNewBookDescription(e.target.value)}
                  placeholder="Une brève description..."
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="mb-6">
                <TagMoodSelector
                  selectedTags={selectedTags}
                  selectedMoods={selectedMoods}
                  onTagsChange={setSelectedTags}
                  onMoodsChange={setSelectedMoods}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newBookName.trim() || creating}
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Création...' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
