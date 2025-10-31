import React from 'react';

interface FloatingActionButtonProps {
  onClick: () => void;
  title?: string;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onClick, title }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title || 'Importer des trades'}
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 flex items-center justify-center"
    >
      {/* Upload icon */}
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
      </svg>
    </button>
  );
};


