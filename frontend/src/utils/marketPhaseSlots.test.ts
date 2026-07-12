import { describe, expect, it } from 'vitest';
import { parseSessionClock } from '../components/common/SessionClockInput';
import {
  blockMatchesSlot,
  generateFixedSlots,
  generateSessionSlots,
  getReplayCaptureSlots,
  isSessionClockAfter,
  isSlotBoundBlock,
  normalizeSlotPeriod,
  overlapMinutes,
  parsePeriodKey,
  periodsFromConfig,
  slotMidpoint,
  suggestSlotEndFromStart,
} from './marketPhaseSlots';

describe('marketPhaseSlots', () => {
  it('parsePeriodKey', () => {
    const p = parsePeriodKey('12:00-14:00');
    expect(p?.start).toBe('12:00');
    expect(p?.end).toBe('14:00');
  });

  it('overlapMinutes block inside period', () => {
    const overlap = overlapMinutes('12:18', '13:24', '12:00', '14:00');
    expect(overlap).toBe(66);
  });

  it('generateFixedSlots 30 min from 09:30', () => {
    const slots = generateFixedSlots(30, '09:30', '11:00');
    expect(slots[0]).toEqual({
      key: '09:30-10:00',
      label: '09:30 – 10:00',
      start: '09:30',
      end: '10:00',
    });
    expect(slots).toHaveLength(3);
  });

  it('periodsFromConfig custom mode', () => {
    const periods = periodsFromConfig({
      mode: 'custom',
      custom_analytical_periods: [{ label: 'Midi', start: '12:00', end: '14:00' }],
    });
    expect(periods[0].label).toBe('Midi');
    expect(periods[0].start).toBe('12:00');
  });

  it('periodsFromConfig fixed mode uses duration', () => {
    const periods = periodsFromConfig({
      mode: 'fixed',
      duration_minutes: 60,
      anchor: 'clock_hour',
    });
    expect(periods[0].start).toBe('00:00');
    expect(periods[0].end).toBe('01:00');
  });

  it('generateSessionSlots honors session overrides', () => {
    const slots = generateSessionSlots({
      config: { mode: 'hour' },
      customOverrides: [{ key: '12:00-14:00', label: 'Midi', start: '12:00', end: '14:00' }],
    });
    expect(slots).toHaveLength(1);
    expect(slots[0].label).toBe('Midi');
  });

  it('getReplayCaptureSlots empty without session slots', () => {
    expect(getReplayCaptureSlots()).toHaveLength(0);
    expect(getReplayCaptureSlots(null)).toHaveLength(0);
  });

  it('getReplayCaptureSlots returns session slots only', () => {
    const slots = getReplayCaptureSlots([
      { key: '09:30-10:00', label: 'Open', start: '09:30', end: '10:00' },
    ]);
    expect(slots).toHaveLength(1);
    expect(slots[0].label).toBe('Open');
  });

  it('getReplayCaptureSlots honors explicit empty session override', () => {
    expect(getReplayCaptureSlots([])).toHaveLength(0);
  });

  it('normalizeSlotPeriod', () => {
    expect(normalizeSlotPeriod({ label: '', start: '09:30', end: '10:00' })?.key).toBe('09:30-10:00');
    expect(normalizeSlotPeriod({ label: 'x', start: '', end: '10:00' })).toBeNull();
  });

  it('suggestSlotEndFromStart', () => {
    expect(suggestSlotEndFromStart('09:30')).toBe('10:00');
    expect(suggestSlotEndFromStart('09:30', 60)).toBe('10:30');
  });

  it('isSessionClockAfter', () => {
    expect(isSessionClockAfter('09:30', '10:00')).toBe(true);
    expect(isSessionClockAfter('10:00', '09:30')).toBe(false);
  });

  it('parseSessionClock accepts fine-grained minutes', () => {
    expect(parseSessionClock('9:37')).toBe('09:37');
    expect(parseSessionClock('09:07')).toBe('09:07');
    expect(parseSessionClock('25:00')).toBeNull();
  });

  it('blockMatchesSlot exact boundaries', () => {
    const slot = { key: '12:00-14:00', label: 'Midi', start: '12:00', end: '14:00' };
    expect(blockMatchesSlot({ range_start: '12:00', range_end: '14:00' }, slot)).toBe(true);
    expect(blockMatchesSlot({ range_start: '12:18', range_end: '13:24' }, slot)).toBe(false);
  });

  it('isSlotBoundBlock distinguishes free blocks', () => {
    const slots = [{ key: '12:00-14:00', label: 'Midi', start: '12:00', end: '14:00' }];
    expect(isSlotBoundBlock({ range_start: '12:00', range_end: '14:00' }, slots)).toBe(true);
    expect(isSlotBoundBlock({ range_start: '12:18', range_end: '13:24' }, slots)).toBe(false);
  });

  it('slotMidpoint', () => {
    expect(slotMidpoint({ key: '12:00-14:00', label: '', start: '12:00', end: '14:00' })).toBe('13:00');
  });
});
