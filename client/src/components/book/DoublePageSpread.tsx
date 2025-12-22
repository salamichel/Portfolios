import { useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import { getMediumImageUrl } from '../../api/client';
import type { BookPage, PageTemplate, Image, LayoutSlot } from '../../types';

interface DoublePageSpreadProps {
  page: BookPage;
  template?: PageTemplate;
  onSlotClick: (slotId: string) => void;
  onRemoveImage: (slotId: string) => void;
}

export function DoublePageSpread({ page, template, onSlotClick, onRemoveImage }: DoublePageSpreadProps) {
  const slots = template?.layout?.slots || [];
  const pageData = page.page_data;
  const images = page.images || [];

  // Create a map of image_id to image for quick lookup
  const imageMap = useMemo(() => {
    const map = new Map<string, Image>();
    images.forEach(img => map.set(img.id, img));
    return map;
  }, [images]);

  // Get assigned image for a slot
  const getSlotImage = (slotId: string): Image | undefined => {
    const slotData = pageData?.slots?.find(s => s.slot_id === slotId);
    if (!slotData) return undefined;
    return imageMap.get(slotData.image_id);
  };

  // Calculate slot position for rendering
  const getSlotStyle = (slot: LayoutSlot) => {
    // For slots that span both pages (width > 100), we need special handling
    const isSpanning = slot.width > 100;

    if (isSpanning) {
      // This slot spans both pages - render on the container level
      return {
        position: 'absolute' as const,
        left: `${slot.x / 2}%`,
        top: `${slot.y}%`,
        width: `${slot.width / 2}%`,
        height: `${slot.height}%`,
      };
    }

    // Regular slot on single page
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
    <div className="w-full max-w-5xl">
      {/* Book spread container */}
      <div
        className="relative bg-white shadow-2xl"
        style={{ aspectRatio: '2 / 1.414' }} // A4 double page ratio
      >
        {/* Center binding line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300 z-10" />

        {/* Page shadows for realism */}
        <div className="absolute left-1/2 top-0 bottom-0 w-4 -ml-2 bg-gradient-to-r from-transparent via-gray-200/50 to-transparent z-10 pointer-events-none" />

        {/* Slots */}
        {slots.map((slot) => {
          const image = getSlotImage(slot.id);
          const style = getSlotStyle(slot);

          return (
            <div
              key={slot.id}
              style={style}
              className="group"
            >
              {image ? (
                <div className="relative w-full h-full">
                  <img
                    src={getMediumImageUrl(image.filename)}
                    alt={image.title || 'Image'}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay actions on hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => onSlotClick(slot.id)}
                      className="p-2 bg-white/20 hover:bg-white/30 rounded-lg backdrop-blur-sm"
                      title="Changer l'image"
                    >
                      <Plus className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={() => onRemoveImage(slot.id)}
                      className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-lg backdrop-blur-sm"
                      title="Supprimer l'image"
                    >
                      <X className="w-5 h-5 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => onSlotClick(slot.id)}
                  className="w-full h-full border-2 border-dashed border-gray-300 hover:border-rose-400 hover:bg-rose-50/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-rose-500"
                >
                  <Plus className="w-8 h-8" />
                  <span className="text-sm">Ajouter une image</span>
                </button>
              )}
            </div>
          );
        })}

        {/* If no template or no slots, show placeholder */}
        {slots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">Aucun template sélectionné</p>
              <p className="text-sm">Choisissez un template pour commencer</p>
            </div>
          </div>
        )}
      </div>

      {/* Template name */}
      {template && (
        <div className="text-center mt-4 text-sm text-gray-400">
          Template: {template.name}
        </div>
      )}
    </div>
  );
}
