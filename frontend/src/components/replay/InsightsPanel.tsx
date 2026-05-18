import React from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
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

const SIZE_CHANGE_LABEL_KEYS = {
  larger: 'insightDetail.sizeChangeLarger',
  equal: 'insightDetail.sizeChangeEqual',
  smaller: 'insightDetail.sizeChangeSmaller',
} as const;

type SizeChange = keyof typeof SIZE_CHANGE_LABEL_KEYS;

function isSizeChange(value: unknown): value is SizeChange {
  return typeof value === 'string' && value in SIZE_CHANGE_LABEL_KEYS;
}

function formatContextValue(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return null;
}

function RevengeSizeDetail({
  insight,
  t,
}: {
  insight: SessionInsightItem;
  t: TFunction<'replay'>;
}): React.ReactElement | null {
  if (insight.code !== 'revenge_trade') return null;

  const sizeChange = insight.context?.size_change;
  if (!isSizeChange(sizeChange)) return null;

  const lossSize = formatContextValue(insight.context?.loss_size);
  const nextSize = formatContextValue(insight.context?.next_size);
  if (lossSize == null || nextSize == null) return null;

  return (
    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
      {t('insightDetail.sizeChange', {
        lossSize,
        nextSize,
        change: t(SIZE_CHANGE_LABEL_KEYS[sizeChange]),
      })}
    </p>
  );
}

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
                <RevengeSizeDetail insight={ins} t={t} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
