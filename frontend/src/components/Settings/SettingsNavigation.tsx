import React from 'react';
import { User } from '../../services/auth';

interface SettingsNavigationProps {
  currentUser: User;
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const SettingsNavigation: React.FC<SettingsNavigationProps> = ({
  currentUser,
  activeSection,
  onSectionChange
}) => {
  const settingsSections = [
    {
      id: 'users',
      label: 'Utilisateurs',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
      description: 'Gestion des utilisateurs',
      hash: '#settings-users',
      adminOnly: true
    },
    {
      id: 'system',
      label: 'Système',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      description: 'Configuration système',
      hash: '#settings-system',
      adminOnly: true
    }
  ];

  const handleSectionClick = (section: any) => {
    onSectionChange(section.id);
    window.location.hash = section.hash;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Sections</h2>
      
      <nav className="space-y-2">
        {settingsSections.map((section) => {
          // Masquer les sections admin pour les utilisateurs normaux
          if (section.adminOnly && !currentUser.is_admin) {
            return null;
          }

          const isActive = activeSection === section.id;
          
          return (
            <button
              key={section.id}
              onClick={() => handleSectionClick(section)}
              className={`w-full flex items-center gap-3 px-3 py-3 text-left rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={`flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {section.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{section.label}</div>
                <div className={`text-sm truncate ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {section.description}
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default SettingsNavigation;

