import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-6 h-6 bg-blue-600 dark:bg-blue-500 rounded flex items-center justify-center mr-2">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              © 2025 Trading Journal. Tous droits réservés.
            </span>
          </div>
          
          <div className="flex items-center space-x-6">
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Version 1.0.0
            </span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 dark:bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-400 dark:text-gray-500">En ligne</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
