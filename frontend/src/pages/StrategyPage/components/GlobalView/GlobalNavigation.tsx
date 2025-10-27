import React from 'react';

interface GlobalNavigationProps {
  currentYear: number;
  onNavigateYear: (direction: 'prev' | 'next') => void;
  onGoToCurrentYear: () => void;
}

const GlobalNavigation: React.FC<GlobalNavigationProps> = ({
  currentYear,
  onNavigateYear,
  onGoToCurrentYear
}) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => onNavigateYear('prev')}
          className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h2 className="text-2xl font-bold text-gray-900">
          Année {currentYear}
        </h2>
        
        <button
          onClick={() => onNavigateYear('next')}
          className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <button
        onClick={onGoToCurrentYear}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Année Courante
      </button>
    </div>
  );
};

export default GlobalNavigation;
