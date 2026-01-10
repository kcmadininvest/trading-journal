import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
  count?: number;
  height?: string;
  width?: string;
  rounded?: boolean;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = '',
  count = 1,
  height = '1rem',
  width = '100%',
  rounded = true,
}) => {
  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 ${rounded ? 'rounded' : ''} ${className}`}
      style={{ '--skeleton-height': height, '--skeleton-width': width, height: 'var(--skeleton-height)', width: 'var(--skeleton-width)' } as React.CSSProperties}
    />
  ));

  return <>{skeletons}</>;
};

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <SkeletonLoader height="1.5rem" width="60%" className="mb-3" />
      <SkeletonLoader height="1rem" width="100%" className="mb-2" />
      <SkeletonLoader height="1rem" width="80%" className="mb-4" />
      <SkeletonLoader height="0.5rem" width="100%" rounded />
    </div>
  );
};

export const SkeletonGrid: React.FC<{ count?: number; columns?: number }> = ({ count = 6, columns = 3 }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${columns} gap-4`}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

