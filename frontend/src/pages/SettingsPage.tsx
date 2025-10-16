import React, { useState, useEffect } from 'react';
import { User as AuthUser } from '../services/auth';
import SettingsNavigation from '../components/Settings/SettingsNavigation';
import UsersManagement from '../components/Settings/UsersManagement';
import SystemSettings from '../components/Settings/SystemSettings';

interface SettingsPageProps {
  currentUser: AuthUser;
  onUserUpdate?: (updatedUser: AuthUser) => void;
}

function SettingsPage({ currentUser, onUserUpdate }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState('users');

  useEffect(() => {
    function onHashChange() {
      const hash = window.location.hash;
      if (hash === '#settings-users') {
        setActiveSection('users');
      } else if (hash === '#settings-system') {
        setActiveSection('system');
      } else {
        setActiveSection('users');
      }
    }

    // Set initial section based on current hash
    onHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const renderContent = () => {
    switch (activeSection) {
      case 'users':
        return <UsersManagement currentUser={currentUser} onUserUpdate={onUserUpdate} />;
      case 'system':
        return <SystemSettings currentUser={currentUser} />;
      default:
        return <UsersManagement currentUser={currentUser} onUserUpdate={onUserUpdate} />;
    }
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* En-tête */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Paramètres</h1>
          <p className="text-gray-600">Gérez les paramètres de l'application</p>
        </div>

        {/* Layout en 2 colonnes */}
        <div className="flex gap-6">
          {/* Sidebar de navigation des paramètres */}
          <div className="w-64 flex-shrink-0">
            <SettingsNavigation 
              currentUser={currentUser}
              activeSection={activeSection}
              onSectionChange={setActiveSection}
            />
          </div>

          {/* Contenu principal */}
          <div className="flex-1">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;

