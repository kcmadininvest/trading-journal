function formatChangePercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return '—';
  }
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

describe('marketQuotes format', () => {
  it('formats positive change with plus sign', () => {
    expect(formatChangePercent(0.42)).toBe('+0.42%');
  });

  it('formats negative change', () => {
    expect(formatChangePercent(-1.5)).toBe('-1.50%');
  });

  it('returns dash for null', () => {
    expect(formatChangePercent(null)).toBe('—');
  });
});
