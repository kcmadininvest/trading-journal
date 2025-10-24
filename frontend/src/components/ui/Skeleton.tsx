import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  width, 
  height, 
  rounded = false 
}) => {
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || '1rem',
    borderRadius: rounded ? '50%' : '0.375rem',
  }

  return (
    <div 
      className={`animate-pulse bg-gray-200 ${className}`}
      style={style}
    />
  )
}

// Skeleton pour les cartes de statistiques
export const StatCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="flex items-center gap-3 mb-4">
      <Skeleton width="2.5rem" height="2.5rem" rounded />
      <Skeleton width="8rem" height="1.25rem" />
    </div>
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Skeleton width="6rem" height="0.875rem" />
        <Skeleton width="3rem" height="1rem" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton width="5rem" height="0.875rem" />
        <Skeleton width="4rem" height="1rem" />
      </div>
      <div className="flex justify-between items-center">
        <Skeleton width="4rem" height="0.875rem" />
        <Skeleton width="3.5rem" height="1rem" />
      </div>
    </div>
  </div>
)

// Skeleton pour les graphiques
export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = "20rem" }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="mb-4">
      <Skeleton width="12rem" height="1.5rem" className="mb-2" />
      <Skeleton width="20rem" height="0.875rem" />
    </div>
    <div 
      className="flex items-end justify-between space-x-2"
      style={{ height }}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton 
          key={i}
          width="1.5rem" 
          height={`${Math.random() * 60 + 20}%`}
          className="flex-1"
        />
      ))}
    </div>
  </div>
)

// Skeleton pour les tableaux
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({ 
  rows = 5, 
  columns = 4 
}) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="px-6 py-4 border-b border-gray-200">
      <Skeleton width="8rem" height="1.25rem" />
    </div>
    <div className="divide-y divide-gray-200">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="px-6 py-4 flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={colIndex}
              width={colIndex === 0 ? "3rem" : "6rem"} 
              height="1rem" 
              className="flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  </div>
)

// Skeleton pour la page de statistiques
export const StatisticsPageSkeleton: React.FC = () => (
  <div className="p-6 bg-gray-50 min-h-screen">
    <div className="w-full">
      {/* Header skeleton */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <Skeleton width="20rem" height="2rem" className="mb-2" />
          <Skeleton width="30rem" height="1.25rem" />
        </div>
        <Skeleton width="12rem" height="4rem" />
      </div>

      {/* Account selector skeleton */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton width="20rem" height="2.5rem" />
        <Skeleton width="15rem" height="1.25rem" />
      </div>

      {/* Stats cards skeleton */}
      <div className="mb-8">
        <div className="mb-6">
          <Skeleton width="12rem" height="1.5rem" className="mb-2" />
          <Skeleton width="25rem" height="1rem" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
)
