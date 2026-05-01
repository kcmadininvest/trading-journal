import React from 'react';

interface NavItemProps {
  id: string;
  label: string;
  icon: React.ReactElement;
  isActive: boolean;
  onClick: (id: string) => void;
  className?: string;
  disabled?: boolean;
  badgeText?: string;
}

const NavItem: React.FC<NavItemProps> = ({ id, label, icon, isActive, onClick, className = '', disabled = false, badgeText }) => {
  return (
    <button
      onClick={() => {
        if (!disabled) onClick(id);
      }}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        disabled
          ? 'text-gray-500 cursor-not-allowed opacity-70'
          : isActive
          ? 'bg-blue-600 text-white shadow-sm'
          : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
      } ${className}`}
      aria-current={isActive ? 'page' : undefined}
      title={disabled ? badgeText : undefined}
    >
      <span className="flex-shrink-0 w-4 h-4">
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {badgeText && (
        <span className="ml-1 inline-flex items-center rounded-full border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 text-[10px] tracking-wide text-amber-200">
          {badgeText}
        </span>
      )}
    </button>
  );
};

export default NavItem;
