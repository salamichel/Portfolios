import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { FamilyMember, TrainingImage, Image } from '../types';

export default function FamilyAdmin() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [trainingImages, setTrainingImages] = useState<TrainingImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingTraining, setIsAddingTraining] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', relationship: '', notes: '' });
  const [availableImages, setAvailableImages] = useState<Image[]>([]);
  const [selectedImageForTraining, setSelectedImageForTraining] = useState<string>('');

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
      const response = await api.get('/api/family/members');
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load family members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrainingImages = async (memberId: string) => {
    try {
      const response = await api.get(`/api/family/members/${memberId}/training-images`);
      setTrainingImages(response.data);
    } catch (error) {
      console.error('Failed to load training images:', error);
    }
  };

  const loadAvailableImages = async () => {
    try {
      const response = await api.get('/api/images?limit=50');
      setAvailableImages(response.data.images || []);
    } catch (error) {
      console.error('Failed to load available images:', error);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/api/family/members', newMember);
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
      await api.delete(`/api/family/members/${id}`);
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

  const handleAddTrainingImage = async () => {
    if (!selectedMember || !selectedImageForTraining) return;

    try {
      await api.post('/api/family/training-images', {
        image_id: selectedImageForTraining,
        family_member_id: selectedMember.id,
        verified: true
      });

      loadTrainingImages(selectedMember.id);
      loadMembers(); // Refresh counts
      setIsAddingTraining(false);
      setSelectedImageForTraining('');
    } catch (error) {
      console.error('Failed to add training image:', error);
      alert('Échec de l\'ajout de l\'image d\'entraînement');
    }
  };

  const handleDeleteTrainingImage = async (id: string) => {
    if (!confirm('Supprimer cette image d\'entraînement ?')) return;

    try {
      await api.delete(`/api/family/training-images/${id}`);
      setTrainingImages(trainingImages.filter(t => t.id !== id));
      loadMembers(); // Refresh counts
    } catch (error) {
      console.error('Failed to delete training image:', error);
      alert('Échec de la suppression de l\'image');
    }
  };

  const handleBatchRecognize = async () => {
    if (!confirm('Lancer la reconnaissance sur toutes les images ? Cela peut prendre du temps.')) return;

    try {
      // Get all images
      const response = await api.get('/api/images?limit=1000');
      const images = response.data.images || [];
      const imageIds = images.map((img: Image) => img.id);

      // Launch batch recognition
      const recognitionResponse = await api.post('/api/family/batch-recognize', {
        image_ids: imageIds,
        save: true
      });

      alert(`Reconnaissance terminée !\n${recognitionResponse.data.summary.total_people_detected} personnes détectées dans ${recognitionResponse.data.summary.successful} images.`);
    } catch (error) {
      console.error('Failed to batch recognize:', error);
      alert('Échec de la reconnaissance par lot');
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
          <button
            onClick={handleBatchRecognize}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            🔍 Reconnaître toutes les images
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto p-6">
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
                  <button
                    onClick={() => {
                      setIsAddingTraining(true);
                      loadAvailableImages();
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded transition-colors text-sm"
                  >
                    + Ajouter une photo
                  </button>
                </div>

                {selectedMember.notes && (
                  <p className="text-sm text-slate-300 mb-4 p-3 bg-slate-800 rounded">{selectedMember.notes}</p>
                )}

                {/* Add training image form */}
                {isAddingTraining && (
                  <div className="mb-4 p-4 bg-slate-800 rounded border border-slate-700">
                    <h3 className="font-semibold mb-2">Sélectionnez une image</h3>
                    <select
                      value={selectedImageForTraining}
                      onChange={(e) => setSelectedImageForTraining(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded mb-2"
                    >
                      <option value="">-- Choisir une image --</option>
                      {availableImages.map((img) => (
                        <option key={img.id} value={img.id}>
                          {img.title || img.original_name}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddTrainingImage}
                        disabled={!selectedImageForTraining}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Ajouter
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingTraining(false);
                          setSelectedImageForTraining('');
                        }}
                        className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
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
                          src={`/thumbnails/${training.image?.filename}.webp`}
                          alt="Training"
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
