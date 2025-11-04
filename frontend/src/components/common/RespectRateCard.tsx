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
      className={`bg-gradient-to-r ${gradientColors.from} ${gradientColors.to} ${gradientColors.darkFrom} ${gradientColors.darkTo} rounded-lg shadow-lg py-3 px-6 text-white`}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Titre et sous-titre à gauche */}
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base font-semibold leading-tight">
            {title}
            {subtitle && (
              <span className="text-sm opacity-75 ml-1 italic">{subtitle}</span>
            )}
          </h2>
        </div>

        {/* Pourcentage et compteur de trades à droite */}
        <div className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
          <p className="text-2xl font-bold">
            {percentage.toFixed(2)}%
          </p>
          <p className="text-xs opacity-90 italic">
            ({tradesCount} {outOfLabel} {totalTrades} {tradesLabel})
          </p>
        </div>
      </div>
    </div>
  );
};

