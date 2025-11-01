import React from 'react';

interface ChartCardProps {
  title: React.ReactNode;
  height?: number;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, height = 420, children }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-4">
        {title}
      </div>
      <div style={{ height: `${height}px`, overflow: 'visible' }} className="relative">
        {children}
      </div>
    </div>
  );
};

export default ChartCard;
