import React, { useState, useEffect } from 'react';
import { log } from '../../utils';

interface DebugControlsProps {
  className?: string;
}

const DebugControls: React.FC<DebugControlsProps> = ({ className = '' }) => {
  const [isEnabled, setIsEnabled] = useState(log.isEnabled());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Afficher les contrôles seulement en développement
    setIsVisible(process.env.NODE_ENV === 'development');
  }, []);

  const handleToggle = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    log.setEnabled(newState);
  };

  const handleClearConsole = () => {
    console.clear();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <div className="bg-gray-800 text-white rounded-lg shadow-lg p-4 min-w-64">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Debug Controls</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">Console Logs</span>
            <button
              onClick={handleToggle}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                isEnabled 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-gray-600 hover:bg-gray-700 text-gray-300'
              }`}
            >
              {isEnabled ? 'ON' : 'OFF'}
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">Clear Console</span>
            <button
              onClick={handleClearConsole}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
            >
              Clear
            </button>
          </div>
          
          <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
            <p>Environment: {process.env.NODE_ENV}</p>
            <p>Logs: {isEnabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DebugControls;