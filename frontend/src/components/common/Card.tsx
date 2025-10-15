import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'small' | 'medium' | 'large'
}

function Card({ children, className = '', padding = 'medium' }: CardProps) {
  const paddingClasses = {
    none: '',
    small: 'p-3',
    medium: 'p-4',
    large: 'p-6'
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 transition-all ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  )
}

export default Card

