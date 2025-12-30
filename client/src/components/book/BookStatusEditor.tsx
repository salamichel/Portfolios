import React from 'react';
import type { BookStatus } from '../../types';
import { BookStatusBadge } from './BookStatusBadge';

interface BookStatusEditorProps {
  status: BookStatus;
  onChange: (status: BookStatus) => void;
  disabled?: boolean;
}

const STATUS_OPTIONS: Array<{ value: BookStatus; label: string; description: string }> = [
  {
    value: 'draft',
    label: 'Brouillon',
    description: 'Travail en cours, édition libre'
  },
  {
    value: 'in_progress',
    label: 'En cours',
    description: 'Projet actif, modifications autorisées'
  },
  {
    value: 'pending_review',
    label: 'À valider',
    description: 'En attente de validation, édition restreinte'
  },
  {
    value: 'published',
    label: 'Publié',
    description: 'Version finale, verrouillé'
  }
];

export const BookStatusEditor: React.FC<BookStatusEditorProps> = ({
  status,
  onChange,
  disabled = false
}) => {
  const isLocked = status === 'published';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Statut du livre
        </label>
        <BookStatusBadge status={status} />
      </div>

      <select
        value={status}
        onChange={(e) => onChange(e.target.value as BookStatus)}
        disabled={disabled}
        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
        {STATUS_OPTIONS.find((opt) => opt.value === status)?.description}
      </div>

      {isLocked && (
        <div className="text-sm text-orange-600 bg-orange-50 p-3 rounded border border-orange-200">
          <strong>Attention :</strong> Ce livre est publié. Les modifications des pages sont verrouillées.
        </div>
      )}

      {status === 'pending_review' && (
        <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded border border-blue-200">
          <strong>Info :</strong> Ce livre est en attente de validation. Limitez les modifications majeures.
        </div>
      )}
    </div>
  );
};
