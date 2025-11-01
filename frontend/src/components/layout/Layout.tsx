import React from 'react';
import { User } from '../../services/auth';
import Sidebar from './Sidebar';
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={onNavigate}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:ml-0">
        {/* Header */}
        <Header
          currentUser={currentUser}
          currentPage={currentPage}
          onLogout={onLogout}
        />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          <div className="py-6">
            {children}
          </div>
        </main>

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
