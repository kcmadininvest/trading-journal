import React, { Suspense } from 'react'
import { StatisticsPageSkeleton } from './ui/Skeleton'

interface SuspenseBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

// Boundary par défaut avec skeleton
export const SuspenseBoundary: React.FC<SuspenseBoundaryProps> = ({ 
  children, 
  fallback = <StatisticsPageSkeleton /> 
}) => {
  return (
    <Suspense fallback={fallback}>
      {children}
    </Suspense>
  )
}

// Boundary spécialisé pour les pages
export const PageSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SuspenseBoundary fallback={<StatisticsPageSkeleton />}>
    {children}
  </SuspenseBoundary>
)

// Boundary pour les composants de graphiques
export const ChartSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SuspenseBoundary fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-80" />}>
    {children}
  </SuspenseBoundary>
)

// Boundary pour les composants de tableaux
export const TableSuspense: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SuspenseBoundary fallback={<div className="animate-pulse bg-gray-200 rounded-lg h-64" />}>
    {children}
  </SuspenseBoundary>
)
