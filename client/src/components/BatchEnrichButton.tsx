import { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle, XCircle, RefreshCw, ChevronDown } from 'lucide-react';
import { imagesApi, enrichmentConfigsApi } from '../api/client';
import type { EnrichmentConfig } from '../types';

interface BatchEnrichButtonProps {
  onComplete?: () => void;
  selectedImageIds?: string[];
  totalImageCount?: number;
}

export function BatchEnrichButton({ onComplete, selectedImageIds, totalImageCount }: BatchEnrichButtonProps) {
  const [unenrichedCount, setUnenrichedCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [result, setResult] = useState<{ successful: number; failed: number; errors: Array<{ id: string; error: string }> } | null>(null);
  const [configs, setConfigs] = useState<EnrichmentConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | undefined>(undefined);
  const [showConfigSelect, setShowConfigSelect] = useState(false);
  const [mode, setMode] = useState<'unenriched' | 'selected' | 'all'>('unenriched');

  const loadData = async () => {
    setLoading(true);
    try {
      const [unenrichedData, configsData] = await Promise.all([
        imagesApi.getUnenriched(),
        enrichmentConfigsApi.getAll()
      ]);
      setUnenrichedCount(unenrichedData.count);
      setConfigs(configsData);
      // Set default config
      const defaultConfig = configsData.find(c => c.is_default);
      if (defaultConfig) {
        setSelectedConfigId(defaultConfig.id);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update mode based on selected images
  useEffect(() => {
    if (selectedImageIds && selectedImageIds.length > 0) {
      setMode('selected');
    } else {
      setMode('unenriched');
    }
  }, [selectedImageIds]);

  const handleBatchEnrich = async () => {
    let imageIds: string[] = [];

    if (mode === 'selected' && selectedImageIds && selectedImageIds.length > 0) {
      imageIds = selectedImageIds;
    } else if (mode === 'all') {
      const { image_ids } = await imagesApi.enrichAll();
      imageIds = image_ids;
    } else {
      const { images } = await imagesApi.getUnenriched();
      imageIds = images.map(img => img.id);
    }

    if (imageIds.length === 0) return;

    setEnriching(true);
    setResult(null);
    setProgress({ current: 0, total: imageIds.length });

    try {
      const response = await imagesApi.batchEnrich(imageIds, selectedConfigId);
      setResult(response);
      setProgress({ current: response.successful + response.failed, total: response.total });

      // Refresh count after enrichment
      await loadData();

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

  const selectedConfig = configs.find(c => c.id === selectedConfigId);
  const hasSelectedImages = selectedImageIds && selectedImageIds.length > 0;

  const getButtonLabel = () => {
    if (enriching) {
      return `Enrichissement en cours... (${progress.current}/${progress.total})`;
    }
    if (mode === 'selected' && hasSelectedImages) {
      return `Ré-enrichir ${selectedImageIds!.length} image${selectedImageIds!.length > 1 ? 's' : ''} sélectionnée${selectedImageIds!.length > 1 ? 's' : ''}`;
    }
    if (mode === 'all') {
      return `Tout ré-enrichir (${totalImageCount || 0} images)`;
    }
    if (unenrichedCount === 0) {
      return 'Toutes les images sont enrichies';
    }
    return `Enrichir ${unenrichedCount} image${unenrichedCount > 1 ? 's' : ''} manquante${unenrichedCount > 1 ? 's' : ''}`;
  };

  const isDisabled = enriching || (mode === 'unenriched' && unenrichedCount === 0);

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex flex-wrap gap-2 text-sm">
        <button
          onClick={() => setMode('unenriched')}
          className={`px-3 py-1 rounded-full transition-colors ${
            mode === 'unenriched'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Non enrichies ({unenrichedCount})
        </button>
        {hasSelectedImages && (
          <button
            onClick={() => setMode('selected')}
            className={`px-3 py-1 rounded-full transition-colors ${
              mode === 'selected'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Sélection ({selectedImageIds?.length})
          </button>
        )}
        <button
          onClick={() => setMode('all')}
          className={`px-3 py-1 rounded-full transition-colors ${
            mode === 'all'
              ? 'bg-rose-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          <RefreshCw className="w-3 h-3 inline mr-1" />
          Tout ({totalImageCount || 0})
        </button>
      </div>

      {/* Config selector */}
      {configs.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowConfigSelect(!showConfigSelect)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm text-left hover:bg-gray-600 transition-colors"
          >
            <span className="truncate">
              {selectedConfig ? selectedConfig.name : 'Sélectionner une configuration'}
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showConfigSelect ? 'rotate-180' : ''}`} />
          </button>
          {showConfigSelect && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {configs.map((config) => (
                <button
                  key={config.id}
                  onClick={() => {
                    setSelectedConfigId(config.id);
                    setShowConfigSelect(false);
                  }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-gray-700 flex items-center justify-between ${
                    selectedConfigId === config.id ? 'bg-gray-700' : ''
                  }`}
                >
                  <span>{config.name}</span>
                  {config.is_default && (
                    <span className="text-xs text-rose-400">par défaut</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Enrich button */}
      <button
        onClick={handleBatchEnrich}
        disabled={isDisabled}
        className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all font-medium ${
          mode === 'all'
            ? 'bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700'
            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
        } disabled:from-gray-600 disabled:to-gray-600 text-white`}
      >
        {enriching ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : mode === 'all' ? (
          <RefreshCw className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {getButtonLabel()}
      </button>

      {/* Result */}
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
