import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { FamilyMember, TrainingImage, Image } from '../types';

export default function FamilyAdmin() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [trainingImages, setTrainingImages] = useState<TrainingImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isUploadingTraining, setIsUploadingTraining] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relationship: '', notes: '' });

  // Batch recognition state
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [batchSize, setBatchSize] = useState(5); // Réduit à 5 pour éviter les erreurs Gemini
  const [recognitionProgress, setRecognitionProgress] = useState({ current: 0, total: 0 });
  const [recognitionLogs, setRecognitionLogs] = useState<string[]>([]);
  const [recognitionResults, setRecognitionResults] = useState<any>(null);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    if (selectedMember) {
      loadTrainingImages(selectedMember.id);
    }
  }, [selectedMember]);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/family/members');
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load family members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrainingImages = async (memberId: string) => {
    try {
      const response = await api.get(`/family/members/${memberId}/training-images`);
      setTrainingImages(response.data);
    } catch (error) {
      console.error('Failed to load training images:', error);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/family/members', newMember);
      setMembers([...members, response.data]);
      setIsAddingMember(false);
      setNewMember({ name: '', relationship: '', notes: '' });
    } catch (error) {
      console.error('Failed to create family member:', error);
      alert('Échec de la création du membre de famille');
    }
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce membre ?')) return;

    try {
      await api.delete(`/family/members/${id}`);
      setMembers(members.filter(m => m.id !== id));
      if (selectedMember?.id === id) {
        setSelectedMember(null);
        setTrainingImages([]);
      }
    } catch (error) {
      console.error('Failed to delete member:', error);
      alert('Échec de la suppression du membre');
    }
  };

  const handleUploadTrainingImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedMember || !e.target.files || e.target.files.length === 0) return;

    try {
      setIsUploadingTraining(true);

      const formData = new FormData();
      formData.append('family_member_id', selectedMember.id);

      Array.from(e.target.files).forEach(file => {
        formData.append('images', file);
      });

      await api.post('/family/training-images/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      loadTrainingImages(selectedMember.id);
      loadMembers(); // Refresh counts

      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error('Failed to upload training images:', error);
      alert('Échec de l\'upload des images d\'entraînement');
    } finally {
      setIsUploadingTraining(false);
    }
  };

  const handleDeleteTrainingImage = async (id: string) => {
    if (!confirm('Supprimer cette image d\'entraînement ?')) return;

    try {
      await api.delete(`/family/training-images/${id}`);
      setTrainingImages(trainingImages.filter(t => t.id !== id));
      loadMembers(); // Refresh counts
    } catch (error) {
      console.error('Failed to delete training image:', error);
      alert('Échec de la suppression de l\'image');
    }
  };

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('fr-FR');
    setRecognitionLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleBatchRecognize = async () => {
    if (members.length === 0) {
      alert('Créez au moins un membre de famille et ajoutez des photos d\'entraînement avant de lancer la reconnaissance.');
      return;
    }

    if (!confirm(`Lancer la reconnaissance sur toutes les images ?\n\nConfiguration:\n- Taille des lots: ${batchSize} images\n- Cela peut prendre plusieurs minutes.`)) {
      return;
    }

    try {
      setIsRecognizing(true);
      setRecognitionLogs([]);
      setRecognitionResults(null);
      setRecognitionProgress({ current: 0, total: 0 });

      addLog('📊 Récupération de la liste des images...');

      // Get all images
      const response = await api.get('/images?limit=10000');
      const images = response.data.images || [];
      const imageIds = images.map((img: Image) => img.id);

      if (imageIds.length === 0) {
        addLog('⚠️ Aucune image trouvée');
        return;
      }

      addLog(`✅ ${imageIds.length} images à analyser`);
      addLog(`⚙️ Configuration: ${batchSize} images par lot`);
      addLog(`🔄 Lancement de la reconnaissance...`);

      setRecognitionProgress({ current: 0, total: imageIds.length });

      // Launch batch recognition
      const recognitionResponse = await api.post('/family/batch-recognize', {
        image_ids: imageIds,
        save: true,
        batch_size: batchSize
      });

      const summary = recognitionResponse.data.summary;
      setRecognitionResults(summary);
      setRecognitionProgress({ current: summary.successful, total: imageIds.length });

      addLog(`\n🎉 RECONNAISSANCE TERMINÉE !`);
      addLog(`📸 Images traitées: ${summary.successful}/${summary.total_images}`);
      addLog(`👥 Personnes détectées: ${summary.total_people_detected}`);
      addLog(`🔌 Appels API utilisés: ${summary.api_calls_made} (au lieu de ${summary.total_images})`);
      addLog(`💰 Économie: ${Math.round((1 - summary.api_calls_made / summary.total_images) * 100)}%`);

      if (summary.not_found > 0) {
        addLog(`⚠️ Images non trouvées: ${summary.not_found}`);
      }
    } catch (error: any) {
      console.error('Failed to batch recognize:', error);
      addLog(`❌ ERREUR: ${error.response?.data?.error || error.message || 'Échec de la reconnaissance'}`);
    } finally {
      setIsRecognizing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="text-slate-400 hover:text-slate-100 transition-colors"
            >
              ← Retour
            </button>
            <h1 className="text-2xl font-bold">Gestion de la Famille</h1>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Batch Recognition Panel */}
        <div className="mb-6 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🤖</span>
            Reconnaissance Automatique
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Configuration */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Configuration</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Taille des lots (images par appel API)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={batchSize}
                    onChange={(e) => setBatchSize(parseInt(e.target.value))}
                    disabled={isRecognizing}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Recommandé : 10. Plus petit = plus lent mais moins de tokens par requête.
                  </p>
                </div>

                <button
                  onClick={handleBatchRecognize}
                  disabled={isRecognizing || members.length === 0}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg transition-colors font-semibold flex items-center justify-center gap-2"
                >
                  {isRecognizing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Reconnaissance en cours...
                    </>
                  ) : (
                    <>🔍 Lancer la reconnaissance</>
                  )}
                </button>

                {members.length === 0 && (
                  <p className="text-xs text-amber-400">
                    ⚠️ Créez au moins un membre de famille et ajoutez des photos d'entraînement
                  </p>
                )}
              </div>

              {/* Progress */}
              {recognitionProgress.total > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-slate-400 mb-1">
                    <span>Progression</span>
                    <span>{recognitionProgress.current}/{recognitionProgress.total}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(recognitionProgress.current / recognitionProgress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Results Summary */}
              {recognitionResults && (
                <div className="mt-4 p-3 bg-green-900/30 border border-green-500/30 rounded">
                  <h4 className="text-sm font-semibold text-green-400 mb-2">✅ Résultats</h4>
                  <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span>Images traitées:</span>
                      <span className="font-semibold">{recognitionResults.successful}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Personnes détectées:</span>
                      <span className="font-semibold text-purple-300">{recognitionResults.total_people_detected}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Appels API:</span>
                      <span className="font-semibold text-blue-300">{recognitionResults.api_calls_made}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Économie:</span>
                      <span className="font-semibold text-green-300">
                        {Math.round((1 - recognitionResults.api_calls_made / recognitionResults.total_images) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Logs */}
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Logs d'exécution</h3>
              <div className="bg-slate-900 border border-slate-700 rounded p-3 h-64 overflow-y-auto font-mono text-xs">
                {recognitionLogs.length === 0 ? (
                  <p className="text-slate-500 italic">Les logs d'exécution apparaîtront ici...</p>
                ) : (
                  recognitionLogs.map((log, index) => (
                    <div key={index} className="text-slate-300 mb-1 whitespace-pre-wrap">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Members list */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Membres de la famille</h2>
                <button
                  onClick={() => setIsAddingMember(true)}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm"
                >
                  + Ajouter
                </button>
              </div>

              {/* Add member form */}
              {isAddingMember && (
                <form onSubmit={handleCreateMember} className="mb-4 p-4 bg-slate-800 rounded border border-slate-700">
                  <input
                    type="text"
                    placeholder="Nom *"
                    value={newMember.name}
                    onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded mb-2"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Relation (ex: père, mère, frère)"
                    value={newMember.relationship}
                    onChange={(e) => setNewMember({ ...newMember, relationship: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded mb-2"
                  />
                  <textarea
                    placeholder="Notes (optionnel)"
                    value={newMember.notes}
                    onChange={(e) => setNewMember({ ...newMember, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded mb-2"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm">
                      Créer
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingMember(false)}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              {/* Members list */}
              <div className="space-y-2">
                {members.length === 0 ? (
                  <p className="text-slate-400 text-sm">Aucun membre. Ajoutez votre famille pour commencer !</p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className={`p-3 rounded border cursor-pointer transition-colors ${
                        selectedMember?.id === member.id
                          ? 'bg-blue-900 border-blue-700'
                          : 'bg-slate-800 border-slate-700 hover:bg-slate-700'
                      }`}
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{member.name}</h3>
                          {member.relationship && (
                            <p className="text-xs text-slate-400">{member.relationship}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {member.training_image_count || 0} photo(s) d'entraînement
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMember(member.id);
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Training images */}
          <div className="lg:col-span-2">
            {selectedMember ? (
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedMember.name}</h2>
                    <p className="text-sm text-slate-400">{selectedMember.relationship}</p>
                  </div>
                  <label className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm cursor-pointer">
                    {isUploadingTraining ? '⏳ Upload en cours...' : '+ Ajouter des photos'}
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleUploadTrainingImages}
                      disabled={isUploadingTraining}
                      className="hidden"
                    />
                  </label>
                </div>

                {selectedMember.notes && (
                  <p className="text-sm text-slate-300 mb-4 p-3 bg-slate-800 rounded">{selectedMember.notes}</p>
                )}

                {/* Training images grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {trainingImages.length === 0 ? (
                    <p className="col-span-full text-slate-400 text-sm">
                      Aucune photo d'entraînement. Ajoutez des photos pour entraîner l'IA à reconnaître cette personne.
                    </p>
                  ) : (
                    trainingImages.map((training) => (
                      <div key={training.id} className="relative group">
                        <img
                          src={`/uploads/training/thumbnails/thumb_${training.filename}.webp`}
                          alt={training.original_name}
                          className="w-full aspect-square object-cover rounded border border-slate-700"
                        />
                        <button
                          onClick={() => handleDeleteTrainingImage(training.id)}
                          className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Supprimer
                        </button>
                        {training.verified && (
                          <span className="absolute bottom-1 left-1 bg-green-600 text-white rounded px-2 py-1 text-xs">
                            ✓ Vérifié
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 rounded-lg border border-slate-800 p-6 flex items-center justify-center h-64">
                <p className="text-slate-400">Sélectionnez un membre de famille pour voir les photos d'entraînement</p>
              </div>
            )}
          </div>
        </div>

        {/* Info box */}
        <div className="mt-6 bg-blue-900/20 border border-blue-800 rounded-lg p-6">
          <h3 className="font-semibold mb-2">💡 Comment utiliser la reconnaissance familiale ?</h3>
          <ol className="text-sm text-slate-300 space-y-2">
            <li>1. Ajoutez les membres de votre famille (nom, relation)</li>
            <li>2. Pour chaque personne, ajoutez 2-3 photos d'entraînement claires</li>
            <li>3. Cliquez sur "Reconnaître toutes les images" pour lancer l'analyse</li>
            <li>4. L'IA utilisera les photos d'entraînement pour identifier les personnes dans vos images</li>
            <li>5. Les personnes détectées apparaîtront dans la galerie avec leur nom</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
