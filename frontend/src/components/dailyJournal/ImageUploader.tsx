import React from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface ImageUploaderProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onFilesSelected, disabled = false }) => {
  const { t } = useI18nTranslation();
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    disabled,
    multiple: true,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        onFilesSelected(acceptedFiles);
      }
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
        isDragActive ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700'
      } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input {...getInputProps()} />
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {isDragActive
          ? t('dailyJournal.dropzoneActive', { defaultValue: 'Deposez les images ici...' })
          : t('dailyJournal.dropzone', { defaultValue: 'Glissez-deposez des images ou cliquez pour selectionner' })}
      </p>
    </div>
  );
};
