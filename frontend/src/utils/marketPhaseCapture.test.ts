import { describe, expect, it } from 'vitest';
import { formatSessionClockLabel } from './dateFormat';
import { overlapMinutes } from './marketPhaseSlots';

describe('marketPhaseCapture helpers', () => {
  it('formatSessionClockLabel pads HH:mm', () => {
    expect(formatSessionClockLabel('9:5')).toBe('09:05');
    expect(formatSessionClockLabel('12:30')).toBe('12:30');
  });

  it('overlap projection for flexible block inside analytical period', () => {
    const overlap = overlapMinutes('12:18', '13:24', '12:00', '14:00');
    expect(overlap).toBe(66);
  });

  it('capture uses structured clock labels not ISO datetimes', () => {
    const blockStart = '12:18';
    expect(formatSessionClockLabel(blockStart)).toMatch(/^\d{2}:\d{2}$/);
    expect(blockStart).not.toContain('T');
  });
});
