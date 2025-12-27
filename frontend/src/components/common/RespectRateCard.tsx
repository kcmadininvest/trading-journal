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
  totalTrades: number; // Pour compatibilité, mais on utilise totalDays si disponible
  tradesLabel: string;
  outOfLabel: string;
  gradientColors: RespectRateColor;
  // Nouvelles props pour afficher en jours
  totalDays?: number;
  totalTradesInDays?: number;
  daysLabel?: string;
  ofWhichLabel?: string; // "dont" / "of which" / "de los cuales" / "von denen"
  // Props optionnelles pour un deuxième taux (affiché en dessous)
  secondaryPercentage?: number;
  secondaryTradesCount?: number;
  secondaryTotalTrades?: number;
  secondaryTotalDays?: number;
  secondaryTotalTradesInDays?: number;
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
  totalDays,
  totalTradesInDays,
  daysLabel = 'jours',
  ofWhichLabel = 'dont',
  secondaryPercentage,
  secondaryTradesCount,
  secondaryTotalTrades,
  secondaryTotalDays,
  secondaryTotalTradesInDays,
  secondarySubtitle,
  secondaryGradientColors,
}) => {
  const { preferences } = usePreferences();
  
  // Wrapper pour formatNumber avec préférences
  const formatNumber = (value: number, digits: number = 2): string => {
    return formatNumberUtil(value, digits, preferences.number_format);
  };

  const hasSecondary = secondaryPercentage !== undefined && secondaryPercentage !== null;
  
  // Formater le texte d'affichage : "X sur Y jours dont N trades" ou "X sur Y trades" (fallback)
  const formatDisplayText = (count: number, total: number, totalDaysValue?: number, totalTradesInDaysValue?: number) => {
    if (totalDaysValue !== undefined && totalTradesInDaysValue !== undefined) {
      // Nouveau format : "X sur Y jours dont N trades"
      return `${count} ${outOfLabel} ${totalDaysValue} ${daysLabel}${totalTradesInDaysValue > 0 ? ` ${ofWhichLabel} ${totalTradesInDaysValue} ${tradesLabel}` : ''}`;
    }
    // Ancien format (fallback) : "X sur Y trades"
    return `${count} ${outOfLabel} ${total} ${tradesLabel}`;
  };

  return (
    <div
      className={`bg-gradient-to-r ${gradientColors.from} ${gradientColors.to} ${gradientColors.darkFrom} ${gradientColors.darkTo} rounded-lg shadow-lg py-3 px-4 sm:px-6 text-white`}
    >
      <div className="flex flex-col gap-3">
        {/* Premier taux */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
          {/* Titre et sous-titre à gauche */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h2 className="text-sm sm:text-base font-semibold leading-tight break-words">
              {title}
              {subtitle && (
                <span className="text-xs sm:text-sm opacity-75 ml-1 italic">{subtitle}</span>
              )}
            </h2>
          </div>

          {/* Pourcentage et compteur à droite */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <p className="text-xl sm:text-2xl font-bold whitespace-nowrap">
              {formatNumber(percentage, 2)}%
            </p>
            <p className="text-xs opacity-90 italic break-words sm:whitespace-nowrap">
              ({formatDisplayText(tradesCount, totalTrades, totalDays, totalTradesInDays)})
            </p>
          </div>
        </div>

        {/* Deuxième taux (si fourni) */}
        {hasSecondary && secondaryGradientColors && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 pt-2 border-t border-white/20">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h3 className="text-xs sm:text-sm font-semibold leading-tight break-words">
                {title}
                {secondarySubtitle && (
                  <span className="text-xs opacity-75 ml-1 italic">{secondarySubtitle}</span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <p className="text-lg sm:text-xl font-bold whitespace-nowrap">
                {formatNumber(secondaryPercentage, 2)}%
              </p>
              <p className="text-xs opacity-90 italic break-words sm:whitespace-nowrap">
                ({formatDisplayText(secondaryTradesCount || 0, secondaryTotalTrades || 0, secondaryTotalDays, secondaryTotalTradesInDays)})
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

