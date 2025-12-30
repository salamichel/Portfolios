import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cleanupApi, type SimilarityGroup, type CleanupAnalysisResponse } from '../api/client';
import { ArrowLeft, Sparkles, CheckCircle, XCircle, Loader, RefreshCw, Tag, Heart } from 'lucide-react';

export function CleanupAdmin() {
  const [analysis, setAnalysis] = useState<CleanupAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [selectedTagGroups, setSelectedTagGroups] = useState<Set<number>>(new Set());
  const [selectedMoodGroups, setSelectedMoodGroups] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
      onClick={() => onToggle(index)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {type === 'tag' ? (
            <Tag className="w-4 h-4 text-blue-600" />
          ) : (
            <Heart className="w-4 h-4 text-purple-600" />
          )}
          <span className="font-semibold text-lg">{group.canonical}</span>
          {selected ? (
            <CheckCircle className="w-5 h-5 text-blue-600" />
          ) : (
            <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
          )}
        </div>
      </div>

      <div className="mb-2">
        <span className="text-sm text-gray-600">Fusionne avec: </span>
        <div className="flex flex-wrap gap-1 mt-1">
          {group.similar.map((similar, i) => (
            <span
              key={i}
              className={`px-2 py-1 rounded text-sm ${
                type === 'tag'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-purple-100 text-purple-700'
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/books"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Link>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-yellow-500" />
                Nettoyage des Tags et Ambiances
              </h1>
              <p className="text-gray-600 mt-2">
                L'IA détecte automatiquement les tags et ambiances similaires pour les fusionner
              </p>
            </div>

            <button
              onClick={analyzeMetadata}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
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
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
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
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-gray-900">{analysis.stats.totalTags}</div>
              <div className="text-sm text-gray-600">Tags Total</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-gray-900">{analysis.stats.totalMoods}</div>
              <div className="text-sm text-gray-600">Ambiances Total</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">{analysis.stats.suggestedTagMerges}</div>
              <div className="text-sm text-gray-600">Fusions de Tags suggérées</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-purple-600">{analysis.stats.suggestedMoodMerges}</div>
              <div className="text-sm text-gray-600">Fusions d'Ambiances suggérées</div>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {analysis && (analysis.suggestions.tags.length > 0 || analysis.suggestions.moods.length > 0) && (
          <div className="space-y-8">
            {/* Tags */}
            {analysis.suggestions.tags.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-600" />
                    Fusions de Tags suggérées ({selectedTagGroups.size}/{analysis.suggestions.tags.length})
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedTagGroups(new Set(analysis.suggestions.tags.map((_, i) => i)))}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Tout sélectionner
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => setSelectedTagGroups(new Set())}
                      className="text-sm text-gray-600 hover:text-gray-700"
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
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Heart className="w-5 h-5 text-purple-600" />
                    Fusions d'Ambiances suggérées ({selectedMoodGroups.size}/{analysis.suggestions.moods.length})
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedMoodGroups(new Set(analysis.suggestions.moods.map((_, i) => i)))}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      Tout sélectionner
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => setSelectedMoodGroups(new Set())}
                      className="text-sm text-gray-600 hover:text-gray-700"
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
                  className="px-8 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 text-lg font-semibold"
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
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Aucune fusion suggérée
            </h3>
            <p className="text-gray-600">
              L'IA n'a détecté aucun tag ou ambiance similaire. Vos métadonnées sont déjà bien organisées !
            </p>
          </div>
        )}

        {/* Initial state */}
        {!analysis && !loading && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Sparkles className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Prêt à nettoyer vos métadonnées ?
            </h3>
            <p className="text-gray-600 mb-6">
              Cliquez sur "Analyser" pour que l'IA détecte automatiquement les tags et ambiances similaires.<br />
              Par exemple: "Vif", "Vivant", "Dynamique" peuvent être fusionnés en un seul terme.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
