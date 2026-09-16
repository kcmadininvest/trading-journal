import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/numberFormat';
import { usePreferences } from '../../hooks/usePreferences';
import {
  replayGroupInnerButtonClass,
  replayGroupOuterHeightClass,
  replayGroupShellClass,
  replayPrimaryButtonClass,
  replaySecondaryButtonClass,
} from '../replay/replayStyles';

export interface DraftTrade {
  direction: 'LONG' | 'SHORT';
  entryTimestamp: number | null;
  entryPrice: number | null;
  exitTimestamp: number | null;
  exitPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
}

export type TradePlacementMode = 'entry_long' | 'entry_short' | 'exit' | 'stop' | 'target' | null;

export interface TradeChartLevels {
  direction: 'LONG' | 'SHORT';
  entryPrice: number | null;
  exitPrice: number | null;
  stopPrice: number | null;
  targetPrice: number | null;
}

interface ReplayTradePanelProps {
  draft: DraftTrade;
  lastPrice: number | null;
  campaignId: number | null;
  campaignName?: string;
  saving?: boolean;
  placementMode: TradePlacementMode;
  canPlace?: boolean;
  /** Boutons compacts pour la barre d’outils (à côté des filtres). */
  compact?: boolean;
  onMarkEntry: (direction: 'LONG' | 'SHORT') => void;
  onMarkExit: () => void;
  onSetStop: () => void;
  onSetTarget: () => void;
  onClear: () => void;
  onSendToJournal: () => void;
}

type TradeBtnVariant = 'long' | 'short' | 'exit' | 'stop' | 'target';

const GROUP_BTN_VARIANT: Record<TradeBtnVariant, { idle: string; active: string }> = {
  long: {
    idle:
      '!bg-green-100/90 dark:!bg-green-900/45 !text-green-800 dark:!text-green-300 hover:!bg-green-200/90 dark:hover:!bg-green-900/65',
    active:
      '!bg-green-600 !text-white hover:!bg-green-700 dark:!bg-green-600 dark:hover:!bg-green-500',
  },
  short: {
    idle:
      '!bg-orange-100/90 dark:!bg-orange-900/40 !text-orange-800 dark:!text-orange-300 hover:!bg-orange-200/90 dark:hover:!bg-orange-900/65',
    active:
      '!bg-orange-600 !text-white hover:!bg-orange-700 dark:!bg-orange-500 dark:hover:!bg-orange-400',
  },
  exit: {
    idle:
      '!bg-slate-200/80 dark:!bg-slate-700/55 !text-slate-700 dark:!text-slate-300 hover:!bg-slate-300/90 dark:hover:!bg-slate-600/70',
    active:
      '!bg-slate-600 !text-white hover:!bg-slate-700 dark:!bg-slate-500 dark:hover:!bg-slate-400',
  },
  stop: {
    idle:
      '!bg-amber-100/90 dark:!bg-amber-900/40 !text-amber-900 dark:!text-amber-200 hover:!bg-amber-200/90 dark:hover:!bg-amber-900/65',
    active:
      '!bg-amber-600 !text-white hover:!bg-amber-700 dark:!bg-amber-500 dark:hover:!bg-amber-400',
  },
  target: {
    idle:
      '!bg-blue-100/90 dark:!bg-blue-900/40 !text-blue-800 dark:!text-blue-300 hover:!bg-blue-200/90 dark:hover:!bg-blue-900/65',
    active:
      '!bg-blue-600 !text-white hover:!bg-blue-700 dark:!bg-blue-500 dark:hover:!bg-blue-400',
  },
};

function groupTradeBtn(variant: TradeBtnVariant, active: boolean): string {
  const tone = GROUP_BTN_VARIANT[variant];
  return [
    replaySecondaryButtonClass,
    replayGroupInnerButtonClass,
    active ? tone.active : tone.idle,
  ].join(' ');
}

export const ReplayTradePanel: React.FC<ReplayTradePanelProps> = ({
  draft,
  lastPrice,
  campaignId,
  campaignName,
  saving = false,
  placementMode,
  canPlace = false,
  compact = false,
  onMarkEntry,
  onMarkExit,
  onSetStop,
  onSetTarget,
  onClear,
  onSendToJournal,
}) => {
  const { t } = useTranslation('marketReplay');
  const { preferences } = usePreferences();
  const fmt = (n: number | null) =>
    n == null ? '—' : formatNumber(n, 4, preferences.number_format);

  const legacyBtn =
    'px-2.5 py-1.5 text-xs sm:text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors';
  const legacyArmed =
    'ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400';

  const compactActions = (
    <div className="inline-flex flex-wrap items-center justify-end gap-2">
      <div className={replayGroupShellClass} role="group" aria-label={t('tradePanel')}>
        <button
          type="button"
          className={groupTradeBtn('long', placementMode === 'entry_long')}
          onClick={() => onMarkEntry('LONG')}
          disabled={!canPlace}
          title={t('placementHint')}
        >
          {t('markLong')}
        </button>
        <button
          type="button"
          className={groupTradeBtn('short', placementMode === 'entry_short')}
          onClick={() => onMarkEntry('SHORT')}
          disabled={!canPlace}
        >
          {t('markShort')}
        </button>
      </div>

      <div className={replayGroupShellClass} role="group">
        <button
          type="button"
          className={groupTradeBtn('exit', placementMode === 'exit')}
          onClick={onMarkExit}
          disabled={!canPlace || draft.entryTimestamp == null}
        >
          {t('markExit')}
        </button>
        <button
          type="button"
          className={groupTradeBtn('stop', placementMode === 'stop')}
          onClick={onSetStop}
          disabled={!canPlace}
        >
          {t('setStop')}
        </button>
        <button
          type="button"
          className={groupTradeBtn('target', placementMode === 'target')}
          onClick={onSetTarget}
          disabled={!canPlace}
        >
          {t('setTarget')}
        </button>
      </div>

      <div className={replayGroupShellClass}>
        <button
          type="button"
          className={`${replaySecondaryButtonClass} ${replayGroupInnerButtonClass} !bg-transparent text-gray-600 dark:text-gray-400 hover:!bg-white/90 dark:hover:!bg-gray-700/80 hover:!text-gray-900 dark:hover:!text-gray-100`}
          onClick={onClear}
        >
          {t('clearTrade')}
        </button>
      </div>

      <button
        type="button"
        className={`${replayPrimaryButtonClass} ${replayGroupOuterHeightClass} !px-4 !text-xs !shadow-none`}
        onClick={onSendToJournal}
        disabled={!campaignId || draft.entryTimestamp == null || saving}
      >
        {saving ? t('sending') : t('sendToJournal')}
      </button>
    </div>
  );

  const legacyActions = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        className={`${legacyBtn} ${placementMode === 'entry_long' ? legacyArmed : ''}`}
        onClick={() => onMarkEntry('LONG')}
        disabled={!canPlace}
        title={t('placementHint')}
      >
        {t('markLong')}
      </button>
      <button
        type="button"
        className={`${legacyBtn} ${placementMode === 'entry_short' ? legacyArmed : ''}`}
        onClick={() => onMarkEntry('SHORT')}
        disabled={!canPlace}
      >
        {t('markShort')}
      </button>
      <button
        type="button"
        className={`${legacyBtn} ${placementMode === 'exit' ? legacyArmed : ''}`}
        onClick={onMarkExit}
        disabled={!canPlace || draft.entryTimestamp == null}
      >
        {t('markExit')}
      </button>
      <button
        type="button"
        className={`${legacyBtn} ${placementMode === 'stop' ? legacyArmed : ''}`}
        onClick={onSetStop}
        disabled={!canPlace}
      >
        {t('setStop')}
      </button>
      <button
        type="button"
        className={`${legacyBtn} ${placementMode === 'target' ? legacyArmed : ''}`}
        onClick={onSetTarget}
        disabled={!canPlace}
      >
        {t('setTarget')}
      </button>
      <button type="button" className={legacyBtn} onClick={onClear}>
        {t('clearTrade')}
      </button>
      <button
        type="button"
        className={`${legacyBtn} !bg-blue-600 dark:!bg-blue-500 !text-white !border-blue-600 dark:!border-blue-500 hover:!bg-blue-700 dark:hover:!bg-blue-600`}
        onClick={onSendToJournal}
        disabled={!campaignId || draft.entryTimestamp == null || saving}
      >
        {saving ? t('sending') : t('sendToJournal')}
      </button>
    </div>
  );

  if (compact) {
    return compactActions;
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-gray-800 dark:text-gray-100">{t('tradePanel')}</h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {campaignId
            ? t('linkedCampaign', { name: campaignName || `#${campaignId}` })
            : t('noCampaign')}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{t('placementHint')}</p>
      {legacyActions}
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-700 dark:text-gray-300">
        <div>
          <dt className="text-gray-400 dark:text-gray-500">{t('direction')}</dt>
          <dd>{draft.entryTimestamp == null ? '—' : draft.direction}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">{t('entry')}</dt>
          <dd>{fmt(draft.entryPrice)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">{t('exit')}</dt>
          <dd>{fmt(draft.exitPrice)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">{t('stop')}</dt>
          <dd>{fmt(draft.stopPrice)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">{t('target')}</dt>
          <dd>{fmt(draft.targetPrice)}</dd>
        </div>
        <div>
          <dt className="text-gray-400 dark:text-gray-500">{t('lastPrice')}</dt>
          <dd>{fmt(lastPrice)}</dd>
        </div>
      </dl>
    </div>
  );
};
