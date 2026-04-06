import React from 'react';
import { MarketHoliday, MarketTodaySnapshot } from '../../services/calendar';
import { MarketClockCard } from './MarketClockCard';
import { MarketEventsTimeline } from './MarketEventsTimeline';
import { usePreferences } from '../../hooks/usePreferences';

interface ModernMarketInfoProps {
  marketHolidays: MarketHoliday[];
  holidaysLoading: boolean;
  marketTodayByCode?: Partial<Record<string, MarketTodaySnapshot>>;
}

export const ModernMarketInfo: React.FC<ModernMarketInfoProps> = ({
  marketHolidays,
  holidaysLoading,
  marketTodayByCode = {},
}) => {
  const { preferences } = usePreferences();
  return (
    <div className="flex flex-col 2xl:flex-row gap-4">
      {/* Section Horloges Mondiales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 2xl:flex 2xl:gap-3">
        {/* NYSE */}
        <MarketClockCard
          marketCode="NYSE"
          apiMarketCode="XNYS"
          marketName="New York Stock Exchange"
          flagCode="us"
          timezone="America/New_York"
          tradingHours={{ open: '09:30', close: '16:00' }}
          color="blue"
          holidays={marketHolidays.filter(h => h.market === 'XNYS')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XNYS}
          region="US"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
        />

        {/* Euronext Paris */}
        <MarketClockCard
          marketCode="XPAR"
          apiMarketCode="XPAR"
          marketName="Euronext Paris"
          flagCode="fr"
          timezone="Europe/Paris"
          tradingHours={{ open: '09:00', close: '17:30' }}
          color="purple"
          holidays={marketHolidays.filter(h => h.market === 'XPAR')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XPAR}
          region="EU"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
        />

        {/* London Stock Exchange */}
        <MarketClockCard
          marketCode="XLON"
          apiMarketCode="XLON"
          marketName="London Stock Exchange"
          flagCode="gb"
          timezone="Europe/London"
          tradingHours={{ open: '08:00', close: '16:30' }}
          color="red"
          holidays={marketHolidays.filter(h => h.market === 'XLON')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XLON}
          region="EU"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
        />

        {/* Tokyo Stock Exchange */}
        <MarketClockCard
          marketCode="XTKS"
          apiMarketCode="XTKS"
          marketName="Tokyo Stock Exchange"
          flagCode="jp"
          timezone="Asia/Tokyo"
          tradingHours={{ open: '09:00', close: '15:00' }}
          color="blue"
          holidays={marketHolidays.filter(h => h.market === 'XTKS')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XTKS}
          region="EU"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
        />
      </div>

      {/* Section Timeline des Événements */}
      <div className="2xl:flex-1 2xl:min-w-0">
        <MarketEventsTimeline
          events={marketHolidays}
          maxEvents={5}
          loading={holidaysLoading}
        />
      </div>
    </div>
  );
};

export default ModernMarketInfo;
