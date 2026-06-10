import { TFunction } from 'i18next';
import {
  SessionEventItem,
  SessionInsightItem,
  TradingSessionReplay,
} from '../../services/sessionReplay';
import {
  formatClockTime,
  formatDate,
  type DateFormatType,
  type LanguageType,
} from '../../utils/dateFormat';
import { formatCurrencyWithSign, type NumberFormatType } from '../../utils/numberFormat';
import { formatInsightMessage } from './insightMessage';

const TIMELINE_EVENT_TYPES = new Set(['position_open', 'position_close', 'order_created']);

export interface GenerateJournalDraftParams {
  session: TradingSessionReplay;
  events: SessionEventItem[];
  insights: SessionInsightItem[];
  t: TFunction<'replay'>;
  numberFormat: NumberFormatType;
  dateFormat: DateFormatType;
  timezone: string;
  language: LanguageType;
}

function eventLabel(t: TFunction<'replay'>, eventType: string): string {
  return t(`eventTypes.${eventType}`, { defaultValue: eventType });
}

function pnlFromClose(evt: SessionEventItem): number | null {
  const raw = evt.payload?.pnl;
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function generateJournalDraft({
  session,
  events,
  insights,
  t,
  numberFormat,
  dateFormat,
  timezone,
  language,
}: GenerateJournalDraftParams): string {
  const lines: string[] = [];
  const sessionDate = formatDate(session.session_date, dateFormat, false, timezone);

  lines.push(`# ${t('journalDraft.title', { date: sessionDate })}`);
  lines.push('');
  lines.push(`**${t('journalDraft.account')}** : ${session.trading_account_name}`);
  lines.push(`**${t('journalDraft.closedTrades')}** : ${session.trade_count}`);

  if (session.net_pnl != null) {
    lines.push(
      `**${t('journalDraft.netPnl')}** : ${formatCurrencyWithSign(
        Number(session.net_pnl),
        '',
        numberFormat,
        2,
      )}`,
    );
  }
  if (session.max_drawdown_intraday != null) {
    lines.push(
      `**${t('journalDraft.maxDrawdown')}** : ${formatCurrencyWithSign(
        Number(session.max_drawdown_intraday),
        '',
        numberFormat,
        2,
      )}`,
    );
  }
  lines.push(`**${t('journalDraft.eventCount')}** : ${events.length}`);
  lines.push('');

  const closes = events.filter((event) => event.event_type === 'position_close');
  const pnls = closes.map(pnlFromClose).filter((pnl): pnl is number => pnl !== null);

  if (pnls.length > 0) {
    const best = Math.max(...pnls);
    const worst = Math.min(...pnls);
    lines.push(`## ${t('journalDraft.tradesSection')}`);
    lines.push(
      `- ${t('journalDraft.bestTrade')} : ${formatCurrencyWithSign(best, '', numberFormat, 2)}`,
    );
    lines.push(
      `- ${t('journalDraft.worstTrade')} : ${formatCurrencyWithSign(worst, '', numberFormat, 2)}`,
    );
    lines.push('');
  }

  if (insights.length > 0) {
    lines.push(`## ${t('journalDraft.alertsSection')}`);
    for (const insight of insights) {
      const severity = t(`journalDraft.severity.${insight.severity}`, {
        defaultValue: insight.severity.toUpperCase(),
      });
      const message = formatInsightMessage(insight, t, numberFormat);
      lines.push(`- [${severity}] ${message}`);
    }
    lines.push('');
  }

  lines.push(`## ${t('journalDraft.timelineSection')}`);
  for (const event of events) {
    if (!TIMELINE_EVENT_TYPES.has(event.event_type)) continue;
    const time = formatClockTime(new Date(event.occurred_at), timezone, language);
    const label = eventLabel(t, event.event_type);
    const contract = event.payload?.contract_name ? String(event.payload.contract_name) : '';
    lines.push(
      contract
        ? t('journalDraft.timelineLineWithContract', { time, label, contract })
        : t('journalDraft.timelineLine', { time, label }),
    );
  }

  lines.push('');
  lines.push(`_${t('journalDraft.footer')}_`);
  return lines.join('\n');
}
