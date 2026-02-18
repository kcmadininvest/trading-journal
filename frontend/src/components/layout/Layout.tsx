import React from 'react';
import { User } from '../../services/auth';
import Header from './Header';
import Footer from './Footer';
import { MarketHoursWidget } from '../common/MarketHoursWidget';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header with integrated navigation */}
      <Header
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      {/* Barre horaires marchés - fixe sous le header, desktop uniquement */}
      <div className="hidden 2xl:flex fixed top-16 sm:top-20 left-0 right-0 z-20 justify-center items-start pointer-events-none">
        <div className="pointer-events-auto mt-3">
          <MarketHoursWidget />
        </div>
      </div>

      {/* Main content - full width */}
      <main className="flex-1 bg-gray-50 dark:bg-gray-900 pt-16 sm:pt-20">
        <div className="py-6 pb-24 lg:pb-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <Footer onNavigate={onNavigate} />
    </div>
  );
};

export default Layout;
