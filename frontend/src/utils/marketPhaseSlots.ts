/**
 * Projection et génération de créneaux — aligné sur backend period_projection / slot_generator.
 */

import { MARKET_HOURS } from './marketHours';

export interface AnalyticalPeriod {
  key: string;
  label: string;
  start: string;
  end: string;
}

export interface SlotConfig {
  mode: 'fixed' | 'custom' | 'hour';
  duration_minutes?: number;
  anchor?: 'market_open' | 'clock_hour';
  market_code?: string;
  custom_analytical_periods?: Array<{
    key?: string;
    label?: string;
    start: string;
    end: string;
  }>;
}

export interface GenerateSessionSlotsOptions {
  config: SlotConfig;
  customOverrides?: AnalyticalPeriod[] | null;
}

function minutesToHHMM(minutes: number): string {
  const m = minutes % (24 * 60);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

export function suggestSlotEndFromStart(start: string, durationMinutes = 30): string {
  if (!/^\d{1,2}:\d{2}$/.test(start.trim())) {
    return minutesToHHMM(durationMinutes);
  }
  return minutesToHHMM(timeToMinutes(start) + durationMinutes);
}

export function isSessionClockAfter(start: string, end: string): boolean {
  if (!/^\d{1,2}:\d{2}$/.test(start.trim()) || !/^\d{1,2}:\d{2}$/.test(end.trim())) {
    return false;
  }
  return timeToMinutes(end) > timeToMinutes(start);
}

export function parsePeriodKey(periodKey: string): AnalyticalPeriod | null {
  const parts = periodKey.split('-');
  if (parts.length < 2) return null;
  const start = parts[0].trim();
  const end = parts.slice(1).join('-').trim();
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) return null;
  return {
    key: periodKey,
    label: `${start} – ${end}`,
    start,
    end,
  };
}

export function overlapMinutes(
  blockStart: string,
  blockEnd: string | null,
  periodStart: string,
  periodEnd: string,
): number {
  const bs = timeToMinutes(blockStart);
  let be = blockEnd ? timeToMinutes(blockEnd) : bs + 1;
  const ps = timeToMinutes(periodStart);
  let pe = timeToMinutes(periodEnd);
  if (be <= bs) be += 24 * 60;
  if (pe <= ps) pe += 24 * 60;
  const start = Math.max(bs, ps);
  const end = Math.min(be, pe);
  return Math.max(0, end - start);
}

export function generateHourlyPeriods(): AnalyticalPeriod[] {
  const periods: AnalyticalPeriod[] = [];
  for (let h = 0; h < 24; h += 1) {
    const start = `${String(h).padStart(2, '0')}:00`;
    const endH = (h + 1) % 24;
    const end = `${String(endH).padStart(2, '0')}:00`;
    periods.push({ key: `${start}-${end}`, label: `${start} – ${end}`, start, end });
  }
  return periods;
}

export function getMarketOpenTime(marketCode: string): string {
  const hours = MARKET_HOURS[marketCode];
  return hours?.regular.open ?? '09:30';
}

export function getMarketCloseTime(marketCode: string): string {
  const hours = MARKET_HOURS[marketCode];
  return hours?.regular.close ?? '16:00';
}

export function generateFixedSlots(
  durationMinutes: number,
  anchorStart = '00:00',
  anchorEnd = '23:59',
): AnalyticalPeriod[] {
  const slots: AnalyticalPeriod[] = [];
  let cur = timeToMinutes(anchorStart);
  let endLimit = timeToMinutes(anchorEnd);
  if (endLimit <= cur) endLimit += 24 * 60;
  while (cur < endLimit) {
    const nxt = cur + durationMinutes;
    const start = minutesToHHMM(cur);
    const end = minutesToHHMM(nxt);
    const key = `${start}-${end}`;
    slots.push({ key, label: `${start} – ${end}`, start, end });
    cur = nxt;
  }
  return slots;
}

export function periodsFromCustomList(
  customPeriods: Array<{ key?: string; label?: string; start: string; end: string }>,
): AnalyticalPeriod[] {
  return customPeriods.map((item) => ({
    key: item.key || `${item.start}-${item.end}`,
    label: item.label || `${item.start} – ${item.end}`,
    start: item.start,
    end: item.end,
  }));
}

export function periodsFromConfig(config: SlotConfig): AnalyticalPeriod[] {
  if (config.mode === 'custom' && config.custom_analytical_periods?.length) {
    return periodsFromCustomList(config.custom_analytical_periods);
  }
  if (config.mode === 'hour') {
    return generateHourlyPeriods();
  }
  if (config.mode === 'fixed') {
    const duration = config.duration_minutes ?? 60;
    const marketCode = config.market_code ?? 'NYSE';
    const anchorStart =
      config.anchor === 'market_open' ? getMarketOpenTime(marketCode) : '00:00';
    const anchorEnd = config.anchor === 'market_open' ? getMarketCloseTime(marketCode) : '23:59';
    return generateFixedSlots(duration, anchorStart, anchorEnd);
  }
  return generateHourlyPeriods();
}

export function generateSessionSlots(options: GenerateSessionSlotsOptions): AnalyticalPeriod[] {
  if (options.customOverrides?.length) {
    return options.customOverrides;
  }
  return periodsFromConfig(options.config);
}

/** Créneaux affichés en replay : uniquement ceux définis dans l'outil de saisie (session). */
export function getReplayCaptureSlots(sessionOverrides?: AnalyticalPeriod[] | null): AnalyticalPeriod[] {
  if (sessionOverrides === null || sessionOverrides === undefined) {
    return [];
  }
  return sortSlotsByStart(sessionOverrides);
}

export function sortSlotsByStart(slots: AnalyticalPeriod[]): AnalyticalPeriod[] {
  return [...slots].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

export function normalizeSlotPeriod(
  input: Pick<AnalyticalPeriod, 'label' | 'start' | 'end'>,
): AnalyticalPeriod | null {
  const start = input.start?.trim();
  const end = input.end?.trim();
  if (!start || !end || !/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
    return null;
  }
  const label = input.label?.trim() || `${start} – ${end}`;
  return { key: `${start}-${end}`, label, start, end };
}

export function blockMatchesSlot(block: { range_start: string; range_end: string | null }, slot: AnalyticalPeriod): boolean {
  return block.range_start === slot.start && block.range_end === slot.end;
}

export function isSlotBoundBlock(
  block: { range_start: string; range_end: string | null },
  slots: AnalyticalPeriod[],
): boolean {
  return slots.some((slot) => blockMatchesSlot(block, slot));
}

export function slotMidpoint(slot: AnalyticalPeriod): string {
  const start = timeToMinutes(slot.start);
  let end = timeToMinutes(slot.end);
  if (end <= start) end += 24 * 60;
  return minutesToHHMM(Math.floor((start + end) / 2));
}

export function eventInPeriod(occurredAt: string, periodStart: string, periodEnd: string): boolean {
  const t = timeToMinutes(occurredAt);
  const ps = timeToMinutes(periodStart);
  const pe = timeToMinutes(periodEnd);
  if (pe <= ps) {
    return t >= ps || t < pe;
  }
  return t >= ps && t < pe;
}
