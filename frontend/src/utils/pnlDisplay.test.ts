import { getTradeDisplayPnlValue, parsePnlDisplayMode } from './pnlDisplay';

describe('pnlDisplay', () => {
  describe('parsePnlDisplayMode', () => {
    it('normalise gross et net', () => {
      expect(parsePnlDisplayMode('gross')).toBe('gross');
      expect(parsePnlDisplayMode('net')).toBe('net');
      expect(parsePnlDisplayMode(undefined)).toBe('net');
      expect(parsePnlDisplayMode(null)).toBe('net');
      expect(parsePnlDisplayMode('')).toBe('net');
    });
  });

  describe('getTradeDisplayPnlValue', () => {
    const trade = { pnl: '100', net_pnl: '80' };

    it('mode net lit net_pnl', () => {
      expect(getTradeDisplayPnlValue(trade, 'net')).toBe(80);
    });

    it('mode gross lit pnl en priorité', () => {
      expect(getTradeDisplayPnlValue(trade, 'gross')).toBe(100);
    });

    it('mode gross retombe sur net_pnl si pnl absent', () => {
      expect(getTradeDisplayPnlValue({ net_pnl: '42' }, 'gross')).toBe(42);
    });

    it('mode net ignore pnl si net_pnl présent', () => {
      expect(getTradeDisplayPnlValue({ pnl: '999', net_pnl: '1' }, 'net')).toBe(1);
    });
  });
});
