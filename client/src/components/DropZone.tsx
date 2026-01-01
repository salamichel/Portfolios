import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2, Check } from 'lucide-react';
import { imagesApi } from '../api/client';
import type { Theme } from '../types';

interface DropZoneProps {
  themes: Theme[];
  onUploadComplete: () => void;
  preselectedThemeId?: string;
}

interface FileWithPreview extends File {
  preview: string;
}

export function DropZone({ themes, onUploadComplete, preselectedThemeId }: DropZoneProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string>(preselectedThemeId || '');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const filesWithPreview = acceptedFiles.map(file =>
      Object.assign(file, { preview: URL.createObjectURL(file) })
    );
    setFiles(prev => [...prev, ...filesWithPreview]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'image/tiff': ['.tif', '.tiff']
    },
    maxSize: 500 * 1024 * 1024
  });

  const removeFile = (index: number) => {
    setFiles(prev => {
      const newFiles = [...prev];
      URL.revokeObjectURL(newFiles[index].preview);
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(0);

    try {
      await imagesApi.upload(
        files,
        {
          theme_id: selectedTheme || undefined
        },
        setProgress
      );

      // Cleanup previews
      files.forEach(file => URL.revokeObjectURL(file.preview));
      setFiles([]);
      onUploadComplete();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive
            ? 'border-rose-500 bg-rose-500/10'
            : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className={`w-12 h-12 mx-auto mb-4 ${isDragActive ? 'text-rose-500' : 'text-gray-400'}`} />
        <p className="text-lg font-medium">
          {isDragActive ? 'Déposez les images ici...' : 'Glissez-déposez vos images ici'}
        </p>
        <p className="text-gray-400 mt-2">ou cliquez pour sélectionner</p>
        <p className="text-sm text-gray-500 mt-4">JPEG, PNG, GIF, WebP, TIFF • Max 500MB</p>
      </div>

      {/* Options */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-4 items-center bg-gray-800 rounded-lg p-4">
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-300 mb-1">Thème</label>
            <select
              value={selectedTheme}
              onChange={(e) => setSelectedTheme(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="">Sans thème</option>
              {themes.map(theme => (
                <option key={theme.id} value={theme.id}>{theme.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Preview Grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {files.map((file, index) => {
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
            const fileSizeKB = (file.size / 1024).toFixed(0);
            const displaySize = file.size >= 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

            return (
              <div key={index} className="relative group aspect-square">
                <img
                  src={file.preview}
                  alt={file.name}
                  className="w-full h-full object-cover rounded-lg"
                />
                {/* File size badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 rounded text-xs font-medium text-white">
                  {displaySize}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-2 right-2 p-1 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent rounded-b-lg">
                  <p className="text-xs truncate">{file.name}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Button */}
      {files.length > 0 && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Téléversement... {progress}%
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Téléverser {files.length} image{files.length > 1 ? 's' : ''}
              </>
            )}
          </button>

          {!uploading && (
            <button
              onClick={() => {
                files.forEach(f => URL.revokeObjectURL(f.preview));
                setFiles([]);
              }}
              className="px-6 py-3 border border-gray-600 hover:bg-gray-800 rounded-lg transition-colors"
            >
              Annuler
            </button>
          )}
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-rose-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
