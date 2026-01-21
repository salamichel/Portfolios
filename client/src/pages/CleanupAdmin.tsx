import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cleanupApi, orphansApi, type SimilarityGroup, type CleanupAnalysisResponse, type OrphanAnalysisResponse } from '../api/client';
import { ArrowLeft, Sparkles, CheckCircle, XCircle, Loader, RefreshCw, Tag, Heart, AlertTriangle, Trash2 } from 'lucide-react';

export function CleanupAdmin() {
  const [analysis, setAnalysis] = useState<CleanupAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTagGroups, setSelectedTagGroups] = useState<Set<number>>(new Set());
  const [selectedMoodGroups, setSelectedMoodGroups] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Orphans state
  const [orphanAnalysis, setOrphanAnalysis] = useState<OrphanAnalysisResponse | null>(null);
  const [orphanLoading, setOrphanLoading] = useState(false);
  const [orphanCleaning, setOrphanCleaning] = useState(false);

  const analyzeMetadata = async () => {
    try {
      setLoading(true);
      setMessage(null);
      const result = await cleanupApi.analyze();
      setAnalysis(result);

      // Select all suggestions by default
      setSelectedTagGroups(new Set(result.suggestions.tags.map((_, i) => i)));
      setSelectedMoodGroups(new Set(result.suggestions.moods.map((_, i) => i)));

      setMessage({ type: 'success', text: 'Analyse terminée avec succès!' });
    } catch (error) {
      console.error('Analysis failed:', error);
      setMessage({ type: 'error', text: "Erreur lors de l'analyse. Vérifiez que votre clé API Gemini est configurée." });
    } finally {
      setLoading(false);
    }
  };

  const toggleTagGroup = (index: number) => {
    const newSet = new Set(selectedTagGroups);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedTagGroups(newSet);
  };

  const toggleMoodGroup = (index: number) => {
    const newSet = new Set(selectedMoodGroups);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setSelectedMoodGroups(newSet);
  };

  const applySelectedSuggestions = async () => {
    if (!analysis) return;

    try {
      setApplying(true);
      setMessage(null);

      const tagMerges = analysis.suggestions.tags.filter((_, i) => selectedTagGroups.has(i));
      const moodMerges = analysis.suggestions.moods.filter((_, i) => selectedMoodGroups.has(i));

      const result = await cleanupApi.applySuggestions(tagMerges, moodMerges);

      setMessage({
        type: 'success',
        text: `Fusion réussie! ${result.results.tags.length} tags et ${result.results.moods.length} moods ont été fusionnés.`
      });

      // Clear analysis to force re-analysis
      setAnalysis(null);
      setSelectedTagGroups(new Set());
      setSelectedMoodGroups(new Set());
    } catch (error) {
      console.error('Apply failed:', error);
      setMessage({ type: 'error', text: 'Erreur lors de l\'application des fusions.' });
    } finally {
      setApplying(false);
    }
  };

  // Orphan functions
  const analyzeOrphans = async () => {
    try {
      setOrphanLoading(true);
      setMessage(null);
      const result = await orphansApi.analyze();
      setOrphanAnalysis(result);

      if (result.orphans.length > 0) {
        setMessage({
          type: 'error',
          text: `${result.orphans.length} image(s) orpheline(s) détectée(s) en base de données (${result.stats.percentageOrphaned}% du total)`
        });
      } else {
        setMessage({
          type: 'success',
          text: 'Aucune image orpheline détectée. Toutes les entrées en base de données correspondent à des fichiers existants.'
        });
      }
    } catch (error) {
      console.error('Orphan analysis failed:', error);
      setMessage({ type: 'error', text: "Erreur lors de l'analyse des images orphelines." });
    } finally {
      setOrphanLoading(false);
    }
  };

  const cleanupOrphans = async () => {
    if (!orphanAnalysis || orphanAnalysis.orphans.length === 0) return;

    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${orphanAnalysis.orphans.length} image(s) orpheline(s) de la base de données ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      setOrphanCleaning(true);
      setMessage(null);

      const result = await orphansApi.cleanup();

      setMessage({
        type: 'success',
        text: result.message
      });

      // Clear analysis
      setOrphanAnalysis(null);
    } catch (error) {
      console.error('Orphan cleanup failed:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la suppression des images orphelines.' });
    } finally {
      setOrphanCleaning(false);
    }
  };

  const SuggestionCard = ({
    group,
    index,
    selected,
    onToggle,
    type
  }: {
    group: SimilarityGroup;
    index: number;
    selected: boolean;
    onToggle: (index: number) => void;
    type: 'tag' | 'mood';
  }) => (
    <div
      className={`border rounded-lg p-4 transition-all cursor-pointer ${
        selected
          ? type === 'tag'
            ? 'border-rose-500 bg-rose-500/10'
            : 'border-purple-500 bg-purple-500/10'
          : 'border-gray-700 hover:border-gray-600 bg-gray-900/50'
      }`}
      onClick={() => onToggle(index)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {type === 'tag' ? (
            <Tag className="w-4 h-4 text-rose-400" />
          ) : (
            <Heart className="w-4 h-4 text-purple-400" />
          )}
          <span className="font-semibold text-lg text-white">{group.canonical}</span>
          {selected ? (
            <CheckCircle className={`w-5 h-5 ${type === 'tag' ? 'text-rose-400' : 'text-purple-400'}`} />
          ) : (
            <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />
          )}
        </div>
      </div>

      <div className="mb-2">
        <span className="text-sm text-gray-400">Fusionne avec: </span>
        <div className="flex flex-wrap gap-1 mt-1">
          {group.similar.map((similar, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded text-sm ${
                type === 'tag'
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-purple-500/20 text-purple-300'
              }`}
            >
              {similar}
            </span>
          ))}
        </div>
      </div>

      <div className="text-sm text-gray-500 italic">
        {group.reason}
      </div>
    </div>
  );

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
                <Sparkles className="w-8 h-8 text-yellow-500" />
                Nettoyage des Tags et Ambiances
              </h1>
              <p className="text-gray-400 mt-2">
                L'IA détecte automatiquement les tags et ambiances similaires pour les fusionner
              </p>
            </div>

            <button
              onClick={analyzeMetadata}
              disabled={loading}
              className="px-6 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 disabled:bg-gray-700 disabled:text-gray-500 flex items-center gap-2 transition-colors"
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

        {/* Orphaned Images Section */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-orange-400" />
                Images Orphelines
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Détecte et supprime les entrées en base de données sans fichiers physiques
              </p>
            </div>

            <button
              onClick={analyzeOrphans}
              disabled={orphanLoading}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:bg-gray-700 disabled:text-gray-500 flex items-center gap-2 transition-colors"
            >
              {orphanLoading ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Analyse...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  Analyser
                </>
              )}
            </button>
          </div>

          {orphanAnalysis && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <div className="text-2xl font-bold text-white">{orphanAnalysis.stats.totalImages}</div>
                  <div className="text-sm text-gray-400">Images Total</div>
                </div>
                <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <div className="text-2xl font-bold text-orange-400">{orphanAnalysis.stats.orphanedImages}</div>
                  <div className="text-sm text-gray-400">Orphelines</div>
                </div>
                <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <div className="text-2xl font-bold text-orange-400">{orphanAnalysis.stats.percentageOrphaned}%</div>
                  <div className="text-sm text-gray-400">Pourcentage</div>
                </div>
              </div>

              {/* Orphans list */}
              {orphanAnalysis.orphans.length > 0 && (
                <div className="space-y-3">
                  <div className="max-h-64 overflow-y-auto space-y-2 p-2 bg-gray-900 rounded-lg">
                    {orphanAnalysis.orphans.map((orphan) => (
                      <div
                        key={orphan.id}
                        className="flex items-center justify-between p-3 bg-gray-800 rounded border border-gray-700"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{orphan.title || 'Sans titre'}</div>
                          <div className="text-sm text-gray-500 truncate">{orphan.filename}</div>
                          {orphan.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {orphan.tags.slice(0, 3).map((tag, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded">
                                  {tag}
                                </span>
                              ))}
                              {orphan.tags.length > 3 && (
                                <span className="text-xs text-gray-500">+{orphan.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={cleanupOrphans}
                    disabled={orphanCleaning}
                    className="w-full px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 flex items-center justify-center gap-2 transition-colors font-semibold"
                  >
                    {orphanCleaning ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Suppression en cours...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5" />
                        Supprimer les {orphanAnalysis.orphans.length} image(s) orpheline(s)
                      </>
                    )}
                  </button>
                </div>
              )}

              {orphanAnalysis.orphans.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-2" />
                  <p className="text-green-400 font-medium">Aucune image orpheline détectée</p>
                  <p className="text-gray-500 text-sm">Toutes vos entrées correspondent à des fichiers existants</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Stats */}
        {analysis && (
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-white">{analysis.stats.totalTags}</div>
              <div className="text-sm text-gray-400">Tags Total</div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-white">{analysis.stats.totalMoods}</div>
              <div className="text-sm text-gray-400">Ambiances Total</div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-rose-400">{analysis.stats.suggestedTagMerges}</div>
              <div className="text-sm text-gray-400">Fusions de Tags suggérées</div>
            </div>
            <div className="bg-gray-800 p-6 rounded-lg border border-gray-700">
              <div className="text-2xl font-bold text-purple-400">{analysis.stats.suggestedMoodMerges}</div>
              <div className="text-sm text-gray-400">Fusions d'Ambiances suggérées</div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {analysis && (analysis.suggestions.tags.length > 0 || analysis.suggestions.moods.length > 0) && (
          <div className="space-y-8">
            {/* Tags */}
            {analysis.suggestions.tags.length > 0 && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Tag className="w-5 h-5 text-rose-400" />
                    Fusions de Tags suggérées ({selectedTagGroups.size}/{analysis.suggestions.tags.length})
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTagGroups(new Set(analysis.suggestions.tags.map((_, i) => i)))}
                      className="text-sm text-rose-400 hover:text-rose-300 transition-colors"
                    >
                      Tout sélectionner
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => setSelectedTagGroups(new Set())}
                      className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      Tout désélectionner
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.suggestions.tags.map((group, index) => (
                    <SuggestionCard
                      key={index}
                      group={group}
                      index={index}
                      selected={selectedTagGroups.has(index)}
                      onToggle={toggleTagGroup}
                      type="tag"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Moods */}
            {analysis.suggestions.moods.length > 0 && (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Heart className="w-5 h-5 text-purple-400" />
                    Fusions d'Ambiances suggérées ({selectedMoodGroups.size}/{analysis.suggestions.moods.length})
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedMoodGroups(new Set(analysis.suggestions.moods.map((_, i) => i)))}
                      className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      Tout sélectionner
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => setSelectedMoodGroups(new Set())}
                      className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      Tout désélectionner
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.suggestions.moods.map((group, index) => (
                    <SuggestionCard
                      key={index}
                      group={group}
                      index={index}
                      selected={selectedMoodGroups.has(index)}
                      onToggle={toggleMoodGroup}
                      type="mood"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Apply Button */}
            {(selectedTagGroups.size > 0 || selectedMoodGroups.size > 0) && (
              <div className="flex justify-center">
                <button
                  onClick={applySelectedSuggestions}
                  disabled={applying}
                  className="px-8 py-4 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-700 disabled:text-gray-500 flex items-center gap-2 text-lg font-semibold transition-colors"
                >
                  {applying ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Application en cours...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Appliquer les fusions sélectionnées ({selectedTagGroups.size + selectedMoodGroups.size})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* No suggestions */}
        {analysis && analysis.suggestions.tags.length === 0 && analysis.suggestions.moods.length === 0 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Aucune fusion suggérée
            </h3>
            <p className="text-gray-400">
              L'IA n'a détecté aucun tag ou ambiance similaire. Vos métadonnées sont déjà bien organisées !
            </p>
          </div>
        )}

        {/* Initial state */}
        {!analysis && !loading && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-12 text-center">
            <Sparkles className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              Prêt à nettoyer vos métadonnées ?
            </h3>
            <p className="text-gray-400 mb-6">
              Cliquez sur "Analyser" pour que l'IA détecte automatiquement les tags et ambiances similaires.<br />
              Par exemple: "Vif", "Vivant", "Dynamique" peuvent être fusionnés en un seul terme.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
