import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { ThemeManager } from './components/ThemeManager';
import { ImageGallery } from './components/ImageGallery';
import { DropZone } from './components/DropZone';
import { themesApi } from './api/client';
import type { Theme } from './types';
import { X, Menu } from 'lucide-react';

function App() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadThemes = useCallback(async () => {
    try {
      const data = await themesApi.getAll();
      setThemes(data);
    } catch (error) {
      console.error('Failed to load themes:', error);
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const handleUploadComplete = () => {
    setShowUpload(false);
    setRefreshKey(k => k + 1);
    loadThemes();
  };

  const handleThemesChange = () => {
    loadThemes();
  };

  const handleImageUpdate = () => {
    loadThemes();
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onUploadClick={() => setShowUpload(true)}
      />

      <div className="flex">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="lg:hidden fixed bottom-4 left-4 z-30 p-3 bg-rose-500 rounded-full shadow-lg"
        >
          <Menu className="w-6 h-6" />
        </button>

        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-30 w-72 bg-gray-900 border-r border-gray-800
            transform transition-transform duration-300 lg:transform-none
            ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            overflow-y-auto scrollbar-thin pt-4 lg:pt-0
          `}
        >
          <div className="p-4 lg:sticky lg:top-[73px]">
            <ThemeManager
              themes={themes}
              selectedTheme={selectedTheme}
              onSelectTheme={(id) => {
                setSelectedTheme(id);
                setShowSidebar(false);
              }}
              onThemesChange={handleThemesChange}
            />
          </div>
        </aside>

        {/* Sidebar overlay for mobile */}
        {showSidebar && (
          <div
            className="lg:hidden fixed inset-0 z-20 bg-black/50"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          <ImageGallery
            key={refreshKey}
            themeId={selectedTheme || undefined}
            themes={themes}
            searchQuery={searchQuery}
            onImageUpdate={handleImageUpdate}
          />
        </main>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Téléverser des images</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="p-2 hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <DropZone themes={themes} onUploadComplete={handleUploadComplete} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
