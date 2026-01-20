import { useState } from 'react';
import { Link } from 'react-router-dom';
import { duplicatesApi, getThumbnailUrl, type DuplicateGroup, type DuplicateAnalysisResponse } from '../api/client';
import { ArrowLeft, Copy, Loader, RefreshCw, CheckCircle, XCircle, Trash2, AlertTriangle, HardDrive } from 'lucide-react';

export function DuplicateAnalysis() {
  const [analysis, setAnalysis] = useState<DuplicateAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  const analyzeDuplicates = async () => {
    try {
      setLoading(true);
      setMessage(null);
      setSelectedForDeletion(new Set());

      const result = await duplicatesApi.analyze();
      setAnalysis(result);

      if (result.duplicateGroups.length === 0) {
        setMessage({ type: 'success', text: 'Aucun doublon détecté !' });
      } else {
        setMessage({
          type: 'success',
          text: `Analyse terminée : ${result.stats.duplicateGroups} groupes de doublons trouvés (${result.stats.totalDuplicates} images en doublon)`
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      setMessage({ type: 'error', text: "Erreur lors de l'analyse des doublons." });
    } finally {
      setLoading(false);
    }
  };

  const toggleImageForDeletion = (imageId: string) => {
    const newSet = new Set(selectedForDeletion);
    if (newSet.has(imageId)) {
      newSet.delete(imageId);
    } else {
      newSet.add(imageId);
    }
    setSelectedForDeletion(newSet);
  };

  const selectAllButFirst = (group: DuplicateGroup) => {
    const newSet = new Set(selectedForDeletion);
    group.images.slice(1).forEach(img => newSet.add(img.id));
    setSelectedForDeletion(newSet);
  };

  const deselectGroup = (group: DuplicateGroup) => {
    const newSet = new Set(selectedForDeletion);
    group.images.forEach(img => newSet.delete(img.id));
    setSelectedForDeletion(newSet);
  };

  const deleteSelected = async () => {
    if (selectedForDeletion.size === 0) return;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedForDeletion.size} image(s) ?`)) {
      return;
    }

    try {
      setMessage(null);

      let successCount = 0;
      let failCount = 0;

      for (const imageId of selectedForDeletion) {
        try {
          await duplicatesApi.deleteImage(imageId);
          successCount++;
        } catch (error) {
          console.error(`Failed to delete ${imageId}:`, error);
          failCount++;
        }
      }

      setMessage({
        type: failCount === 0 ? 'success' : 'error',
        text: `${successCount} image(s) supprimée(s)${failCount > 0 ? `, ${failCount} échec(s)` : ''}`
      });

      // Re-analyze after deletion
      setSelectedForDeletion(new Set());
      await analyzeDuplicates();

    } catch (error) {
      console.error('Delete failed:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression.' });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const DuplicateGroupCard = ({ group, index }: { group: DuplicateGroup; index: number }) => {
    const selectedInGroup = group.images.filter(img => selectedForDeletion.has(img.id)).length;

    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-rose-500/20 text-rose-300 px-3 py-1 rounded-full text-sm font-semibold">
              Groupe #{index + 1}
            </div>
            <div className="text-gray-400 text-sm">
              {group.count} images identiques • {formatBytes(group.totalSize)} total
            </div>
          </div>

          <div className="flex gap-2">
            {selectedInGroup > 0 && (
              <span className="text-sm text-rose-400 font-semibold">
                {selectedInGroup} sélectionnée(s)
              </span>
            )}
            <button
              onClick={() => selectAllButFirst(group)}
              className="text-sm text-rose-400 hover:text-rose-300 transition-colors"
            >
              Sélectionner doublons
            </button>
            <span className="text-gray-600">|</span>
            <button
              onClick={() => deselectGroup(group)}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              Désélectionner
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {group.images.map((image, idx) => {
            const isSelected = selectedForDeletion.has(image.id);
            const isFirst = idx === 0;

            return (
              <div
                key={image.id}
                className={`relative border rounded-lg overflow-hidden transition-all cursor-pointer ${
                  isSelected
                    ? 'border-rose-500 bg-rose-500/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => toggleImageForDeletion(image.id)}
              >
                {/* Thumbnail */}
                <div className="aspect-square bg-gray-900">
                  <img
                    src={getThumbnailUrl(image.filename)}
                    alt={image.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Selection indicator */}
                <div className="absolute top-2 right-2">
                  {isSelected ? (
                    <CheckCircle className="w-6 h-6 text-rose-400" />
                  ) : (
                    <div className="w-6 h-6 border-2 border-gray-400 rounded-full bg-gray-900/50" />
                  )}
                </div>

                {/* First image badge */}
                {isFirst && (
                  <div className="absolute top-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-semibold">
                    Original (le plus ancien)
                  </div>
                )}

                {/* Image info */}
                <div className="p-3 bg-gray-900/80">
                  <div className="text-sm font-semibold text-white truncate mb-1">
                    {image.title}
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>
                      {new Date(image.upload_date).toLocaleDateString('fr-FR')}
                    </div>
                    <div>{formatBytes(image.fileSize)}</div>
                    {image.tags && image.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {image.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                        {image.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{image.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hash info */}
        <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-700">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Copy className="w-3 h-3" />
            <span className="font-mono">{group.hash.substring(0, 16)}...</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/books"
            className="inline-flex items-center text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Copy className="w-8 h-8 text-blue-500" />
                Analyse des Images en Doublon
              </h1>
              <p className="text-gray-400 mt-2">
                Détecte les images identiques par comparaison de hash SHA256
              </p>
            </div>

            <button
              onClick={analyzeDuplicates}
              disabled={loading}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Analyse en cours...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  {analysis ? 'Réanalyser' : 'Analyser'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Stats */}
        {analysis && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-white">{analysis.stats.totalImages}</div>
              <div className="text-sm text-gray-400">Images totales</div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-rose-400">{analysis.stats.duplicateGroups}</div>
              <div className="text-sm text-gray-400">Groupes de doublons</div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-orange-400">{analysis.stats.totalDuplicates}</div>
              <div className="text-sm text-gray-400">Images en doublon</div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-green-400">{formatBytes(analysis.stats.potentialSpaceSaved)}</div>
              <div className="text-sm text-gray-400">Espace récupérable</div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-blue-400">{selectedForDeletion.size}</div>
              <div className="text-sm text-gray-400">Sélectionnées</div>
            </div>
          </div>
        )}

        {/* Delete button */}
        {selectedForDeletion.size > 0 && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-300">
              <AlertTriangle className="w-5 h-5" />
              <span>{selectedForDeletion.size} image(s) sélectionnée(s) pour suppression</span>
            </div>
            <button
              onClick={deleteSelected}
              className="px-4 py-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 flex items-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Supprimer la sélection
            </button>
          </div>
        )}

        {/* Duplicate groups */}
        {analysis && analysis.duplicateGroups.length > 0 && (
          <div className="space-y-6">
            {analysis.duplicateGroups.map((group, index) => (
              <DuplicateGroupCard key={group.hash} group={group} index={index} />
            ))}
          </div>
        )}

        {/* No duplicates */}
        {analysis && analysis.duplicateGroups.length === 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Aucun doublon détecté
            </h3>
            <p className="text-gray-400">
              Toutes vos images sont uniques ! Aucune image identique n'a été trouvée.
            </p>
          </div>
        )}

        {/* Initial state */}
        {!analysis && !loading && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <Copy className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Prêt à analyser vos images ?
            </h3>
            <p className="text-gray-400 mb-6">
              Cliquez sur "Analyser" pour détecter les images identiques.<br />
              L'analyse compare le hash SHA256 de chaque fichier pour trouver les doublons exacts.
            </p>
            <div className="bg-gray-900 rounded p-4 inline-block">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <HardDrive className="w-4 h-4" />
                <span>L'analyse peut prendre quelques secondes selon le nombre d'images</span>
              </div>
            </div>
          </div>
        )}

        {/* Errors */}
        {analysis?.errors && analysis.errors.length > 0 && (
          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-300 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">{analysis.errors.length} erreur(s) détectée(s)</span>
            </div>
            <div className="text-sm text-yellow-200/80 space-y-1 max-h-40 overflow-y-auto">
              {analysis.errors.slice(0, 10).map((err, i) => (
                <div key={i} className="font-mono text-xs">{err}</div>
              ))}
              {analysis.errors.length > 10 && (
                <div className="text-xs text-yellow-300">...et {analysis.errors.length - 10} autres</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
