import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Maximize2, Minimize2 } from 'lucide-react';
import { getMediumImageUrl } from '../../api/client';
import type { BookPage, PageTemplate, Image, LayoutSlot, TextSlotData, TextStyle } from '../../types';

interface BookSlideshowProps {
  pages: BookPage[];
  templates: PageTemplate[];
  initialPageIndex?: number;
  onClose: () => void;
}

export function BookSlideshow({ pages, templates, initialPageIndex = 0, onClose }: BookSlideshowProps) {
  const [currentIndex, setCurrentIndex] = useState(initialPageIndex);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const currentPage = pages[currentIndex];
  const template = templates.find(t => t.id === currentPage?.template_id);

  // Navigation functions
  const goToNext = useCallback(() => {
    if (currentIndex < pages.length - 1 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, pages.length, isTransitioning]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0 && !isTransitioning) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex(prev => prev - 1);
        setIsTransitioning(false);
      }, 300);
    }
  }, [currentIndex, isTransitioning]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          goToNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrev();
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNext, goToPrev, onClose]);

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (currentIndex < pages.length - 1) {
        goToNext();
      } else {
        setIsPlaying(false);
      }
    }, 5000); // 5 seconds per page

    return () => clearInterval(interval);
  }, [isPlaying, currentIndex, pages.length, goToNext]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Get text style classes
  const getTextStyleClasses = (style?: TextStyle): string => {
    const classes: string[] = [];

    switch (style?.fontSize) {
      case 'small': classes.push('text-sm md:text-base'); break;
      case 'large': classes.push('text-xl md:text-2xl'); break;
      case 'xlarge': classes.push('text-2xl md:text-4xl'); break;
      default: classes.push('text-base md:text-lg'); break;
    }

    switch (style?.fontFamily) {
      case 'serif': classes.push('font-serif'); break;
      case 'mono': classes.push('font-mono'); break;
      default: classes.push('font-sans'); break;
    }

    if (style?.fontWeight === 'bold') classes.push('font-bold');
    if (style?.fontStyle === 'italic') classes.push('italic');

    switch (style?.textAlign) {
      case 'center': classes.push('text-center'); break;
      case 'right': classes.push('text-right'); break;
      default: classes.push('text-left'); break;
    }

    return classes.join(' ');
  };

  // Calculate slot position
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

  // Render annotation
  const renderAnnotation = (slotData: any, image: Image) => {
    const annotation = slotData?.annotation;
    if (!annotation) return null;

    const showAny = annotation.show_title || annotation.show_description || annotation.show_paragraph;
    if (!showAny) return null;

    const title = annotation.use_image_metadata && image.title ? image.title : annotation.title;
    const description = annotation.use_image_metadata && image.description ? image.description : annotation.description;
    const paragraph = annotation.paragraph;
    const position = (annotation.position || 'bottom') as 'bottom' | 'top' | 'overlay' | 'side';

    const positionClasses: Record<'bottom' | 'top' | 'overlay' | 'side', string> = {
      bottom: 'absolute bottom-0 left-0 right-0',
      top: 'absolute top-0 left-0 right-0',
      overlay: 'absolute inset-0 flex items-center justify-center',
      side: 'absolute right-0 top-0 bottom-0 w-1/3'
    };

    const bgClasses: Record<'bottom' | 'top' | 'overlay' | 'side', string> = {
      bottom: 'bg-gradient-to-t from-black/80 via-black/50 to-transparent p-4 md:p-6 pt-12',
      top: 'bg-gradient-to-b from-black/80 via-black/50 to-transparent p-4 md:p-6 pb-12',
      overlay: 'bg-black/60 p-6 text-center',
      side: 'bg-black/70 p-4 flex flex-col justify-center'
    };

    return (
      <div className={`${positionClasses[position]} z-20`}>
        <div className={bgClasses[position]}>
          {annotation.show_title && title && (
            <h3 className="text-white font-semibold text-lg md:text-xl leading-tight mb-2 drop-shadow-lg">
              {title}
            </h3>
          )}
          {annotation.show_description && description && (
            <p className="text-white/90 text-sm md:text-base leading-snug mb-2 drop-shadow">
              {description}
            </p>
          )}
          {annotation.show_paragraph && paragraph && (
            <p className="text-white/80 text-sm md:text-base leading-relaxed italic drop-shadow">
              {paragraph}
            </p>
          )}
        </div>
      </div>
    );
  };

  // Render a page spread
  const renderPageSpread = (page: BookPage, pageTemplate?: PageTemplate) => {
    const slots = pageTemplate?.layout?.slots || [];
    const pageData = page.page_data;
    const pageImages = page.images || [];
    const pageImageMap = new Map<string, Image>();
    pageImages.forEach(img => pageImageMap.set(img.id, img));

    const getSlotData = (slotId: string) => pageData?.slots?.find(s => s.slot_id === slotId);
    const getTextSlotData = (slotId: string): TextSlotData | undefined => pageData?.textSlots?.find(s => s.slot_id === slotId);
    const getSlotImage = (slotId: string) => {
      const slotData = getSlotData(slotId);
      if (!slotData) return undefined;
      return pageImageMap.get(slotData.image_id);
    };

    return (
      <div
        className="relative bg-white shadow-2xl w-full h-full"
        style={{ aspectRatio: '2 / 1.414' }}
      >
        {/* Center binding line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 z-10" />
        <div className="absolute left-1/2 top-0 bottom-0 w-6 -ml-3 bg-gradient-to-r from-transparent via-gray-100/50 to-transparent z-10 pointer-events-none" />

        {/* Render slots */}
        {slots.map((slot) => {
          const style = getSlotStyle(slot);
          const slotType = slot.type || 'image';

          if (slotType === 'text') {
            const textData = getTextSlotData(slot.id);
            const hasContent = textData?.content && textData.content.trim().length > 0;

            return (
              <div key={slot.id} style={style} className="overflow-hidden">
                {hasContent && (
                  <div
                    className={`w-full h-full p-4 md:p-6 overflow-auto ${getTextStyleClasses(textData?.style)}`}
                    style={{ color: textData?.style?.color || '#1f2937' }}
                  >
                    {textData?.content.split('\n').map((line, i) => (
                      <p key={i} className="mb-3 last:mb-0">{line || '\u00A0'}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // Image slot
          const slotData = getSlotData(slot.id);
          const image = getSlotImage(slot.id);

          return (
            <div key={slot.id} style={style} className="overflow-hidden">
              {image && (
                <div className="relative w-full h-full">
                  <img
                    src={getMediumImageUrl(image.filename)}
                    alt={image.title || 'Image'}
                    className="w-full h-full object-cover"
                  />
                  {renderAnnotation(slotData, image)}
                </div>
              )}
            </div>
          );
        })}

        {slots.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <p>Page vide</p>
          </div>
        )}
      </div>
    );
  };

  if (!currentPage) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <p className="text-white">Aucune page à afficher</p>
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-white">
          <X className="w-8 h-8" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300">
        <div className="text-white text-sm font-medium">
          Page {currentIndex + 1} / {pages.length}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title={isPlaying ? 'Pause (P)' : 'Lecture auto (P)'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Plein écran (F)"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div
          className={`w-full max-w-6xl transition-all duration-300 ease-in-out ${
            isTransitioning ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {renderPageSpread(currentPage, template)}
        </div>
      </div>

      {/* Navigation buttons */}
      <button
        onClick={goToPrev}
        disabled={currentIndex === 0}
        className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 md:p-4 text-white rounded-full transition-all duration-300 ${
          currentIndex === 0
            ? 'opacity-20 cursor-not-allowed'
            : 'bg-white/10 hover:bg-white/20 opacity-50 hover:opacity-100'
        }`}
      >
        <ChevronLeft className="w-8 h-8 md:w-10 md:h-10" />
      </button>

      <button
        onClick={goToNext}
        disabled={currentIndex >= pages.length - 1}
        className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 md:p-4 text-white rounded-full transition-all duration-300 ${
          currentIndex >= pages.length - 1
            ? 'opacity-20 cursor-not-allowed'
            : 'bg-white/10 hover:bg-white/20 opacity-50 hover:opacity-100'
        }`}
      >
        <ChevronRight className="w-8 h-8 md:w-10 md:h-10" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
        <div
          className="h-full bg-rose-500 transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / pages.length) * 100}%` }}
        />
      </div>

      {/* Page indicators */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 hover:opacity-100 transition-opacity">
        {pages.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (!isTransitioning) {
                setIsTransitioning(true);
                setTimeout(() => {
                  setCurrentIndex(idx);
                  setIsTransitioning(false);
                }, 300);
              }
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              idx === currentIndex
                ? 'bg-rose-500 w-6'
                : 'bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 right-4 text-white/30 text-xs hidden md:block opacity-0 hover:opacity-100 transition-opacity">
        ← → Navigation • Espace Suivant • P Lecture • F Plein écran • Échap Fermer
      </div>
    </div>
  );
}
