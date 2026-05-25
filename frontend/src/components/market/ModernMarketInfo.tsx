import React from 'react';
import { useTranslation } from 'react-i18next';
import { MarketHoliday, MarketTodaySnapshot } from '../../services/calendar';
import { MarketClockCard } from './MarketClockCard';
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
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const ariaLabel = t('common:marketHours.title', {
    defaultValue: 'Horaires et jours fériés des marchés',
  });

  return (
    <div className="w-full min-w-0" role="region" aria-label={ariaLabel}>
      <div className="grid w-full min-w-0 grid-cols-1 items-stretch gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <MarketClockCard
          marketCode="NYSE"
          apiMarketCode="XNYS"
          marketName="New York Stock Exchange"
          flagCode="us"
          timezone="America/New_York"
          tradingHours={{ open: '09:30', close: '16:00' }}
          color="blue"
          holidays={marketHolidays.filter((h) => h.market === 'XNYS')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XNYS}
          region="US"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
          language={preferences.language}
          dateFormat={preferences.date_format}
          numberFormat={preferences.number_format}
        />

        <MarketClockCard
          marketCode="XPAR"
          apiMarketCode="XPAR"
          marketName="Euronext Paris"
          flagCode="fr"
          timezone="Europe/Paris"
          tradingHours={{ open: '09:00', close: '17:30' }}
          color="purple"
          holidays={marketHolidays.filter((h) => h.market === 'XPAR')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XPAR}
          region="EU"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
          language={preferences.language}
          dateFormat={preferences.date_format}
          numberFormat={preferences.number_format}
        />

        <MarketClockCard
          marketCode="XLON"
          apiMarketCode="XLON"
          marketName="London Stock Exchange"
          flagCode="gb"
          timezone="Europe/London"
          tradingHours={{ open: '08:00', close: '16:30' }}
          color="red"
          holidays={marketHolidays.filter((h) => h.market === 'XLON')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XLON}
          region="EU"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
          language={preferences.language}
          dateFormat={preferences.date_format}
          numberFormat={preferences.number_format}
        />

        <MarketClockCard
          marketCode="XTKS"
          apiMarketCode="XTKS"
          marketName="Tokyo Stock Exchange"
          flagCode="jp"
          timezone="Asia/Tokyo"
          tradingHours={{ open: '09:00', close: '15:00' }}
          color="rose"
          holidays={marketHolidays.filter((h) => h.market === 'XTKS')}
          holidaysLoading={holidaysLoading}
          marketToday={marketTodayByCode.XTKS}
          region="EU"
          userTimezone={preferences.timezone}
          showPreMarket={preferences.show_pre_market}
          language={preferences.language}
          dateFormat={preferences.date_format}
          numberFormat={preferences.number_format}
        />
      </div>
    </div>
  );
};

export default ModernMarketInfo;
