import { Trash2 } from 'lucide-react';
import type { LayoutSlot } from '../../types';

interface SlotPropertiesPanelProps {
  slot: LayoutSlot | null;
  onSlotUpdate: (slot: LayoutSlot) => void;
  onSlotDelete: (slotId: string) => void;
}

export function SlotPropertiesPanel({ slot, onSlotUpdate, onSlotDelete }: SlotPropertiesPanelProps) {
  if (!slot) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Sélectionnez un slot pour voir ses propriétés</p>
      </div>
    );
  }

  const handleChange = (field: keyof LayoutSlot, value: string | number) => {
    onSlotUpdate({ ...slot, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Slot ID */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          ID du slot
        </label>
        <input
          type="text"
          value={slot.id}
          onChange={(e) => handleChange('id', e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Type
        </label>
        <select
          value={slot.type}
          onChange={(e) => handleChange('type', e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
        >
          <option value="image">Image</option>
          <option value="text">Texte</option>
        </select>
      </div>

      {/* Page */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Page
        </label>
        <select
          value={slot.page}
          onChange={(e) => handleChange('page', e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
        >
          <option value="left">Gauche</option>
          <option value="right">Droite</option>
        </select>
      </div>

      {/* Position */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            X (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={slot.x}
            onChange={(e) => handleChange('x', parseFloat(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Y (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={slot.y}
            onChange={(e) => handleChange('y', parseFloat(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Size */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Largeur (%)
          </label>
          <input
            type="number"
            min="1"
            max="200"
            step="1"
            value={slot.width}
            onChange={(e) => handleChange('width', parseFloat(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Max 200% pour couvrir les deux pages
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Hauteur (%)
          </label>
          <input
            type="number"
            min="1"
            max="100"
            step="1"
            value={slot.height}
            onChange={(e) => handleChange('height', parseFloat(e.target.value))}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500"
          />
        </div>
      </div>

      {/* Delete Button */}
      <button
        onClick={() => onSlotDelete(slot.id)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Supprimer le slot
      </button>
    </div>
  );
}
