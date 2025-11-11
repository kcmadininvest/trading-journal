import React from 'react';
import { usePreferences } from '../../hooks/usePreferences';
import { formatNumber as formatNumberUtil } from '../../utils/numberFormat';

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
  // Props optionnelles pour un deuxième taux (affiché en dessous)
  secondaryPercentage?: number;
  secondaryTradesCount?: number;
  secondaryTotalTrades?: number;
  secondarySubtitle?: string;
  secondaryGradientColors?: RespectRateColor;
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
  secondaryPercentage,
  secondaryTradesCount,
  secondaryTotalTrades,
  secondarySubtitle,
  secondaryGradientColors,
}) => {
  const { preferences } = usePreferences();
  
  // Wrapper pour formatNumber avec préférences
  const formatNumber = (value: number, digits: number = 2): string => {
    return formatNumberUtil(value, digits, preferences.number_format);
  };

  const hasSecondary = secondaryPercentage !== undefined && secondaryPercentage !== null;

  return (
    <div
      className={`bg-gradient-to-r ${gradientColors.from} ${gradientColors.to} ${gradientColors.darkFrom} ${gradientColors.darkTo} rounded-lg shadow-lg py-3 px-6 text-white`}
    >
      <div className="flex flex-col gap-3">
        {/* Premier taux */}
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
              {formatNumber(percentage, 2)}%
            </p>
            <p className="text-xs opacity-90 italic">
              ({tradesCount} {outOfLabel} {totalTrades} {tradesLabel})
            </p>
          </div>
        </div>

        {/* Deuxième taux (si fourni) */}
        {hasSecondary && secondaryGradientColors && (
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/20">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-sm font-semibold leading-tight">
                {title}
                {secondarySubtitle && (
                  <span className="text-xs opacity-75 ml-1 italic">{secondarySubtitle}</span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2 whitespace-nowrap flex-shrink-0">
              <p className="text-xl font-bold">
                {formatNumber(secondaryPercentage, 2)}%
              </p>
              <p className="text-xs opacity-90 italic">
                ({secondaryTradesCount || 0} {outOfLabel} {secondaryTotalTrades || 0} {tradesLabel})
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

