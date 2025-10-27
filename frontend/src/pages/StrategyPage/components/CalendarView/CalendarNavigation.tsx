import React from 'react';

interface CalendarNavigationProps {
  currentDate: Date;
  monthlyTotal: number;
  onNavigateMonth: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  isUpdatingStrategy: boolean;
}

const CalendarNavigation: React.FC<CalendarNavigationProps> = ({
  currentDate,
  monthlyTotal,
  onNavigateMonth,
  onGoToToday,
  isUpdatingStrategy
}) => {
  const monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => onNavigateMonth('prev')}
          className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        
        <h2 className="text-2xl font-bold text-gray-900">
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        
        <button
          onClick={() => onNavigateMonth('next')}
          className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="text-sm text-gray-600">P/L Mensuel:</div>
        <div className={`text-2xl font-bold ${monthlyTotal >= 0 ? 'text-blue-600' : 'text-gray-600'}`}>
          {formatCurrency(monthlyTotal)}
        </div>
        {/* Indicateur de mise à jour en cours */}
        {isUpdatingStrategy && (
          <div className="flex items-center space-x-1 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Mise à jour...</span>
          </div>
        )}
      </div>
      
      <button
        onClick={onGoToToday}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Aujourd'hui
      </button>
    </div>
  );
};

export default CalendarNavigation;
