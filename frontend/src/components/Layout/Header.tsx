import React, { useState } from 'react';
import { User, authService } from '../../services/auth';
import sessionManager from '../../services/sessionManager';
import EditableUserProfile from '../auth/EditableUserProfile';

interface HeaderProps {
  currentUser?: User | null;
  onUserChange: (user: User | null) => void;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentUser, onUserChange, onLogout }) => {
  const [showUserProfile, setShowUserProfile] = useState(false);

  const handleProfileClose = () => {
    setShowUserProfile(false);
  };

  const handleUserUpdated = (updatedUser: User) => {
    onUserChange(updatedUser);
  };

  const handlePasswordChanged = () => {
    // Optionnel : rafraîchir les données utilisateur
    const user = currentUser;
    if (user) {
      onUserChange(user);
    }
  };

  const handleLogout = async () => {
    try {
      // Arrêter le gestionnaire de session
      sessionManager.stop();
      
      // Déconnecter via le service d'authentification
      await authService.logout();
      
      // Notifier le composant parent
      onLogout();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
      // Déconnecter quand même côté frontend
      onLogout();
    }
  };

  return (
    <>
      <header className="bg-gray-800 text-white shadow-md sticky top-0 z-50">
        <div className="px-8 py-4 flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h1 className="text-2xl font-bold">Trading Journal</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {currentUser.first_name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium text-white">
                      {currentUser.full_name}
                    </p>
                    <p className="text-xs text-gray-300">
                      {currentUser.is_admin ? 'Administrateur' : 'Utilisateur'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowUserProfile(true)}
                  className="px-4 py-2 border border-gray-700 bg-gray-700 text-white rounded-md cursor-pointer text-sm transition-colors hover:bg-gray-600 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Profil
                </button>
                
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 border border-red-600 bg-red-600 text-white rounded-md cursor-pointer text-sm transition-colors hover:bg-red-700 flex items-center gap-2"
                  title="Se déconnecter"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Déconnexion
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button className="px-4 py-2 border border-gray-700 bg-gray-700 text-white rounded-md cursor-pointer text-sm transition-colors hover:bg-gray-600">
                  👤 Profil
                </button>
                <button className="px-4 py-2 bg-blue-600 border-blue-600 text-white rounded-md cursor-pointer text-sm transition-colors hover:bg-blue-700">
                  ⚙️ Paramètres
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showUserProfile && currentUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl">
            <EditableUserProfile
              user={currentUser}
              onClose={handleProfileClose}
              onUserUpdated={handleUserUpdated}
              onPasswordChanged={handlePasswordChanged}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Header;

