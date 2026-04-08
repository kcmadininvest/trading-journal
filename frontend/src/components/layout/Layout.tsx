import React from 'react';
import { User } from '../../services/auth';
import Header from './Header';
import Footer from './Footer';

interface LayoutProps {
  currentUser: User;
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({
  currentUser,
  currentPage,
  onNavigate,
  onLogout,
  children,
}) => {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header fixed : le padding du main évite le chevauchement ; flex-1 sur main colle le footer en bas quand le contenu est court */}
      <Header
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <main className="flex w-full flex-1 flex-col min-h-0 bg-gray-50 dark:bg-gray-900 pt-16 sm:pt-20">
        {/* Espacement sous le header : géré par PageShell (pageLayout) */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};

export default Layout;
