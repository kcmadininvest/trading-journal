import React from 'react';

interface ChartCardProps {
  title: React.ReactNode;
  height?: number;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, height = 420, children }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="pt-6 px-6 pb-2">
        {title}
      </div>
      <div 
        className="relative px-6"
        style={{ height: `${height}px` }}
      >
        {children}
      </div>
    </div>
  );
};

export default ChartCard;
