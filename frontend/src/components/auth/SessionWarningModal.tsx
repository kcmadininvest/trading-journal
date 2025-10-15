import React, { useState, useEffect } from 'react';
import sessionManager, { SessionWarning } from '../../services/sessionManager';

interface SessionWarningModalProps {
  warning: SessionWarning;
  onExtend: () => void;
  onDismiss: () => void;
}

const SessionWarningModal: React.FC<SessionWarningModalProps> = ({
  warning,
  onExtend,
  onDismiss
}) => {
  const [timeRemaining, setTimeRemaining] = useState(warning.timeRemaining);
  const [isExtending, setIsExtending] = useState(false);

  useEffect(() => {
    setTimeRemaining(warning.timeRemaining);
  }, [warning.timeRemaining]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  const handleExtend = async () => {
    setIsExtending(true);
    try {
      const success = await sessionManager.extendSession();
      if (success) {
        onExtend();
      } else {
        onDismiss();
      }
    } catch (error) {
      console.error('Erreur lors de l\'extension de la session:', error);
      onDismiss();
    } finally {
      setIsExtending(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getModalStyle = () => {
    switch (warning.type) {
      case 'critical':
        return 'bg-red-600 border-red-500';
      case 'warning':
        return 'bg-yellow-600 border-yellow-500';
      default:
        return 'bg-gray-600 border-gray-500';
    }
  };

  const getIcon = () => {
    switch (warning.type) {
      case 'critical':
        return (
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`w-full max-w-md mx-auto bg-white rounded-xl shadow-2xl border-2 ${getModalStyle()}`}>
        {/* Header */}
        <div className={`px-6 py-4 ${getModalStyle()} rounded-t-xl`}>
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              {getIcon()}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {warning.type === 'critical' ? 'Session sur le point d\'expirer' : 'Avertissement de session'}
              </h3>
              <p className="text-sm text-white opacity-90">
                Temps restant : {formatTime(timeRemaining)}
              </p>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 text-center">
              {warning.message}
            </p>
          </div>

          {/* Barre de progression */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  warning.type === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                }`}
                style={{ 
                  width: `${Math.max(0, (timeRemaining / warning.timeRemaining) * 100)}%` 
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            {warning.showExtendButton && (
              <button
                onClick={handleExtend}
                disabled={isExtending}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isExtending ? 'Extension...' : 'Étendre la session'}
              </button>
            )}
            <button
              onClick={onDismiss}
              className="flex-1 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors font-medium"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;
