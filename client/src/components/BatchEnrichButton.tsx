import { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { imagesApi } from '../api/client';

export function BatchEnrichButton({ onComplete }: { onComplete?: () => void }) {
  const [unenrichedCount, setUnenrichedCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ successful: number; failed: number; errors: Array<{ id: string; error: string }> } | null>(null);

  const loadUnenrichedCount = async () => {
    setLoading(true);
    try {
      const data = await imagesApi.getUnenriched();
      setUnenrichedCount(data.count);
    } catch (error) {
      console.error('Failed to load unenriched count:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnenrichedCount();
  }, []);

  const handleBatchEnrich = async () => {
    if (unenrichedCount === 0) return;

    setEnriching(true);
    setResult(null);
    setProgress({ current: 0, total: 0 });

    try {
      const { images } = await imagesApi.getUnenriched();
      const imageIds = images.map(img => img.id);
      setProgress({ current: 0, total: imageIds.length });

      const response = await imagesApi.batchEnrich(imageIds);
      setResult(response);
      setProgress({ current: response.successful + response.failed, total: response.total });

      // Refresh count after enrichment
      await loadUnenrichedCount();

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Batch enrichment failed:', error);
    } finally {
      setEnriching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement...
      </div>
    );
  }

  if (unenrichedCount === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-400">
        <CheckCircle className="w-4 h-4" />
        Toutes les images sont enrichies
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleBatchEnrich}
        disabled={enriching}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg transition-all font-medium"
      >
        {enriching ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Enrichissement en cours... ({progress.current}/{progress.total})
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Enrichir {unenrichedCount} image{unenrichedCount > 1 ? 's' : ''} manquante{unenrichedCount > 1 ? 's' : ''}
          </>
        )}
      </button>

      {result && (
        <div className="p-3 bg-gray-800 rounded-lg border border-gray-700 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400">{result.successful} réussie{result.successful > 1 ? 's' : ''}</span>
          </div>
          {result.failed > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400">{result.failed} échouée{result.failed > 1 ? 's' : ''}</span>
            </div>
          )}
          {result.errors.length > 0 && (
            <details className="text-xs text-gray-400 mt-2">
              <summary className="cursor-pointer hover:text-gray-300">Voir les erreurs</summary>
              <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((err, idx) => (
                  <div key={idx} className="font-mono">
                    {err.id}: {err.error}
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
