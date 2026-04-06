export interface PreMarketHours {
  open: string;
  close: string;
}

export interface ExtendedTradingHours {
  preMarket: PreMarketHours | null;
  regular: { open: string; close: string };
}

export const MARKET_HOURS: Record<string, ExtendedTradingHours> = {
  NYSE: {
    preMarket: { open: '04:00', close: '09:30' },
    regular: { open: '09:30', close: '16:00' }
  },
  XPAR: {
    preMarket: { open: '07:15', close: '09:00' },
    regular: { open: '09:00', close: '17:30' }
  },
  XLON: {
    preMarket: { open: '07:50', close: '08:00' },
    regular: { open: '08:00', close: '16:30' }
  },
  XTKS: {
    preMarket: null,
    regular: { open: '09:00', close: '15:00' }
  }
};

export type MarketStatus = 'closed' | 'pre-market' | 'open';

function parseHHMM(hhmm: string): { h: number; m: number } {
  const parts = hhmm.trim().split(':').map((x) => parseInt(x, 10));
  return { h: parts[0] || 0, m: parts[1] || 0 };
}

export function getMarketStatus(
  timezone: string,
  marketCode: string,
  currentTime: Date,
  isWeekend: boolean,
  isHoliday: boolean,
  showPreMarket: boolean,
  regularCloseOverride?: string | null
): MarketStatus {
  if (isWeekend || isHoliday) return 'closed';
  
  const hours = MARKET_HOURS[marketCode];
  if (!hours) return 'closed';
  
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  
  const parts = formatter.formatToParts(currentTime);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const currentMinutes = hour * 60 + minute;
  
  const [regularOpenH, regularOpenM] = hours.regular.open.split(':').map(Number);
  const regularOpenMinutes = regularOpenH * 60 + regularOpenM;
  const closeSource =
    regularCloseOverride && /^\d{1,2}:\d{2}$/.test(regularCloseOverride.trim())
      ? regularCloseOverride.trim()
      : hours.regular.close;
  const { h: rch, m: rcm } = parseHHMM(closeSource);
  const regularCloseMinutes = rch * 60 + rcm;
  
  if (currentMinutes >= regularOpenMinutes && currentMinutes < regularCloseMinutes) {
    return 'open';
  }
  
  if (showPreMarket && hours.preMarket) {
    const [preOpenH, preOpenM] = hours.preMarket.open.split(':').map(Number);
    const [preCloseH, preCloseM] = hours.preMarket.close.split(':').map(Number);
    const preOpenMinutes = preOpenH * 60 + preOpenM;
    const preCloseMinutes = preCloseH * 60 + preCloseM;
    
    if (currentMinutes >= preOpenMinutes && currentMinutes < preCloseMinutes) {
      return 'pre-market';
    }
  }
  
  return 'closed';
}
