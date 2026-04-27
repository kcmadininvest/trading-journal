import React from 'react';

interface SettingsLayoutProps {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  header?: React.ReactNode;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({
  sidebar,
  children,
  header,
}) => {
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header avec messages/notifications */}
      {header && <div className="flex-shrink-0">{header}</div>}

      {/* Contenu principal avec sidebar */}
      <div className="flex min-h-0 flex-1 overflow-hidden lg:gap-8">
        {/* Sidebar */}
        <div className="hidden flex-shrink-0 lg:block">
          {sidebar}
        </div>

        {/* Contenu scrollable — px / pt comme PageShell ; pb large sur mobile (barre d’onglets) */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="mx-auto w-full max-w-3xl px-3 pt-6 pb-28 sm:px-4 md:px-6 lg:px-8 xl:max-w-5xl 2xl:max-w-6xl lg:pb-8">
            {children}
          </div>
        </div>
      </div>

      {/* Mobile sidebar (bottom tabs) */}
      <div className="lg:hidden flex-shrink-0">
        {sidebar}
      </div>
    </div>
  );
};
