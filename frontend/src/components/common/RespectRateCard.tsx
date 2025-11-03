import React from 'react';

interface RespectRateColor {
  from: string;
  to: string;
  darkFrom: string;
  darkTo: string;
}

interface RespectRateCardProps {
  title: string;
  subtitle?: string;
  percentage: number;
  tradesCount: number;
  totalTrades: number;
  tradesLabel: string;
  outOfLabel: string;
  gradientColors: RespectRateColor;
}

export const RespectRateCard: React.FC<RespectRateCardProps> = ({
  title,
  subtitle,
  percentage,
  tradesCount,
  totalTrades,
  tradesLabel,
  outOfLabel,
  gradientColors,
}) => {
  return (
    <div
      className={`bg-gradient-to-r ${gradientColors.from} ${gradientColors.to} ${gradientColors.darkFrom} ${gradientColors.darkTo} rounded-lg shadow-lg p-6 text-white`}
    >
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 items-center">
        {/* Ligne 1 : Titre et Pourcentage */}
        <h2 className="text-sm font-semibold leading-tight line-clamp-1 col-span-1">
          {title}
        </h2>
        <p className="text-2xl font-bold whitespace-nowrap justify-self-end col-span-1">
          {percentage.toFixed(2)}%
        </p>

        {/* Ligne 2 : Sous-titre et Compteur de trades */}
        {subtitle ? (
          <p className="text-xs opacity-75 leading-tight line-clamp-1 col-span-1">
            {subtitle}
          </p>
        ) : (
          <span className="col-span-1"></span>
        )}
        <p className="text-xs opacity-90 whitespace-nowrap justify-self-end col-span-1">
          {tradesCount} {outOfLabel} {totalTrades} {tradesLabel}
        </p>
      </div>
    </div>
  );
};

