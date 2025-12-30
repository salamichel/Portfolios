import React from 'react';
import type { BookStatus } from '../../types';

interface BookStatusBadgeProps {
  status: BookStatus;
  className?: string;
}

const STATUS_CONFIG: Record<BookStatus, { label: string; color: string; bgColor: string }> = {
  draft: {
    label: 'Brouillon',
    color: 'text-gray-700',
    bgColor: 'bg-gray-200'
  },
  in_progress: {
    label: 'En cours',
    color: 'text-blue-700',
    bgColor: 'bg-blue-200'
  },
  pending_review: {
    label: 'À valider',
    color: 'text-orange-700',
    bgColor: 'bg-orange-200'
  },
  published: {
    label: 'Publié',
    color: 'text-green-700',
    bgColor: 'bg-green-200'
  }
};

export const BookStatusBadge: React.FC<BookStatusBadgeProps> = ({ status, className = '' }) => {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
    >
      {config.label}
    </span>
  );
};
