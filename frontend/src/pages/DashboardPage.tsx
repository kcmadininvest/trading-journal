import React, { useState } from 'react';
import { FloatingActionButton } from '../components/ui/FloatingActionButton';
import { ImportTradesModal } from '../components/trades/ImportTradesModal';
import { User } from '../services/auth';

interface DashboardPageProps {
  currentUser: User;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ currentUser }) => {
  const [showImport, setShowImport] = useState(false);
  return (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
          <div className="px-4 sm:px-6 lg:px-8">
            {/* Message de bienvenue */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full mb-6">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Bienvenue, {currentUser.first_name && currentUser.last_name 
                  ? `${currentUser.first_name} ${currentUser.last_name}` 
                  : currentUser.email} !
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Vous êtes connecté à votre journal de trading. Gérez vos trades et analysez vos performances.
              </p>
            </div>

        {/* User Info Card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-16 w-16">
                <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                  <span className="text-2xl font-medium text-gray-700">
                    {currentUser.first_name?.charAt(0) || currentUser.email.charAt(0).toUpperCase()}
                  </span>
        </div>
        <FloatingActionButton onClick={() => setShowImport(true)} title="Importer des trades" />
        <ImportTradesModal open={showImport} onClose={() => setShowImport(false)} />
              </div>
              <div className="ml-6">
                    <h2 className="text-2xl font-bold text-gray-900">
                      {currentUser.first_name && currentUser.last_name 
                        ? `${currentUser.first_name} ${currentUser.last_name}` 
                        : currentUser.email}
                    </h2>
                <p className="text-gray-600">{currentUser.email}</p>
                <div className="mt-2 flex items-center space-x-4">
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    currentUser.is_admin 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {currentUser.is_admin ? 'Administrateur' : 'Utilisateur'}
                  </span>
                  <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                    currentUser.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {currentUser.is_active ? 'Compte actif' : 'Compte inactif'}
                  </span>
                  {currentUser.is_verified && (
                    <span className="inline-flex px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800">
                      Email vérifié
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Membre depuis</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(currentUser.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Mes Trades</h3>
            <p className="text-gray-600 mb-4">
              Consultez et gérez tous vos trades enregistrés.
            </p>
            <button className="text-blue-600 hover:text-blue-800 font-medium">
              Voir mes trades →
            </button>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Statistiques</h3>
            <p className="text-gray-600 mb-4">
              Analysez vos performances avec des graphiques détaillés.
            </p>
            <button className="text-green-600 hover:text-green-800 font-medium">
              Voir les statistiques →
            </button>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-lg hover:shadow-xl transition-shadow">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Stratégies</h3>
            <p className="text-gray-600 mb-4">
              Développez et testez vos stratégies de trading.
            </p>
            <button className="text-purple-600 hover:text-purple-800 font-medium">
              Gérer les stratégies →
            </button>
          </div>
        </div>

        {/* Admin Section */}
        {currentUser.is_admin && (
          <div className="bg-white rounded-2xl p-8 shadow-xl">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Administration</h2>
                <p className="text-gray-600">Outils d'administration du système</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => window.location.hash = 'users'}
                className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <h3 className="font-semibold text-gray-900 mb-2">Gestion des utilisateurs</h3>
                <p className="text-sm text-gray-600">Gérer les comptes utilisateurs, rôles et permissions</p>
              </button>
              <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left">
                <h3 className="font-semibold text-gray-900 mb-2">Statistiques système</h3>
                <p className="text-sm text-gray-600">Consulter les statistiques globales du système</p>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
