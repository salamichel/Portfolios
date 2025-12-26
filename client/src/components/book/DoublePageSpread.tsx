import { useMemo } from 'react';
import { Plus, X, Type, Edit3 } from 'lucide-react';
import { getMediumImageUrl } from '../../api/client';
import { renderRichText, hasRichFormatting } from '../../utils/richTextParser';
import type { BookPage, PageTemplate, Image, LayoutSlot, PageSlotData, TextSlotData, TextStyle } from '../../types';

interface DoublePageSpreadProps {
  page: BookPage;
  template?: PageTemplate;
  onSlotClick: (slotId: string) => void;
  onRemoveImage: (slotId: string) => void;
  onEditAnnotation: (slotId: string, image: Image) => void;
  onEditTextSlot: (slotId: string) => void;
}

export function DoublePageSpread({ page, template, onSlotClick, onRemoveImage, onEditAnnotation, onEditTextSlot }: DoublePageSpreadProps) {
  const slots = template?.layout?.slots || [];
  const pageData = page.page_data;
  const images = page.images || [];

  // Create a map of image_id to image for quick lookup
  const imageMap = useMemo(() => {
    const map = new Map<string, Image>();
    images.forEach(img => map.set(img.id, img));
    return map;
  }, [images]);

  // Get slot data for an image slot
  const getSlotData = (slotId: string): PageSlotData | undefined => {
    return pageData?.slots?.find(s => s.slot_id === slotId);
  };

  // Get text slot data
  const getTextSlotData = (slotId: string): TextSlotData | undefined => {
    return pageData?.textSlots?.find(s => s.slot_id === slotId);
  };

  // Get assigned image for a slot
  const getSlotImage = (slotId: string): Image | undefined => {
    const slotData = getSlotData(slotId);
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

  // Get text style classes
  const getTextStyleClasses = (style?: TextStyle): string => {
    const classes: string[] = [];

    // Font size
    switch (style?.fontSize) {
      case 'small': classes.push('text-xs'); break;
      case 'large': classes.push('text-lg'); break;
      case 'xlarge': classes.push('text-2xl'); break;
      default: classes.push('text-sm'); break;
    }

    // Font family
    switch (style?.fontFamily) {
      case 'serif': classes.push('font-serif'); break;
      case 'mono': classes.push('font-mono'); break;
      default: classes.push('font-sans'); break;
    }

    // Font weight
    if (style?.fontWeight === 'bold') classes.push('font-bold');

    // Font style
    if (style?.fontStyle === 'italic') classes.push('italic');

    // Text align
    switch (style?.textAlign) {
      case 'center': classes.push('text-center'); break;
      case 'right': classes.push('text-right'); break;
      default: classes.push('text-left'); break;
    }

    return classes.join(' ');
  };

  // Render annotation overlay
  const renderAnnotation = (slotData: PageSlotData | undefined, image: Image) => {
    const annotation = slotData?.annotation;
    if (!annotation) return null;

    const showAny = annotation.show_title || annotation.show_description || annotation.show_paragraph;
    if (!showAny) return null;

    // Get display values (use image metadata if flagged)
    const title = annotation.use_image_metadata && image.title ? image.title : annotation.title;
    const description = annotation.use_image_metadata && image.description ? image.description : annotation.description;
    const paragraph = annotation.paragraph;

    const position = annotation.position || 'bottom';

    const positionClasses = {
      bottom: 'absolute bottom-0 left-0 right-0',
      top: 'absolute top-0 left-0 right-0',
      overlay: 'absolute inset-0 flex items-center justify-center',
      side: 'absolute right-0 top-0 bottom-0 w-1/3'
    };

    const bgClasses = {
      bottom: 'bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 pt-8',
      top: 'bg-gradient-to-b from-black/80 via-black/50 to-transparent p-3 pb-8',
      overlay: 'bg-black/60 p-4 text-center',
      side: 'bg-black/70 p-3 flex flex-col justify-center'
    };

    return (
      <div className={`${positionClasses[position]} pointer-events-none z-20`}>
        <div className={bgClasses[position]}>
          {annotation.show_title && title && (
            <h3 className="text-white font-semibold text-sm leading-tight mb-1 drop-shadow-lg">
              {title}
            </h3>
          )}
          {annotation.show_description && description && (
            <p className="text-white/90 text-xs leading-snug mb-1 drop-shadow">
              {description}
            </p>
          )}
          {annotation.show_paragraph && paragraph && (
            <p className="text-white/80 text-xs leading-relaxed italic drop-shadow">
              {paragraph}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Render image slot
  const renderImageSlot = (slot: LayoutSlot) => {
    const slotData = getSlotData(slot.id);
    const image = getSlotImage(slot.id);
    const hasAnnotation = slotData?.annotation && (
      slotData.annotation.show_title ||
      slotData.annotation.show_description ||
      slotData.annotation.show_paragraph
    );

    if (image) {
      return (
        <div className="relative w-full h-full overflow-hidden">
          <img
            src={getMediumImageUrl(image.filename)}
            alt={image.title || 'Image'}
            className="w-full h-full object-cover"
          />

          {/* Annotation display */}
          {renderAnnotation(slotData, image)}

          {/* Overlay actions on hover */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-30">
            <button
              onClick={() => onEditAnnotation(slot.id, image)}
              className={`p-2 rounded-lg backdrop-blur-sm ${
                hasAnnotation
                  ? 'bg-rose-500/70 hover:bg-rose-500/90'
                  : 'bg-white/20 hover:bg-white/30'
              }`}
              title="Annoter l'image"
            >
              <Type className="w-5 h-5 text-white" />
            </button>
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
      );
    }

    return (
      <button
        onClick={() => onSlotClick(slot.id)}
        className="w-full h-full border-2 border-dashed border-gray-300 hover:border-rose-400 hover:bg-rose-50/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-rose-500"
      >
        <Plus className="w-8 h-8" />
        <span className="text-sm">Ajouter une image</span>
      </button>
    );
  };

  // Render text slot
  const renderTextSlot = (slot: LayoutSlot) => {
    const textData = getTextSlotData(slot.id);
    const hasContent = textData?.content && textData.content.trim().length > 0;

    if (hasContent) {
      const styleClasses = getTextStyleClasses(textData?.style);
      const textColor = textData?.style?.color || '#1f2937';
      const isRichText = hasRichFormatting(textData!.content);

      return (
        <div className="relative w-full h-full overflow-hidden p-3">
          <div
            className={`w-full h-full overflow-auto ${styleClasses}`}
            style={{ color: textColor }}
          >
            {isRichText ? (
              renderRichText(textData!.content, styleClasses, textColor)
            ) : (
              textData?.content.split('\n').map((line, i) => (
                <p key={i} className="mb-2 last:mb-0">{line || '\u00A0'}</p>
              ))
            )}
          </div>

          {/* Edit overlay on hover */}
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-30">
            <button
              onClick={() => onEditTextSlot(slot.id)}
              className="p-3 bg-white/90 hover:bg-white rounded-lg shadow-lg"
              title="Modifier le texte"
            >
              <Edit3 className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      );
    }

    return (
      <button
        onClick={() => onEditTextSlot(slot.id)}
        className="w-full h-full border-2 border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-indigo-500"
      >
        <Type className="w-8 h-8" />
        <span className="text-sm">Ajouter du texte</span>
      </button>
    );
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
          const style = getSlotStyle(slot);
          const slotType = slot.type || 'image'; // Default to image for backward compatibility

          return (
            <div
              key={slot.id}
              style={style}
              className="group"
            >
              {slotType === 'text' ? renderTextSlot(slot) : renderImageSlot(slot)}
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
