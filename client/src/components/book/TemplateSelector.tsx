import { X, Check } from 'lucide-react';
import type { PageTemplate, LayoutSlot } from '../../types';

interface TemplateSelectorProps {
  templates: PageTemplate[];
  currentTemplateId?: string | null;
  onSelect: (templateId: string) => void;
  onClose: () => void;
}

// Mini preview of a template layout
function TemplatePreview({ template }: { template: PageTemplate }) {
  const slots = template.layout?.slots || [];

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
    <div
      className="relative bg-white border border-gray-300"
      style={{ aspectRatio: '2 / 1.414' }}
    >
      {/* Center line */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200" />

      {/* Slots */}
      {slots.map((slot) => (
        <div
          key={slot.id}
          style={getSlotStyle(slot)}
          className="bg-rose-100 border border-rose-200"
        />
      ))}
    </div>
  );
}

export function TemplateSelector({ templates, currentTemplateId, onSelect, onClose }: TemplateSelectorProps) {
  const predefinedTemplates = templates.filter(t => t.is_predefined);
  const customTemplates = templates.filter(t => !t.is_predefined);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Choisir un template</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Predefined templates */}
          <div className="mb-8">
            <h3 className="text-lg font-medium mb-4 text-gray-300">Templates prédéfinis</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {predefinedTemplates.map(template => {
                const isSelected = template.id === currentTemplateId;
                return (
                  <button
                    key={template.id}
                    onClick={() => onSelect(template.id)}
                    className={`
                      relative p-3 rounded-lg border-2 transition-all text-left
                      ${isSelected
                        ? 'border-rose-500 bg-rose-500/10'
                        : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                      }
                    `}
                  >
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}

                    <TemplatePreview template={template} />

                    <div className="mt-3">
                      <p className="font-medium text-sm">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-gray-400 mt-1">{template.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {template.layout?.slots?.length || 0} emplacement{(template.layout?.slots?.length || 0) > 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom templates */}
          {customTemplates.length > 0 && (
            <div>
              <h3 className="text-lg font-medium mb-4 text-gray-300">Vos templates</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {customTemplates.map(template => {
                  const isSelected = template.id === currentTemplateId;
                  return (
                    <button
                      key={template.id}
                      onClick={() => onSelect(template.id)}
                      className={`
                        relative p-3 rounded-lg border-2 transition-all text-left
                        ${isSelected
                          ? 'border-rose-500 bg-rose-500/10'
                          : 'border-gray-700 hover:border-gray-600 bg-gray-800'
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <TemplatePreview template={template} />

                      <div className="mt-3">
                        <p className="font-medium text-sm">{template.name}</p>
                        {template.description && (
                          <p className="text-xs text-gray-400 mt-1">{template.description}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
