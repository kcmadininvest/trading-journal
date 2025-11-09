import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../utils/dateFormat';
import { usePreferences } from '../../hooks/usePreferences';

interface StrategyStreakCardProps {
  currentStreak: number;
  streakStartDate: string | null;
  nextBadge: { name: string; days: number; progress?: number } | null;
}

export const StrategyStreakCard: React.FC<StrategyStreakCardProps> = ({
  currentStreak,
  streakStartDate,
  nextBadge,
}) => {
  const { t } = useTranslation();
  const { preferences } = usePreferences();

  const progressToNextBadge = nextBadge?.progress || 0;
  // Utiliser currentStreak pour calculer les jours restants vers le prochain badge
  const daysToNextBadge = nextBadge ? Math.max(0, nextBadge.days - currentStreak) : 0;

  return (
    <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 dark:from-blue-600 dark:via-blue-700 dark:to-purple-700 rounded-xl shadow-lg p-4 text-white relative overflow-hidden">
      {/* Effet de brillance animé en arrière-plan */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white to-transparent transform -skew-x-12 animate-shimmer"></div>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-base font-semibold mb-0.5">
              {t('strategy:streak.title', { defaultValue: 'Streak de Respect' })}
              {currentStreak > 0 && streakStartDate && (
                <span className="font-normal italic"> : {currentStreak} {t('strategy:streak.days', { defaultValue: 'jours' })} {t('strategy:streak.sinceWithArticle', { defaultValue: 'depuis le' })} {formatDate(streakStartDate, preferences.date_format, false)}</span>
              )}
            </h3>
            <p className="text-xs opacity-90 leading-tight">
              {t('strategy:streak.subtitle', { defaultValue: 'Jours consécutifs avec 100% de respect' })}
            </p>
          </div>
          
          {nextBadge && (
            <div className="flex-1">
              <div className="text-sm font-medium mb-2">
                {t('strategy:streak.nextBadge', { defaultValue: 'Prochain badge' })}
              </div>
              <div className="w-full bg-white/20 rounded-full h-2 overflow-hidden mb-2">
                <div
                  className="h-full bg-white rounded-full transition-all duration-500 relative"
                  style={{ width: `${Math.min(progressToNextBadge, 100)}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"></div>
                </div>
              </div>
              <div className="text-xs opacity-90">
                {nextBadge.name} ({daysToNextBadge} {t('strategy:streak.daysLeft', { defaultValue: 'jours restants' })})
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) skewX(-12deg); }
          100% { transform: translateX(200%) skewX(-12deg); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  );
};

