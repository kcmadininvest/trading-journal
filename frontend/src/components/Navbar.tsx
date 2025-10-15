import React, { useState } from 'react';
import { authService, User } from '../services/auth';
import AuthModal from './auth/AuthModal';
import UserProfile from './auth/UserProfile';
import LogoutButton from './auth/LogoutButton';

export {};

interface NavbarProps {
  currentUser: User | null;
  onUserChange: (user: User | null) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentUser, onUserChange }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  const handleLogin = () => {
    setAuthMode('login');
    setShowAuthModal(true);
  };

  const handleRegister = () => {
    setAuthMode('register');
    setShowAuthModal(true);
  };

  const handleAuthSuccess = () => {
    const user = authService.getCurrentUser();
    onUserChange(user);
  };

  const handleLogout = () => {
    onUserChange(null);
  };

  const handleProfileClose = () => {
    setShowUserProfile(false);
  };

  const handlePasswordChanged = () => {
    // Optionnel : rafraîchir les données utilisateur
    const user = authService.getCurrentUser();
    onUserChange(user);
  };

  return (
    <>
      <nav className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-800">
                  📊 Trading Journal
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {currentUser ? (
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">
                          {currentUser.first_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-sm font-medium text-gray-700">
                          {currentUser.full_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {currentUser.is_admin ? 'Administrateur' : 'Utilisateur'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setShowUserProfile(true)}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                    title="Profil utilisateur"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </button>
                  
                  <LogoutButton onLogout={handleLogout} />
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleLogin}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    Se connecter
                  </button>
                  <button
                    onClick={handleRegister}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    S'inscrire
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authMode}
      />

      {showUserProfile && currentUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative">
            <button
              onClick={handleProfileClose}
              className="absolute -top-2 -right-2 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors z-10"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <UserProfile
              user={currentUser}
              onClose={handleProfileClose}
              onPasswordChanged={handlePasswordChanged}
            />
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
