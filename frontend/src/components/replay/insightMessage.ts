import { TFunction } from 'i18next';
import { SessionInsightItem } from '../../services/sessionReplay';
import { formatCurrencyWithSign, formatNumber, NumberFormatType } from '../../utils/numberFormat';

function ctxNumber(ctx: Record<string, unknown>, key: string): number | null {
  const value = ctx[key];
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatInsightMessage(
  insight: SessionInsightItem,
  t: TFunction<'replay'>,
  numberFormat: NumberFormatType,
): string {
  const ctx = insight.context ?? {};
  const key = `insightMessages.${insight.code}`;

  switch (insight.code) {
    case 'overtrading': {
      const tradeCount = ctxNumber(ctx, 'trade_count');
      const limit = ctxNumber(ctx, 'limit');
      return t(key, {
        tradeCount: tradeCount != null ? formatNumber(tradeCount, 0, numberFormat) : '?',
        limit: limit != null ? formatNumber(limit, 0, numberFormat) : '?',
        defaultValue: insight.message,
      });
    }
    case 'revenge_trade': {
      const minutes = ctxNumber(ctx, 'minutes_after');
      const pnl = ctxNumber(ctx, 'loss_pnl');
      return t(key, {
        minutes: minutes != null ? formatNumber(minutes, 0, numberFormat) : '?',
        pnl: pnl != null ? formatCurrencyWithSign(pnl, '', numberFormat, 2) : '?',
        defaultValue: insight.message,
      });
    }
    case 'oversize': {
      const size = ctxNumber(ctx, 'size');
      const median = ctxNumber(ctx, 'median');
      const multiplier = ctxNumber(ctx, 'multiplier');
      return t(key, {
        size: size != null ? formatNumber(size, 0, numberFormat) : '?',
        median: median != null ? formatNumber(median, 0, numberFormat) : '?',
        multiplier: multiplier != null ? formatNumber(multiplier, 1, numberFormat) : '?',
        defaultValue: insight.message,
      });
    }
    case 'loss_streak': {
      const streak = ctxNumber(ctx, 'streak');
      return t(key, {
        streak: streak != null ? formatNumber(streak, 0, numberFormat) : '?',
        defaultValue: insight.message,
      });
    }
    case 'mll_pressure': {
      const pnl = ctxNumber(ctx, 'net_pnl');
      const mll = ctxNumber(ctx, 'mll');
      return t(key, {
        pnl: pnl != null ? formatCurrencyWithSign(pnl, '', numberFormat, 2) : '?',
        mll: mll != null ? formatCurrencyWithSign(mll, '', numberFormat, 2) : '?',
        defaultValue: insight.message,
      });
    }
    case 'orphan_fill':
      return t(key, { defaultValue: insight.message });
    default:
      return insight.message;
  }
}
