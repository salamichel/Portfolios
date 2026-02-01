import { useState } from 'react';
import { X, FileDown, Loader2, Check, BookOpen, File } from 'lucide-react';
import { booksApi, type PdfExportResult } from '../../api/client';

interface PdfExportModalProps {
  bookId: string;
  bookName: string;
  onClose: () => void;
}

type ExportStatus = 'idle' | 'generating' | 'success' | 'error';

export function PdfExportModal({ bookId, bookName, onClose }: PdfExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'landscape' | 'portrait'>('landscape');
  const [selectedPageMode, setSelectedPageMode] = useState<'spread' | 'single'>('spread');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [result, setResult] = useState<PdfExportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formats = [
    {
      id: 'landscape' as const,
      name: 'Grand paysage',
      dimensions: '29.7 x 21 cm',
      description: 'Format idéal pour mettre en avant de grandes photos de qualité',
    },
    {
      id: 'portrait' as const,
      name: 'Grand portrait',
      dimensions: '21 x 29.7 cm',
      description: 'Format adapté pour un album photo de mariage',
    },
  ];

  const pageModes = [
    {
      id: 'spread' as const,
      name: 'Pages doubles',
      description: 'Chaque spread sur une page large (idéal pour écran)',
      icon: BookOpen,
    },
    {
      id: 'single' as const,
      name: 'Pages simples',
      description: 'Pages gauche et droite séparées (idéal pour impression)',
      icon: File,
    },
  ];

  const handleExport = async () => {
    setStatus('generating');
    setError(null);

    try {
      const exportResult = await booksApi.exportPdf(bookId, selectedFormat, selectedPageMode);
      setResult(exportResult);
      setStatus('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération du PDF');
      setStatus('error');
    }
  };

  const handleDownload = () => {
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">
            Exporter en PDF
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {status === 'idle' && (
            <>
              <p className="text-sm text-gray-600 mb-4">
                Choisissez les options pour exporter <strong>{bookName}</strong> en PDF haute qualité (300 DPI).
              </p>

              {/* Format selection */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Format</h3>
                <div className="space-y-2">
                  {formats.map((format) => (
                    <label
                      key={format.id}
                      className={`block p-3 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedFormat === format.id
                          ? 'border-rose-500 bg-rose-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="format"
                          value={format.id}
                          checked={selectedFormat === format.id}
                          onChange={() => setSelectedFormat(format.id)}
                          className="mt-1 text-rose-500 focus:ring-rose-500"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{format.name}</span>
                            <span className="text-sm text-gray-500">({format.dimensions})</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">{format.description}</p>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Page mode selection */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Mode de page</h3>
                <div className="grid grid-cols-2 gap-3">
                  {pageModes.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <label
                        key={mode.id}
                        className={`block p-3 border-2 rounded-lg cursor-pointer transition-all text-center ${
                          selectedPageMode === mode.id
                            ? 'border-rose-500 bg-rose-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="pageMode"
                          value={mode.id}
                          checked={selectedPageMode === mode.id}
                          onChange={() => setSelectedPageMode(mode.id)}
                          className="sr-only"
                        />
                        <Icon className={`w-6 h-6 mx-auto mb-2 ${
                          selectedPageMode === mode.id ? 'text-rose-500' : 'text-gray-400'
                        }`} />
                        <span className={`block font-medium text-sm ${
                          selectedPageMode === mode.id ? 'text-rose-700' : 'text-gray-700'
                        }`}>
                          {mode.name}
                        </span>
                        <span className="block text-xs text-gray-500 mt-1">
                          {mode.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {status === 'generating' && (
            <div className="py-8 text-center">
              <Loader2 className="w-12 h-12 text-rose-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">Génération du PDF en cours...</p>
              <p className="text-sm text-gray-400 mt-2">Cela peut prendre quelques instants</p>
            </div>
          )}

          {status === 'success' && result && (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">PDF généré avec succès !</p>
              <p className="text-sm text-gray-500 mb-4">
                Taille du fichier : {formatFileSize(result.size)}
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
              >
                <FileDown className="w-5 h-5" />
                Télécharger le PDF
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-600" />
              </div>
              <p className="text-lg font-medium text-gray-900 mb-2">Erreur</p>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Réessayer
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {status === 'idle' && (
          <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Générer le PDF
            </button>
          </div>
        )}

        {(status === 'success' || status === 'error') && (
          <div className="flex justify-center p-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
