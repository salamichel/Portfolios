import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { FamilyMember, TrainingImage, Image } from '../types';

const getThumbnailUrl = (filename: string) => {
  const baseName = filename.replace(/\.[^/.]+$/, '');
  return `/uploads/thumbnails/thumb_${baseName}.webp`;
};

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
  const [batchSize, setBatchSize] = useState(20);
  const [recognitionMode, setRecognitionMode] = useState<'all' | 'new_only'>('new_only');
  const [recognitionProgress, setRecognitionProgress] = useState({ current: 0, total: 0 });
  const [recognitionLogs, setRecognitionLogs] = useState<string[]>([]);
  const [recognitionResults, setRecognitionResults] = useState<any>(null);
  const [processedImages, setProcessedImages] = useState<Image[]>([]);

  // Image modal state
  const [selectedImage, setSelectedImage] = useState<Image | null>(null);
  const [detectedPeople, setDetectedPeople] = useState<any[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    if (selectedMember) {
      loadTrainingImages(selectedMember.id);
    }
  }, [selectedMember]);

  useEffect(() => {
    if (selectedImage) {
      loadDetectedPeople(selectedImage.id);
    } else {
      setDetectedPeople([]);
    }
  }, [selectedImage]);

  const loadDetectedPeople = async (imageId: string) => {
    try {
      setLoadingPeople(true);
      const response = await api.get(`/family/images/${imageId}/people`);
      setDetectedPeople(response.data);
    } catch (error) {
      console.error('Failed to load detected people:', error);
      setDetectedPeople([]);
    } finally {
      setLoadingPeople(false);
    }
  };

  const handleAddPerson = async (memberId: string) => {
    if (!selectedImage || !memberId) return;

    try {
      const response = await api.post(`/family/images/${selectedImage.id}/people`, {
        family_member_id: memberId
      });

      setDetectedPeople(prev => [...prev, response.data]);

      // Update the processedImages list if this image is in it
      setProcessedImages(prev =>
        prev.map(img =>
          img.id === selectedImage.id
            ? { ...img, people: [...(img.people || []), response.data] }
            : img
        )
      );
    } catch (error: any) {
      console.error('Failed to add person:', error);
      if (error.response?.status === 409) {
        alert('Cette personne est déjà taguée sur cette image');
      } else {
        alert('Échec de l\'ajout de la personne');
      }
    }
  };

  const handleRemovePerson = async (personId: string) => {
    if (!confirm('Retirer cette personne de l\'image ?')) return;

    try {
      await api.delete(`/family/people/${personId}`);
      const remainingPeople = detectedPeople.filter(p => p.id !== personId);
      setDetectedPeople(remainingPeople);

      // If no more people detected, reset family_analyzed flag so it can be re-analyzed
      if (selectedImage && remainingPeople.length === 0) {
        await api.post(`/images/${selectedImage.id}/mark-family-analyzed`, {}, {
          params: { reset: true }
        });
      }

      // Update the processedImages list if this image is in it
      if (selectedImage) {
        setProcessedImages(prev =>
          prev.map(img =>
            img.id === selectedImage.id
              ? { ...img, people: remainingPeople }
              : img
          )
        );
      }
    } catch (error) {
      console.error('Failed to remove person:', error);
      alert('Échec de la suppression');
    }
  };

  const handleMarkAsNoPerson = async () => {
    if (!selectedImage) return;

    if (!confirm('Marquer cette image comme "Aucune personne" ?\n\nCette image ne sera plus analysée lors des reconnaissances futures.')) {
      return;
    }

    try {
      await api.post(`/images/${selectedImage.id}/mark-family-analyzed`);

      // Remove all detected people for this image
      const peopleIds = detectedPeople.map(p => p.id);
      for (const personId of peopleIds) {
        await api.delete(`/family/people/${personId}`);
      }

      setDetectedPeople([]);
      alert('Image marquée comme "Aucune personne". Elle ne sera plus analysée.');
      setSelectedImage(null);
    } catch (error) {
      console.error('Failed to mark as no person:', error);
      alert('Échec de l\'opération');
    }
  };

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

    const modeLabel = recognitionMode === 'new_only' ? 'Nouvelles images uniquement' : 'Toutes les images (réanalyse complète)';
    if (!confirm(`Lancer la reconnaissance ?\n\nConfiguration:\n- Mode: ${modeLabel}\n- Taille des lots: ${batchSize} images\n- Cela peut prendre plusieurs minutes.`)) {
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

      addLog(`✅ ${imageIds.length} images trouvées`);
      addLog(`⚙️ Mode: ${modeLabel}`);
      addLog(`⚙️ Taille des lots: ${batchSize} images`);
      addLog(`🔄 Lancement de la reconnaissance...`);

      setRecognitionProgress({ current: 0, total: imageIds.length });

      // Launch batch recognition
      const recognitionResponse = await api.post('/family/batch-recognize', {
        image_ids: imageIds,
        save: true,
        batch_size: batchSize,
        mode: recognitionMode
      });

      const summary = recognitionResponse.data.summary;
      const failedBatches = recognitionResponse.data.failed_batches || [];
      const results = recognitionResponse.data.results || [];
      setRecognitionResults(summary);
      // Progress should reflect total processed (successful + skipped), not just successful
      const totalProcessed = summary.successful + summary.skipped;
      setRecognitionProgress({ current: totalProcessed, total: imageIds.length });

      console.log('[FamilyAdmin] Recognition results:', results.length, 'results');

      // Load details for images analyzed in THIS recognition session only
      if (results.length > 0) {
        addLog(`📥 Chargement des ${results.length} images analysées...`);
        try {
          // Load full image data for each result
          const enrichedImages = await Promise.all(
            results.map(async (r: any) => {
              try {
                const imgResponse = await api.get(`/images/${r.image_id}`);
                const img = imgResponse.data;

                console.log(`[FamilyAdmin] Image ${img.filename}: ${r.people?.length || 0} people`);
                return { ...img, people: r.people || [] };
              } catch (err) {
                console.error(`[FamilyAdmin] Failed to load image ${r.image_id}:`, err);
                return null;
              }
            })
          );

          const validImages = enrichedImages.filter((img): img is Image & { people: any[] } => img !== null);
          console.log(`[FamilyAdmin] Setting ${validImages.length} processed images`);
          setProcessedImages(validImages);
          addLog(`✅ ${validImages.length} images de cette reconnaissance chargées`);
        } catch (err) {
          console.error('[FamilyAdmin] Error loading images:', err);
          addLog(`⚠️ Erreur lors du chargement des images: ${err}`);
        }
      } else {
        addLog(`⚠️ Aucune image n'a été analysée dans cette session`);
      }

      addLog(`\n🎉 RECONNAISSANCE TERMINÉE !`);
      addLog(`📸 Images analysées: ${summary.successful}/${summary.total_images}`);

      if (summary.skipped > 0) {
        addLog(`⏭️ Images ignorées (déjà analysées): ${summary.skipped}`);
      }

      addLog(`👥 Personnes détectées: ${summary.total_people_detected}`);
      addLog(`📦 Lots réussis: ${summary.api_calls_made}/${summary.total_batches}`);

      if (failedBatches.length > 0) {
        addLog(`\n⚠️ LOTS ÉCHOUÉS: ${failedBatches.length}`);
        failedBatches.forEach((batch: any) => {
          addLog(`   Lot ${batch.batchNumber}: ${batch.imageCount} images - ${batch.error}`);
        });
        addLog(`💡 Conseil: Réduisez la taille des lots pour éviter les erreurs`);
      }

      if (summary.api_calls_made > 0 && summary.total_images > 0) {
        addLog(`💰 Économie: ${Math.round((1 - summary.api_calls_made / summary.total_images) * 100)}% vs appels individuels`);
      }

      if (summary.not_found > 0) {
        addLog(`⚠️ Images non trouvées: ${summary.not_found}`);
      }

      if (summary.total_people_detected > 0) {
        addLog(`\n💡 Pour voir les résultats:`);
        addLog(`   1. Allez dans la galerie (bouton ci-dessus)`);
        addLog(`   2. Cliquez sur une image`);
        addLog(`   3. Les personnes détectées apparaîtront dans le panneau latéral`);
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
                  <label className="block text-sm text-slate-400 mb-1">Mode de reconnaissance</label>
                  <select
                    value={recognitionMode}
                    onChange={(e) => setRecognitionMode(e.target.value as 'all' | 'new_only')}
                    disabled={isRecognizing}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white disabled:opacity-50"
                  >
                    <option value="new_only">Nouvelles images uniquement (recommandé)</option>
                    <option value="all">Toutes les images (réanalyse complète)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    {recognitionMode === 'new_only'
                      ? '💰 Ignore les images déjà analysées = économie de coûts API'
                      : '⚠️ Réanalyse toutes les images = coûts élevés'}
                  </p>
                </div>

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
                    Recommandé : 5. Plus petit = plus lent mais moins de tokens par requête.
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
                      <span>Images analysées:</span>
                      <span className="font-semibold">{recognitionResults.successful}</span>
                    </div>
                    {recognitionResults.skipped > 0 && (
                      <div className="flex justify-between">
                        <span>Images ignorées:</span>
                        <span className="font-semibold text-slate-400">{recognitionResults.skipped}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Personnes détectées:</span>
                      <span className="font-semibold text-purple-300">{recognitionResults.total_people_detected}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lots réussis:</span>
                      <span className="font-semibold text-blue-300">
                        {recognitionResults.api_calls_made}/{recognitionResults.total_batches || recognitionResults.api_calls_made}
                      </span>
                    </div>
                    {recognitionResults.failed_batches > 0 && (
                      <div className="flex justify-between">
                        <span>Lots échoués:</span>
                        <span className="font-semibold text-red-400">{recognitionResults.failed_batches}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Économie:</span>
                      <span className="font-semibold text-green-300">
                        {Math.round((1 - recognitionResults.api_calls_made / recognitionResults.total_images) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Navigation to gallery */}
                  {recognitionResults.total_people_detected > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-500/30">
                      <button
                        onClick={() => navigate('/')}
                        className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        📸 Voir les résultats dans la galerie
                      </button>
                      <p className="text-xs text-slate-400 mt-2 text-center">
                        💡 Cliquez sur une image pour voir les personnes détectées
                      </p>
                    </div>
                  )}
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

          {/* Processed Images Grid */}
          {processedImages.length > 0 && (
            <div className="mt-6 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span>📸</span>
                Images analysées dans cette reconnaissance ({processedImages.length})
              </h2>
              <p className="text-sm text-slate-300 mb-4">
                Résultats de la dernière analyse. Cliquez sur une image pour voir les personnes détectées et corriger si nécessaire.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {processedImages.map(image => (
                  <div
                    key={image.id}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-gray-800 cursor-pointer"
                    onClick={() => setSelectedImage(image)}
                  >
                    <img
                      src={getThumbnailUrl(image.filename)}
                      alt={image.title || image.original_name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* People count badge */}
                    <div className={`absolute top-2 right-2 rounded-full px-2 py-1 text-xs font-semibold ${
                      image.people && image.people.length > 0
                        ? 'bg-purple-600/90 text-white'
                        : 'bg-slate-700/90 text-slate-300'
                    }`}>
                      {image.people ? image.people.length : 0} 👤
                    </div>

                    {/* People names and title on hover */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {image.people && image.people.length > 0 && (
                        <div className="mb-2 space-y-1">
                          {image.people.map((person: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1 text-xs bg-purple-600/90 rounded px-2 py-1">
                              <span className="font-medium">{person.member?.name || 'Inconnu'}</span>
                              <span className="text-purple-200 text-[10px]">
                                ({Math.round((person.confidence || 0) * 100)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-sm font-medium truncate bg-black/50 rounded px-2 py-1">
                        {image.title || image.original_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* Image Detail Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold">{selectedImage.title || selectedImage.original_name}</h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-slate-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image */}
                <div>
                  <img
                    src={`/uploads/optimized/${selectedImage.filename.replace(/\.[^/.]+$/, '')}.webp`}
                    alt={selectedImage.title || selectedImage.original_name}
                    className="w-full rounded-lg"
                  />
                </div>

                {/* People Management */}
                <div>
                  <h4 className="text-md font-semibold mb-3 flex items-center gap-2">
                    <span>👥</span>
                    Personnes détectées
                  </h4>

                  {loadingPeople ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
                    </div>
                  ) : (
                    <>
                      {/* Detected People List */}
                      {detectedPeople.length > 0 ? (
                        <div className="space-y-2 mb-6">
                          {detectedPeople.map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center justify-between p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg"
                            >
                              <div>
                                <p className="font-medium">{person.member?.name || 'Inconnu'}</p>
                                <p className="text-xs text-slate-400">
                                  Confiance: {Math.round((person.confidence || 0) * 100)}%
                                  {person.verified && ' • Vérifié'}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemovePerson(person.id)}
                                className="text-red-400 hover:text-red-300 text-sm px-2 py-1"
                              >
                                Retirer
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-sm mb-6">
                          Aucune personne détectée sur cette image.
                        </p>
                      )}

                      {/* Add Person */}
                      <div className="border-t border-slate-700 pt-4">
                        <h5 className="text-sm font-semibold mb-3">Ajouter une personne</h5>
                        <div className="flex flex-wrap gap-2">
                          {members
                            .filter(member => !detectedPeople.some(p => p.family_member_id === member.id))
                            .map((member) => (
                              <button
                                key={member.id}
                                onClick={() => handleAddPerson(member.id)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
                              >
                                + {member.name}
                              </button>
                            ))}
                        </div>

                        {/* Mark as No Person */}
                        <div className="mt-4">
                          <button
                            onClick={handleMarkAsNoPerson}
                            className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium transition-colors text-center"
                          >
                            🚫 Marquer comme "Aucune personne"
                          </button>
                          <p className="text-xs text-slate-500 mt-2">
                            Cette image ne sera plus analysée lors des reconnaissances futures
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
