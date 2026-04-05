import React from 'react';
import { MarketHoliday } from '../../services/calendar';
import { MarketClockCard } from './MarketClockCard';
import { MarketEventsTimeline } from './MarketEventsTimeline';

interface ModernMarketInfoProps {
  marketHolidays: MarketHoliday[];
  holidaysLoading: boolean;
}

export const ModernMarketInfo: React.FC<ModernMarketInfoProps> = ({
  marketHolidays,
  holidaysLoading,
}) => {
  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Section Horloges Mondiales */}
      <div className="flex flex-col sm:flex-row gap-3 lg:flex-1">
        {/* NYSE */}
        <div className="flex-1 min-w-0">
          <MarketClockCard
            marketCode="NYSE"
            marketName="New York Stock Exchange"
            flagCode="us"
            timezone="America/New_York"
            tradingHours={{ open: '09:30', close: '16:00' }}
            color="blue"
            holidays={marketHolidays.filter(h => h.market === 'XNYS')}
            region="US"
          />
        </div>

        {/* Euronext Paris */}
        <div className="flex-1 min-w-0">
          <MarketClockCard
            marketCode="XPAR"
            marketName="Euronext Paris"
            flagCode="fr"
            timezone="Europe/Paris"
            tradingHours={{ open: '09:00', close: '17:30' }}
            color="purple"
            holidays={marketHolidays.filter(h => h.market === 'XPAR')}
            region="EU"
          />
        </div>

        {/* London Stock Exchange */}
        <div className="flex-1 min-w-0">
          <MarketClockCard
            marketCode="XLON"
            marketName="London Stock Exchange"
            flagCode="gb"
            timezone="Europe/London"
            tradingHours={{ open: '08:00', close: '16:30' }}
            color="red"
            holidays={marketHolidays.filter(h => h.market === 'XLON')}
            region="EU"
          />
        </div>
      </div>

      {/* Section Timeline des Événements */}
      <div className="lg:flex-1 lg:min-w-0">
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
