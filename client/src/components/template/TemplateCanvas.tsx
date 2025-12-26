import { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Type, Plus } from 'lucide-react';
import type { TemplateLayout, LayoutSlot } from '../../types';

interface TemplateCanvasProps {
  layout: TemplateLayout;
  onLayoutChange: (layout: TemplateLayout) => void;
  isEditable: boolean;
  selectedSlotId?: string | null;
  onSlotSelect?: (slotId: string | null) => void;
}

export function TemplateCanvas({ layout, onLayoutChange, isEditable, selectedSlotId, onSlotSelect }: TemplateCanvasProps) {
  const [showGrid, setShowGrid] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const snapToGrid = (value: number, gridSize: number = 5) => {
    return Math.round(value / gridSize) * gridSize;
  };

  const handleAddSlot = (type: 'image' | 'text') => {
    const newSlot: LayoutSlot = {
      id: `${type}-${Date.now()}`,
      type,
      page: 'left',
      x: 10,
      y: 10,
      width: 40,
      height: 40,
    };

    onLayoutChange({
      slots: [...layout.slots, newSlot]
    });

    if (onSlotSelect) {
      onSlotSelect(newSlot.id);
    }
  };

  const handleSlotClick = (slotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditable && onSlotSelect) {
      onSlotSelect(slotId);
    }
  };

  const handleCanvasClick = () => {
    if (onSlotSelect) {
      onSlotSelect(null);
    }
  };

  const handleSlotDragStart = (slotId: string, e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    setIsDragging(true);
    if (onSlotSelect) {
      onSlotSelect(slotId);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleSlotDrag = (e: MouseEvent) => {
    if (!isDragging || !selectedSlotId || !dragStart || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / canvasRect.width) * 200; // 200 because width can go up to 200%
    const deltaY = ((e.clientY - dragStart.y) / canvasRect.height) * 100;

    const updatedSlots = layout.slots.map(slot => {
      if (slot.id === selectedSlotId) {
        let newX = slot.x + deltaX;
        let newY = slot.y + deltaY;

        // Snap to grid
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);

        // Boundaries
        newX = Math.max(0, Math.min(newX, (slot.page === 'left' ? 100 : 200) - slot.width));
        newY = Math.max(0, Math.min(newY, 100 - slot.height));

        return { ...slot, x: newX, y: newY };
      }
      return slot;
    });

    onLayoutChange({ slots: updatedSlots });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleSlotDragEnd = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleSlotDrag);
      window.addEventListener('mouseup', handleSlotDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleSlotDrag);
        window.removeEventListener('mouseup', handleSlotDragEnd);
      };
    }
  }, [isDragging, selectedSlotId, dragStart]);

  const handleResizeStart = (slotId: string, corner: string, e: React.MouseEvent) => {
    if (!isEditable) return;
    e.stopPropagation();
    setIsResizing(true);
    if (onSlotSelect) {
      onSlotSelect(slotId);
    }
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResize = (e: MouseEvent) => {
    if (!isResizing || !selectedSlotId || !dragStart || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / canvasRect.width) * 200;
    const deltaY = ((e.clientY - dragStart.y) / canvasRect.height) * 100;

    const updatedSlots = layout.slots.map(slot => {
      if (slot.id === selectedSlotId) {
        let newWidth = slot.width + deltaX;
        let newHeight = slot.height + deltaY;

        // Snap to grid
        newWidth = snapToGrid(newWidth);
        newHeight = snapToGrid(newHeight);

        // Minimum size
        newWidth = Math.max(10, newWidth);
        newHeight = Math.max(10, newHeight);

        // Maximum size
        newWidth = Math.min(newWidth, 200 - slot.x);
        newHeight = Math.min(newHeight, 100 - slot.y);

        return { ...slot, width: newWidth, height: newHeight };
      }
      return slot;
    });

    onLayoutChange({ slots: updatedSlots });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
    setDragStart(null);
  };

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, selectedSlotId, dragStart]);

  const renderSlot = (slot: LayoutSlot) => {
    const isSelected = selectedSlotId === slot.id;

    // Calculate position
    const left = slot.page === 'left' ? slot.x : slot.x + 100;

    return (
      <div
        key={slot.id}
        className={`absolute border-2 transition-all ${
          isSelected
            ? 'border-rose-500 bg-rose-500/10 z-10'
            : 'border-gray-400 bg-gray-400/5 hover:border-rose-400'
        } ${isEditable ? 'cursor-move' : 'cursor-default'}`}
        style={{
          left: `${left}%`,
          top: `${slot.y}%`,
          width: `${slot.width}%`,
          height: `${slot.height}%`,
        }}
        onClick={(e) => handleSlotClick(slot.id, e)}
        onMouseDown={(e) => handleSlotDragStart(slot.id, e)}
      >
        {/* Slot Content */}
        <div className="w-full h-full flex flex-col items-center justify-center p-2 text-gray-600">
          {slot.type === 'image' ? (
            <>
              <ImageIcon className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Image</span>
            </>
          ) : (
            <>
              <Type className="w-6 h-6 mb-1" />
              <span className="text-xs font-medium">Texte</span>
            </>
          )}
          <span className="text-xs text-gray-500 mt-1">{slot.id}</span>
        </div>

        {/* Resize Handles */}
        {isSelected && isEditable && (
          <>
            <div
              className="absolute bottom-0 right-0 w-3 h-3 bg-rose-500 cursor-se-resize"
              onMouseDown={(e) => handleResizeStart(slot.id, 'se', e)}
            />
            <div
              className="absolute top-0 right-0 w-3 h-3 bg-rose-500 cursor-ne-resize"
              onMouseDown={(e) => handleResizeStart(slot.id, 'ne', e)}
            />
            <div
              className="absolute bottom-0 left-0 w-3 h-3 bg-rose-500 cursor-sw-resize"
              onMouseDown={(e) => handleResizeStart(slot.id, 'sw', e)}
            />
            <div
              className="absolute top-0 left-0 w-3 h-3 bg-rose-500 cursor-nw-resize"
              onMouseDown={(e) => handleResizeStart(slot.id, 'nw', e)}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {isEditable && (
        <div className="flex items-center gap-2 bg-gray-800 p-3 rounded-lg">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-3 py-1.5 rounded ${
              showGrid ? 'bg-rose-500 text-white' : 'bg-gray-700 text-gray-300'
            } text-sm transition-colors`}
          >
            {showGrid ? 'Masquer la grille' : 'Afficher la grille'}
          </button>
          <div className="h-6 w-px bg-gray-700" />
          <button
            onClick={() => handleAddSlot('image')}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter image
          </button>
          <button
            onClick={() => handleAddSlot('text')}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter texte
          </button>
        </div>
      )}

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="aspect-[2/1.414] bg-white shadow-2xl rounded-lg overflow-hidden relative"
        onClick={handleCanvasClick}
      >
        {/* Grid */}
        {showGrid && (
          <div className="absolute inset-0 pointer-events-none">
            <svg width="100%" height="100%" className="opacity-20">
              <defs>
                <pattern id="grid" width="5%" height="5%" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="gray" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>
        )}

        {/* Center divider (gutter between pages) */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-5" />

        {/* Page labels */}
        <div className="absolute top-2 left-2 text-xs font-medium text-gray-400 bg-white/80 px-2 py-1 rounded">
          Page gauche
        </div>
        <div className="absolute top-2 right-2 text-xs font-medium text-gray-400 bg-white/80 px-2 py-1 rounded">
          Page droite
        </div>

        {/* Slots */}
        {layout.slots.map(renderSlot)}
      </div>
    </div>
  );
}
