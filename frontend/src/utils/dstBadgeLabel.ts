import type { TFunction } from 'i18next';
import type { DSTEvent, MarketRegion } from './dstCalculator';
import { formatDate, type DateFormatType } from './dateFormat';
import { formatNumber, type NumberFormatType } from './numberFormat';

/** Heure réglementaire de bascule (pas l’instant navigateur du Date). */
export function getDstTransitionTime(region: MarketRegion, type: 'spring' | 'fall'): string {
  if (region === 'EU' && type === 'fall') {
    return '03:00';
  }
  return '02:00';
}

function joinBadgeParts(season: string, relative: string): string {
  const left = season.trim();
  const right = relative.trim();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

export function formatDstBadgeLabel(
  event: DSTEvent,
  t: TFunction,
  numberFormat: NumberFormatType = 'comma',
): string {
  const season =
    event.type === 'spring'
      ? t('common:dstChange.springShort', { defaultValue: 'Été' })
      : t('common:dstChange.fallShort', { defaultValue: 'Hiver' });

  if (event.isToday) {
    return joinBadgeParts(
      season,
      t('common:dstChange.todayBadge', { defaultValue: "aujourd'hui" }),
    );
  }
  if (event.isTomorrow) {
    return joinBadgeParts(
      season,
      t('common:dstChange.tomorrowBadge', { defaultValue: 'demain' }),
    );
  }

  const count = formatNumber(event.daysUntil, 0, numberFormat);
  const unit = t('common:dstChange.daysShort', { defaultValue: 'j' });
  return joinBadgeParts(season, `+${count}${unit}`);
}

export function formatDstBadgeTitle(
  event: DSTEvent,
  t: TFunction,
  marketLabel: string,
  dateFormat: DateFormatType = 'EU',
): string {
  const dateStr = formatDate(event.dateYmd, dateFormat, false);
  const time = getDstTransitionTime(event.region, event.type);
  const main = t('common:dstChange.tooltip', {
    defaultValue: 'Changement d\'heure {{market}} : {{date}} à {{time}}',
    market: marketLabel,
    date: dateStr,
    time,
  });
  const clocks =
    event.type === 'spring'
      ? t('common:dstChange.clocksForward', {
          defaultValue: "Les horloges avancent d'1 heure",
        })
      : t('common:dstChange.clocksBackward', {
          defaultValue: "Les horloges reculent d'1 heure",
        });
  return `${main}. ${clocks}`;
}
