import React from 'react'

interface ChartCardProps {
  title: React.ReactNode
  right?: React.ReactNode
  height?: number
  children: React.ReactNode
}

function ChartCard({ title, right, height = 300, children }: ChartCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="h-10 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {title}
        </div>
        {right && (
          <div className="text-xs text-gray-500">{right}</div>
        )}
      </div>
      <div className="relative" style={{ height }}>
        {children}
      </div>
    </div>
  )
}

export default ChartCard


