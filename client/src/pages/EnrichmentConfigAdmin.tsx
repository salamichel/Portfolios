import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { enrichmentConfigsApi } from '../api/client';
import type { EnrichmentConfig, GeminiModel } from '../types';
import { ArrowLeft, Plus, Trash2, Check, Edit2, Star, Sparkles, Save, X } from 'lucide-react';

const MODEL_LABELS: Record<GeminiModel, string> = {
  'gemini-3-flash-preview': 'Gemini 3 Flash (Rapide)',
  'gemini-2.5-pro': 'Gemini 2.5 Pro (Puissant)',
  'gemini-2.5-flash': 'Gemini 2.5 Flash (Equilibré)',
  'gemini-3-pro-preview': 'Gemini 3 Pro (Premium)'
};

export function EnrichmentConfigAdmin() {
  const [configs, setConfigs] = useState<EnrichmentConfig[]>([]);
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [formModel, setFormModel] = useState<GeminiModel>('gemini-3-flash-preview');
  const [formIsDefault, setFormIsDefault] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configsData, modelsData] = await Promise.all([
        enrichmentConfigsApi.getAll(),
        enrichmentConfigsApi.getModels()
      ]);
      setConfigs(configsData);
      setModels(modelsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      setMessage({ type: 'error', text: 'Erreur lors du chargement des configurations' });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (config: EnrichmentConfig) => {
    setEditingId(config.id);
    setFormName(config.name);
    setFormPrompt(config.prompt);
    setFormModel(config.model);
    setFormIsDefault(config.is_default);
    setShowCreate(false);
  };

  const startCreate = () => {
    setShowCreate(true);
    setEditingId(null);
    setFormName('');
    setFormPrompt('');
    setFormModel('gemini-3-flash-preview');
    setFormIsDefault(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setShowCreate(false);
    setFormName('');
    setFormPrompt('');
    setFormModel('gemini-3-flash-preview');
    setFormIsDefault(false);
  };

  const saveConfig = async () => {
    try {
      if (!formName.trim() || !formPrompt.trim()) {
        setMessage({ type: 'error', text: 'Le nom et le prompt sont requis' });
        return;
      }

      if (showCreate) {
        await enrichmentConfigsApi.create({
          name: formName.trim(),
          prompt: formPrompt.trim(),
          model: formModel,
          is_default: formIsDefault
        });
        setMessage({ type: 'success', text: 'Configuration créée avec succès' });
      } else if (editingId) {
        await enrichmentConfigsApi.update(editingId, {
          name: formName.trim(),
          prompt: formPrompt.trim(),
          model: formModel,
          is_default: formIsDefault
        });
        setMessage({ type: 'success', text: 'Configuration mise à jour' });
      }

      cancelEdit();
      loadData();
    } catch (error) {
      console.error('Failed to save:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde' });
    }
  };

  const deleteConfig = async (id: string) => {
    if (!confirm('Supprimer cette configuration ?')) return;

    try {
      await enrichmentConfigsApi.delete(id);
      setMessage({ type: 'success', text: 'Configuration supprimée' });
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
      setMessage({ type: 'error', text: 'Impossible de supprimer (peut-être la dernière configuration)' });
    }
  };

  const setAsDefault = async (id: string) => {
    try {
      await enrichmentConfigsApi.setDefault(id);
      setMessage({ type: 'success', text: 'Configuration définie par défaut' });
      loadData();
    } catch (error) {
      console.error('Failed to set default:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la définition par défaut' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-rose-500" />
                <h1 className="text-xl font-semibold">Configuration IA</h1>
              </div>
            </div>
            <button
              onClick={startCreate}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nouvelle configuration
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${
              message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        {/* Create/Edit Form */}
        {(showCreate || editingId) && (
          <div className="mb-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-lg font-semibold mb-4">
              {showCreate ? 'Nouvelle configuration' : 'Modifier la configuration'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nom</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-rose-500"
                  placeholder="Ma configuration"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Modèle Gemini</label>
                <select
                  value={formModel}
                  onChange={(e) => setFormModel(e.target.value as GeminiModel)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-rose-500"
                >
                  {models.map((model) => (
                    <option key={model} value={model}>
                      {MODEL_LABELS[model] || model}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Prompt</label>
                <textarea
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  rows={10}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-rose-500 font-mono text-sm"
                  placeholder="Analysez cette image artistique/photographie et fournissez..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Le prompt sera complété automatiquement avec les tags/moods existants et le format de réponse JSON.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-rose-500 focus:ring-rose-500"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-300">
                  Définir comme configuration par défaut
                </label>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={saveConfig}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Configs List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Configurations existantes</h2>

          {configs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              Aucune configuration. Créez-en une pour commencer.
            </div>
          ) : (
            <div className="grid gap-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className={`bg-gray-800 rounded-lg p-6 border ${
                    config.is_default ? 'border-rose-500' : 'border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{config.name}</h3>
                        {config.is_default && (
                          <span className="flex items-center gap-1 text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded">
                            <Star className="w-3 h-3" />
                            Par défaut
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 mb-3">
                        Modèle: <span className="text-gray-300">{MODEL_LABELS[config.model] || config.model}</span>
                      </div>
                      <div className="bg-gray-900 rounded p-3 text-sm text-gray-400 font-mono max-h-32 overflow-y-auto">
                        {config.prompt.substring(0, 300)}
                        {config.prompt.length > 300 && '...'}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {!config.is_default && (
                        <button
                          onClick={() => setAsDefault(config.id)}
                          className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-yellow-400"
                          title="Définir par défaut"
                        >
                          <Star className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(config)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                        title="Modifier"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteConfig(config.id)}
                        className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="font-semibold mb-2">Comment ça marche ?</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• La configuration par défaut est utilisée pour l'enrichissement automatique des images</li>
            <li>• Vous pouvez créer plusieurs configurations avec différents prompts et modèles</li>
            <li>• Le prompt définit les instructions envoyées à l'IA pour analyser vos images</li>
            <li>• Chaque image garde une trace du prompt utilisé pour son enrichissement</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
