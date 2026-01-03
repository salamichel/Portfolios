import { useState } from 'react';
import { X, FileDown, Loader2, Check } from 'lucide-react';
import { booksApi, type PdfExportResult } from '../../api/client';

interface PdfExportModalProps {
  bookId: string;
  bookName: string;
  onClose: () => void;
}

type ExportStatus = 'idle' | 'generating' | 'success' | 'error';

export function PdfExportModal({ bookId, bookName, onClose }: PdfExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<'landscape' | 'portrait'>('landscape');
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

  const handleExport = async () => {
    setStatus('generating');
    setError(null);

    try {
      const exportResult = await booksApi.exportPdf(bookId, selectedFormat);
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
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
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
                Choisissez le format pour exporter <strong>{bookName}</strong> en PDF haute qualité (300 DPI).
              </p>

              <div className="space-y-3">
                {formats.map((format) => (
                  <label
                    key={format.id}
                    className={`block p-4 border-2 rounded-lg cursor-pointer transition-all ${
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
                        <p className="text-sm text-gray-500 mt-1">{format.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
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
