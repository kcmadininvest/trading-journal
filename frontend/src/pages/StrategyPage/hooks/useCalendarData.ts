import { useState, useCallback } from 'react';
import { tradesService } from '../../../services/trades';
import { useLogger } from '../../../hooks/useLogger';
import { CalendarData, UseCalendarDataReturn } from '../types/strategy.types';

export const useCalendarData = (): UseCalendarDataReturn => {
  const logger = useLogger('useCalendarData');
  
  // États pour les données du calendrier
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(false);

  // Fonction pour charger les données du calendrier
  const fetchCalendarData = useCallback(async (year: number, month: number, accountId?: number) => {
    logger.debug('📅 [CALENDAR] fetchCalendarData appelé avec:', { year, month, accountId });
    
    try {
      setLoading(true);
      logger.debug('📅 [CALENDAR] Début du chargement des données du calendrier');
      
      const data = await tradesService.getCalendarData(year, month, accountId);
      setCalendarData(data);
      
      logger.debug('✅ [CALENDAR] Données du calendrier chargées:', {
        dailyDataCount: data.daily_data?.length || 0,
        weeklyDataCount: data.weekly_data?.length || 0,
        monthlyTotal: data.monthly_total
      });
    } catch (error) {
      logger.error('❌ [CALENDAR] Erreur lors du chargement des données du calendrier:', error);
      setCalendarData(null);
    } finally {
      setLoading(false);
      logger.debug('🏁 [CALENDAR] Chargement terminé');
    }
  }, [logger]);

  return {
    calendarData,
    loading,
    fetchCalendarData
  };
};
