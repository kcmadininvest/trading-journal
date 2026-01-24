import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../services/tradeStrategies';

interface StrategyBadgesProps {
  badges: Badge[];
}

const badgeIcons: Record<string, React.ReactNode> = {
  beginner: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  ),
  week: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  two_weeks: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  month: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  two_months: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  three_months: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  centurion: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  year: (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
};

export const StrategyBadges: React.FC<StrategyBadgesProps> = ({ badges }) => {
  const { t } = useTranslation();
  const getBadgeLabel = (badgeId: string, fallback: string) =>
    t(`strategy:badges.labels.${badgeId}`, { defaultValue: fallback });

  return (
    <>
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow p-6 h-full flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        {t('strategy:badges.title', { defaultValue: 'Badges de Discipline' })}
      </h3>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 flex-1" style={{ gridAutoRows: '1fr' }}>
        {badges.map((badge) => {
          if (badge.earned) {
            return (
              <div
                key={badge.id}
                className="bg-gradient-to-br from-yellow-400 via-amber-400 to-orange-500 rounded-lg p-4 text-center transform hover:scale-105 transition-transform h-full flex flex-col justify-between relative overflow-hidden shadow-lg"
              >
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" />
                <div className="badge-shine-overlay" />
                <div className="text-yellow-900 mb-2 flex justify-center">
                  {badgeIcons[badge.id] || badgeIcons.beginner}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-xs font-semibold text-yellow-900">{getBadgeLabel(badge.id, badge.name)}</div>
                  <div className="text-xs text-yellow-800 mt-1">{badge.days} {t('strategy:badges.days', { defaultValue: 'jours' })}</div>
                </div>
              </div>
            );
          } else if (badge.locked) {
            return (
              <div
                key={badge.id}
                className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center relative opacity-40 h-full flex flex-col justify-between"
              >
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <svg className="w-7 h-7 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div className="text-gray-300 dark:text-gray-600 mb-2 flex justify-center opacity-50">
                  {badgeIcons[badge.id] || badgeIcons.beginner}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-xs font-semibold text-gray-400 dark:text-gray-500">{getBadgeLabel(badge.id, badge.name)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-600 mt-1">{badge.days} {t('strategy:badges.days', { defaultValue: 'jours' })}</div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5"></div>
                  </div>
                </div>
              </div>
            );
          } else {
            return (
              <div
                key={badge.id}
                className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center relative opacity-60 h-full flex flex-col justify-between"
              >
                <div className="text-gray-400 dark:text-gray-500 mb-2 flex justify-center">
                  {badgeIcons[badge.id] || badgeIcons.beginner}
                </div>
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">{getBadgeLabel(badge.id, badge.name)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{badge.days} {t('strategy:badges.days', { defaultValue: 'jours' })}</div>
                  {badge.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ '--badge-progress': `${Math.max(badge.progress, 0)}%`, width: 'var(--badge-progress)' } as React.CSSProperties}
                        />
                      </div>
                      {badge.progress > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {badge.progress.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
    </>
  );
};

