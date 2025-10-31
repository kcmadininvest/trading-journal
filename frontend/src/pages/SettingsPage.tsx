import React from 'react';

const SettingsPage: React.FC = () => {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">
          Cette page permettra de configurer vos paramètres. Fonctionnalités à venir :
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          <li>• Paramètres du profil</li>
          <li>• Préférences d'affichage</li>
          <li>• Notifications</li>
          <li>• Sécurité et confidentialité</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsPage;
