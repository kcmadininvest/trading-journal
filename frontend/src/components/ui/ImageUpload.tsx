import React, { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { openMediaUrl, getFullMediaUrl } from '../../utils/mediaUrl';

export interface ImageUploadProps {
  value?: string; // URL de l'image existante
  thumbnailUrl?: string; // URL de la miniature
  onUpload: (urls: { original: string; thumbnail: string }) => void;
  onRemove: () => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  uploadFunction: (file: File) => Promise<{ original_url: string; thumbnail_url: string }>;
  deleteFunction?: (url: string) => Promise<{ message: string }>; // Fonction de suppression (optionnelle)
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  thumbnailUrl,
  onUpload,
  onRemove,
  disabled = false,
  label,
  description,
  uploadFunction,
  deleteFunction,
}) => {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): boolean => {
    setError(null);

    // Vérifier le type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError(t('trades:strategyCompliance.invalidFileType', { 
        defaultValue: 'Type de fichier non autorisé. Formats acceptés : JPG, PNG, WebP' 
      }));
      return false;
    }

    // Vérifier la taille (5 MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(t('trades:strategyCompliance.fileTooLarge', { 
        defaultValue: 'Le fichier est trop volumineux. Taille maximale : 5 MB' 
      }));
      return false;
    }

    if (file.size === 0) {
      setError(t('trades:strategyCompliance.fileEmpty', { 
        defaultValue: 'Le fichier est vide' 
      }));
      return false;
    }

    return true;
  }, [t]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!validateFile(file)) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Simuler une progression
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await uploadFunction(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Appeler le callback avec les URLs
      onUpload({
        original: response.original_url,
        thumbnail: response.thumbnail_url,
      });

      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    } catch (err: any) {
      setError(err.message || t('trades:strategyCompliance.uploadError', { 
        defaultValue: 'Erreur lors de l\'upload' 
      }));
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [validateFile, uploadFunction, onUpload, t]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isUploading) {
      setIsDragging(true);
    }
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isUploading) {
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  }, [disabled, isUploading, handleFileUpload]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
    // Réinitialiser l'input pour permettre de sélectionner le même fichier
    e.target.value = '';
  }, [handleFileUpload]);

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isUploading || isDeleting) {
      return;
    }

    // Si une fonction de suppression est fournie et que l'URL est un fichier uploadé
    if (deleteFunction && value && value.startsWith('/media/')) {
      setIsDeleting(true);
      setError(null);
      
      try {
        await deleteFunction(value);
        onRemove();
      } catch (err: any) {
        setError(err.message || t('trades:strategyCompliance.deleteError', { 
          defaultValue: 'Erreur lors de la suppression' 
        }));
      } finally {
        setIsDeleting(false);
      }
    } else {
      // Suppression simple (pas de fichier serveur à supprimer)
      onRemove();
      setError(null);
    }
  }, [disabled, isUploading, isDeleting, deleteFunction, value, onRemove, t]);

  const handleOpenImage = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (value) {
      openMediaUrl(value);
    }
  }, [value]);

  // Si une image est déjà uploadée
  if (value && !isUploading) {
    const imageUrl = thumbnailUrl || value;
    
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative group">
          <div className="relative w-full aspect-video max-w-md rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
            <img
              src={getFullMediaUrl(imageUrl)}
              alt="Screenshot"
              className="w-full h-full object-contain"
            />
            {/* Overlay au hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleOpenImage}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                {t('trades:strategyCompliance.openImage', { defaultValue: 'Ouvrir' })}
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled || isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('trades:strategyCompliance.deleting', { defaultValue: 'Suppression...' })}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {t('trades:strategyCompliance.removeScreenshot', { defaultValue: 'Supprimer' })}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        {description && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
    );
  }

  // Zone d'upload
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative w-full rounded-lg border-2 border-dashed transition-all cursor-pointer
          ${isDragging 
            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }
          ${disabled || isUploading ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-500 dark:border-red-500' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
          disabled={disabled || isUploading}
          className="hidden"
        />
        
        <div className="p-6 sm:p-8 text-center">
          {isUploading ? (
            <div className="space-y-3">
              <div className="flex justify-center">
                <svg className="animate-spin h-10 w-10 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('trades:strategyCompliance.uploadingScreenshot', { defaultValue: 'Upload en cours...' })}
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-purple-600 dark:bg-purple-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{uploadProgress}%</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-center">
                <svg className="w-12 h-12 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('trades:strategyCompliance.dragDropHint', { 
                    defaultValue: 'Glissez-déposez une image ou cliquez pour sélectionner' 
                  })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('trades:strategyCompliance.supportedFormats', { defaultValue: 'Formats : JPG, PNG, WebP' })}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('trades:strategyCompliance.maxFileSize', { defaultValue: 'Taille max : 5 MB' })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 flex items-start gap-2">
          <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-900 dark:text-red-300">{error}</p>
        </div>
      )}

      {description && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      )}
    </div>
  );
};

export default ImageUpload;

