import React from 'react';
import { PAGE_SETTINGS_CONTENT_PADDING } from '../layout/pageLayout';

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

        {/* Contenu scrollable — padding aligné sur pageLayout (zone réglages) */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className={`mx-auto max-w-3xl ${PAGE_SETTINGS_CONTENT_PADDING}`}>
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
