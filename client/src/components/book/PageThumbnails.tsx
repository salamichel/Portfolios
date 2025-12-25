import { useState } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { getThumbnailUrl } from '../../api/client';
import type { BookPage, LayoutSlot } from '../../types';

interface PageThumbnailsProps {
  pages: BookPage[];
  currentIndex: number;
  onSelectPage: (index: number) => void;
  onReorder: (newOrder: string[]) => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onBulkDelete: () => void;
}

export function PageThumbnails({ pages, currentIndex, onSelectPage, onReorder, selectedIds, onSelectionChange, onBulkDelete }: PageThumbnailsProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleToggleSelect = (e: React.MouseEvent, pageId: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(pageId)) {
      newSelected.delete(pageId);
    } else {
      newSelected.add(pageId);
    }
    onSelectionChange(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pages.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(pages.map(p => p.id)));
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', index.toString());
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (draggedIndex !== null && draggedIndex !== index) {
      const newPages = [...pages];
      const [draggedPage] = newPages.splice(draggedIndex, 1);
      newPages.splice(index, 0, draggedPage);
      onReorder(newPages.map(p => p.id));
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const getSlotStyle = (slot: LayoutSlot) => {
    const isSpanning = slot.width > 100;

    if (isSpanning) {
      return {
        position: 'absolute' as const,
        left: `${slot.x / 2}%`,
        top: `${slot.y}%`,
        width: `${slot.width / 2}%`,
        height: `${slot.height}%`,
      };
    }

    if (slot.page === 'left') {
      return {
        position: 'absolute' as const,
        left: `${slot.x / 2}%`,
        top: `${slot.y}%`,
        width: `${slot.width / 2}%`,
        height: `${slot.height}%`,
      };
    } else {
      return {
        position: 'absolute' as const,
        left: `${50 + slot.x / 2}%`,
        top: `${slot.y}%`,
        width: `${slot.width / 2}%`,
        height: `${slot.height}%`,
      };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Pages</h3>
        {pages.length > 0 && (
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-300">
            <input
              type="checkbox"
              checked={selectedIds.size === pages.length && pages.length > 0}
              onChange={handleSelectAll}
              className="w-3 h-3 rounded border-gray-600 bg-gray-800 text-rose-500 focus:ring-rose-500 focus:ring-offset-0"
            />
            Tout
          </label>
        )}
      </div>

      {selectedIds.size > 0 && (
        <button
          onClick={onBulkDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Supprimer ({selectedIds.size})
        </button>
      )}

      {pages.map((page, index) => {
        const isSelected = index === currentIndex;
        const isDragging = draggedIndex === index;
        const isDragOver = dragOverIndex === index;
        const slots = page.template?.layout?.slots || [];
        const images = page.images || [];
        const pageData = page.page_data;

        return (
          <div
            key={page.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onSelectPage(index)}
            className={`
              relative cursor-pointer rounded-lg overflow-hidden transition-all select-none
              ${isSelected ? 'ring-2 ring-rose-500' : 'hover:ring-2 hover:ring-gray-600'}
              ${isDragging ? 'opacity-50' : ''}
              ${isDragOver ? 'ring-2 ring-blue-500' : ''}
            `}
          >
            {/* Drag handle */}
            <div className="absolute top-1 left-1 z-10 p-1 bg-black/50 rounded cursor-grab active:cursor-grabbing pointer-events-none">
              <GripVertical className="w-3 h-3 text-white" />
            </div>

            {/* Page number */}
            <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 bg-black/50 rounded text-xs text-white pointer-events-none">
              {index + 1}
            </div>

            {/* Selection checkbox */}
            <div
              className="absolute bottom-1 left-1 z-10"
              onClick={(e) => handleToggleSelect(e, page.id)}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(page.id)}
                onChange={() => {}}
                className="w-4 h-4 rounded border-gray-600 bg-gray-800/80 text-rose-500 focus:ring-rose-500 focus:ring-offset-0 cursor-pointer"
              />
            </div>

            {/* Mini preview */}
            <div
              className="relative bg-white"
              style={{ aspectRatio: '2 / 1.414' }}
            >
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />

              {/* Slots with images */}
              {slots.map((slot) => {
                const slotData = pageData?.slots?.find(s => s.slot_id === slot.id);
                const image = slotData ? images.find(img => img.id === slotData.image_id) : null;

                return (
                  <div
                    key={slot.id}
                    style={getSlotStyle(slot)}
                    className={image ? '' : 'bg-gray-100 border border-gray-200'}
                  >
                    {image && (
                      <img
                        src={getThumbnailUrl(image.filename)}
                        alt=""
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                      />
                    )}
                  </div>
                );
              })}

              {/* Empty state */}
              {slots.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <Plus className="w-4 h-4 text-gray-400" />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {pages.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          Aucune page
        </div>
      )}
    </div>
  );
}
