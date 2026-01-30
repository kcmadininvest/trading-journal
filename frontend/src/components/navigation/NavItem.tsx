import React from 'react';

interface NavItemProps {
  id: string;
  label: string;
  icon: React.ReactElement;
  isActive: boolean;
  onClick: (id: string) => void;
  className?: string;
}

const NavItem: React.FC<NavItemProps> = ({ id, label, icon, isActive, onClick, className = '' }) => {
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
      } ${className}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <span className="flex-shrink-0 w-4 h-4">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
};

export default NavItem;
