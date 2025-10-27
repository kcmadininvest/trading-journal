import { useState, useCallback } from 'react';
import { useLogger } from '../../../hooks/useLogger';
import { StrategyTab, UseStrategyNavigationReturn } from '../types/strategy.types';

export const useStrategyNavigation = (): UseStrategyNavigationReturn => {
  const logger = useLogger('useStrategyNavigation');
  
  // États de navigation
  const [activeTab, setActiveTab] = useState<StrategyTab>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Fonction pour changer d'onglet
  const handleSetActiveTab = useCallback((tab: StrategyTab) => {
    logger.debug('🔄 [NAVIGATION] Changement d\'onglet:', tab);
    setActiveTab(tab);
  }, [logger]);

  // Fonction pour changer la date courante
  const handleSetCurrentDate = useCallback((date: Date) => {
    logger.debug('📅 [NAVIGATION] Changement de date:', date);
    setCurrentDate(date);
  }, [logger]);

  // Fonction pour changer l'année courante
  const handleSetCurrentYear = useCallback((year: number) => {
    logger.debug('📅 [NAVIGATION] Changement d\'année:', year);
    setCurrentYear(year);
  }, [logger]);

  // Navigation par mois
  const navigateMonth = useCallback((direction: 'prev' | 'next') => {
    logger.debug('📅 [NAVIGATION] Navigation mois:', direction);
    
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  }, [logger]);

  // Navigation par année
  const navigateYear = useCallback((direction: 'prev' | 'next') => {
    logger.debug('📅 [NAVIGATION] Navigation année:', direction);
    
    const newYear = direction === 'prev' ? currentYear - 1 : currentYear + 1;
    setCurrentYear(newYear);
  }, [currentYear, logger]);

  // Aller à aujourd'hui
  const goToToday = useCallback(() => {
    logger.debug('📅 [NAVIGATION] Aller à aujourd\'hui');
    setCurrentDate(new Date());
  }, [logger]);

  // Aller à l'année courante
  const goToCurrentYear = useCallback(() => {
    logger.debug('📅 [NAVIGATION] Aller à l\'année courante');
    setCurrentYear(new Date().getFullYear());
  }, [logger]);

  return {
    activeTab,
    currentDate,
    currentYear,
    setActiveTab: handleSetActiveTab,
    setCurrentDate: handleSetCurrentDate,
    setCurrentYear: handleSetCurrentYear,
    navigateMonth,
    navigateYear,
    goToToday,
    goToCurrentYear
  };
};
