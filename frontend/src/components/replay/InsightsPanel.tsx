import React from 'react';
import { useTranslation } from 'react-i18next';
import { SessionInsightItem } from '../../services/sessionReplay';
import { replayPanelClass } from './replayStyles';

interface InsightsPanelProps {
  insights: SessionInsightItem[];
  onJumpToTime?: (occurredAt: string) => void;
}

const SEVERITY_STYLES: Record<string, string> = {
  info: 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20',
  warning: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20',
  error: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
};

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ insights, onJumpToTime }) => {
  const { t } = useTranslation('replay');

  return (
    <div className={`${replayPanelClass} h-full flex flex-col`}>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
        {t('insightsTitle')} ({insights.length})
      </h3>
      {insights.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('noInsights')}</p>
      ) : (
        <ul className="space-y-2 overflow-y-auto flex-1 max-h-48">
          {insights.map((ins) => (
            <li key={ins.id}>
              <button
                type="button"
                onClick={() => onJumpToTime?.(ins.occurred_at)}
                className={`w-full text-left rounded-md border px-3 py-2 text-sm transition hover:opacity-90 ${
                  SEVERITY_STYLES[ins.severity] || SEVERITY_STYLES.info
                }`}
              >
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {t(`insightCodes.${ins.code}`, { defaultValue: ins.code })}
                </span>
                <p className="text-gray-600 dark:text-gray-400 mt-0.5">{ins.message}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
