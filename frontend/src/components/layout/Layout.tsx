import React, { useState, useEffect } from 'react';
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

const SIDEBAR_COLLAPSED_KEY = 'sidebar_collapsed';

const Layout: React.FC<LayoutProps> = ({
  currentUser,
  currentPage,
  onNavigate,
  onLogout,
  children,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex lg:h-screen lg:overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentUser={currentUser}
        currentPage={currentPage}
        onNavigate={onNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 lg:overflow-hidden">
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
