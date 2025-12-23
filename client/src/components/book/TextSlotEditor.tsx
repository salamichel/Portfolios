import { useState } from 'react';
import { X, Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic } from 'lucide-react';
import type { TextSlotData, TextStyle } from '../../types';

interface TextSlotEditorProps {
  textSlot?: TextSlotData;
  onSave: (textSlot: TextSlotData) => void;
  onClose: () => void;
  slotId: string;
}

export function TextSlotEditor({ textSlot, onSave, onClose, slotId }: TextSlotEditorProps) {
  const [content, setContent] = useState(textSlot?.content || '');
  const [fontSize, setFontSize] = useState<TextStyle['fontSize']>(textSlot?.style?.fontSize || 'medium');
  const [fontFamily, setFontFamily] = useState<TextStyle['fontFamily']>(textSlot?.style?.fontFamily || 'sans');
  const [fontWeight, setFontWeight] = useState<TextStyle['fontWeight']>(textSlot?.style?.fontWeight || 'normal');
  const [fontStyle, setFontStyle] = useState<TextStyle['fontStyle']>(textSlot?.style?.fontStyle || 'normal');
  const [textAlign, setTextAlign] = useState<TextStyle['textAlign']>(textSlot?.style?.textAlign || 'left');
  const [color, setColor] = useState(textSlot?.style?.color || '#1f2937');

  const handleSave = () => {
    onSave({
      slot_id: slotId,
      content,
      style: {
        fontSize,
        fontFamily,
        fontWeight,
        fontStyle,
        textAlign,
        color
      }
    });
  };

  const fontSizeClasses: Record<NonNullable<TextStyle['fontSize']>, string> = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg',
    xlarge: 'text-2xl'
  };

  const fontFamilyClasses: Record<NonNullable<TextStyle['fontFamily']>, string> = {
    sans: 'font-sans',
    serif: 'font-serif',
    mono: 'font-mono'
  };

  const previewClasses = `
    ${fontSizeClasses[fontSize || 'medium']}
    ${fontFamilyClasses[fontFamily || 'sans']}
    ${fontWeight === 'bold' ? 'font-bold' : 'font-normal'}
    ${fontStyle === 'italic' ? 'italic' : ''}
    ${textAlign === 'center' ? 'text-center' : textAlign === 'right' ? 'text-right' : 'text-left'}
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Type className="w-5 h-5" />
            Zone de texte
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Text content */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contenu
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Votre texte ici..."
              rows={6}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          {/* Style options */}
          <div className="grid grid-cols-2 gap-4">
            {/* Font size */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Taille
              </label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as TextStyle['fontSize'])}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="small">Petit</option>
                <option value="medium">Moyen</option>
                <option value="large">Grand</option>
                <option value="xlarge">Très grand</option>
              </select>
            </div>

            {/* Font family */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Police
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value as TextStyle['fontFamily'])}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-rose-500"
              >
                <option value="sans">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </div>
          </div>

          {/* Text formatting */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Formatage
            </label>
            <div className="flex gap-2">
              {/* Bold */}
              <button
                type="button"
                onClick={() => setFontWeight(fontWeight === 'bold' ? 'normal' : 'bold')}
                className={`p-3 rounded-lg transition-colors ${
                  fontWeight === 'bold'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                title="Gras"
              >
                <Bold className="w-5 h-5" />
              </button>

              {/* Italic */}
              <button
                type="button"
                onClick={() => setFontStyle(fontStyle === 'italic' ? 'normal' : 'italic')}
                className={`p-3 rounded-lg transition-colors ${
                  fontStyle === 'italic'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                title="Italique"
              >
                <Italic className="w-5 h-5" />
              </button>

              <div className="w-px bg-gray-700 mx-2" />

              {/* Align left */}
              <button
                type="button"
                onClick={() => setTextAlign('left')}
                className={`p-3 rounded-lg transition-colors ${
                  textAlign === 'left'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                title="Aligner à gauche"
              >
                <AlignLeft className="w-5 h-5" />
              </button>

              {/* Align center */}
              <button
                type="button"
                onClick={() => setTextAlign('center')}
                className={`p-3 rounded-lg transition-colors ${
                  textAlign === 'center'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                title="Centrer"
              >
                <AlignCenter className="w-5 h-5" />
              </button>

              {/* Align right */}
              <button
                type="button"
                onClick={() => setTextAlign('right')}
                className={`p-3 rounded-lg transition-colors ${
                  textAlign === 'right'
                    ? 'bg-rose-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
                title="Aligner à droite"
              >
                <AlignRight className="w-5 h-5" />
              </button>

              <div className="w-px bg-gray-700 mx-2" />

              {/* Color */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer bg-transparent"
                  title="Couleur du texte"
                />
              </div>
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Aperçu
            </label>
            <div
              className={`bg-white rounded-lg p-4 min-h-[100px] ${previewClasses}`}
              style={{ color }}
            >
              {content || 'Aperçu du texte...'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-800 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!content.trim()}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
