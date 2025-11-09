import React from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  title?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, title }) => {
  // Déterminer l'icône selon le titre
  const isCreateGoal = title?.toLowerCase().includes('objectif') || title?.toLowerCase().includes('goal');
  const isImport = title?.toLowerCase().includes('importer') || title?.toLowerCase().includes('import');
  
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || 'Action'}
      className="fixed bottom-10 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 dark:bg-blue-500 text-white shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-700 flex items-center justify-center transition-transform hover:scale-110"
    >
      {isCreateGoal ? (
        // Plus icon pour créer un objectif
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ) : isImport ? (
        // Upload icon pour importer
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
        </svg>
      ) : (
        // Plus icon par défaut
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      )}
    </button>
  );
};


