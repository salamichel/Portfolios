import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Upload, X, Camera, Settings } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onUploadClick: () => void;
}

export function Header({ searchQuery, onSearchChange, onUploadClick }: HeaderProps) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-gray-900/80 backdrop-blur-lg border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-amber-500 rounded-xl flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold hidden sm:block">Portfolio</h1>
        </div>

        {/* Search */}
        <div className={`flex-1 max-w-md ${showSearch ? 'block' : 'hidden sm:block'}`}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Rechercher par nom de fichier, titre, tags..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-10 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="sm:hidden p-2 hover:bg-gray-800 rounded-lg"
          >
            <Search className="w-5 h-5" />
          </button>

          <Link
            to="/admin/themes"
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title="Gérer les thèmes"
          >
            <Settings className="w-5 h-5" />
          </Link>

          <button
            onClick={onUploadClick}
            className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Upload className="w-5 h-5" />
            <span className="hidden sm:inline">Téléverser</span>
          </button>
        </div>
      </div>
    </header>
  );
}
