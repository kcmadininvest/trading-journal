import React, { useState, useEffect } from 'react';
import { authService } from '../../services/auth';
import cacheManager from '../../services/cacheManager';

/**
 * Composant de débogage pour tester l'isolation des données entre utilisateurs
 */
const UserDataIsolation: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    
    const stats = cacheManager.getCacheStats();
    setCacheStats(stats);
  }, []);

  const clearAllCaches = () => {
    cacheManager.clearAllCaches();
    const stats = cacheManager.getCacheStats();
    setCacheStats(stats);
    alert('Cache nettoyé !');
  };

  const clearUserCache = () => {
    cacheManager.clearUserCache();
    const stats = cacheManager.getCacheStats();
    setCacheStats(stats);
    alert('Cache utilisateur nettoyé !');
  };

  // Afficher seulement en mode développement
  if (process.env.NODE_ENV !== 'development' || !isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white p-2 rounded-full text-xs z-50"
        title="Debug: Isolation des données"
      >
        🐛
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-gray-800">Debug: Isolation des données</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 text-xs">
        <div>
          <strong>Utilisateur actuel:</strong>
          <div className="text-gray-600">
            {currentUser ? (
              <>
                <div>ID: {currentUser.id}</div>
                <div>Email: {currentUser.email}</div>
                <div>Rôle: {currentUser.role}</div>
              </>
            ) : (
              <div className="text-red-500">Non connecté</div>
            )}
          </div>
        </div>

        <div>
          <strong>Statistiques du cache:</strong>
          <div className="text-gray-600">
            {cacheStats ? (
              <>
                <div>Total entrées: {cacheStats.totalEntries}</div>
                <div>Entrées utilisateur: {cacheStats.userEntries}</div>
                <div>Taille: {Math.round(cacheStats.totalSize / 1024)} KB</div>
              </>
            ) : (
              <div>Chargement...</div>
            )}
          </div>
        </div>

        <div className="flex space-x-2">
          <button
            onClick={clearUserCache}
            className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
          >
            Nettoyer cache utilisateur
          </button>
          <button
            onClick={clearAllCaches}
            className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
          >
            Nettoyer tout
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDataIsolation;