import React, { useState } from 'react';
import { authService } from '../../services/auth';

export {};

interface LogoutButtonProps {
  onLogout: () => void;
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ 
  onLogout, 
  className = '', 
  showText = true,
  size = 'md'
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
      onLogout();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Déconnexion locale même en cas d'erreur
      onLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'p-1',
    md: 'p-2',
    lg: 'p-3'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={`
        flex items-center gap-2 
        text-gray-400 hover:text-red-400 
        hover:bg-red-900/20 
        transition-colors rounded-md
        ${sizeClasses[size]}
        ${className}
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      title="Se déconnecter"
    >
      {isLoading ? (
        <div className={`${iconSizes[size]} animate-spin`}>
          <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
      ) : (
        <svg className={iconSizes[size]} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      )}
      {showText && (
        <span className="text-sm font-medium">
          {isLoading ? 'Déconnexion...' : 'Se déconnecter'}
        </span>
      )}
    </button>
  );
};

export default LogoutButton;
