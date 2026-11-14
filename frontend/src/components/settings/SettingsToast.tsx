import React, { useEffect } from 'react';

interface SettingsToastProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
  duration?: number;
}

export const SettingsToast: React.FC<SettingsToastProps> = ({
  type,
  message,
  onClose,
  duration,
}) => {
  const autoCloseMs = duration ?? (type === 'error' ? 12000 : 5000);

  useEffect(() => {
    const timer = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(timer);
  }, [autoCloseMs, onClose]);

  const config = {
    success: {
      bg: 'bg-emerald-600',
      border: 'border-emerald-700',
      text: 'text-white',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      ),
    },
    error: {
      bg: 'bg-red-700',
      border: 'border-red-800',
      text: 'text-white',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
        </svg>
      ),
    },
    info: {
      bg: 'bg-blue-700',
      border: 'border-blue-800',
      text: 'text-white',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      ),
    },
  };

  const { bg, border, text, icon } = config[type];

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      className="pointer-events-auto fixed top-20 right-4 z-[200] w-[min(28rem,calc(100vw-2rem))] animate-slide-in-right"
    >
      <div className={`${bg} ${border} ${text} border rounded-lg shadow-2xl p-4`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">{icon}</div>
          <p className="flex-1 text-sm font-semibold leading-snug break-words whitespace-pre-wrap">
            {message}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded p-0.5 text-white/80 hover:text-white hover:bg-black/10"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
