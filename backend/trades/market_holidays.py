"""
Utilitaire pour gérer les jours fériés et demi-journées des marchés boursiers (NYSE et Euronext).
"""
from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional
import pandas_market_calendars as mcal
import pandas as pd
import exchange_calendars as xcals


class MarketHolidaysService:
    """Service pour récupérer les jours fériés et demi-journées des marchés boursiers."""
    
    @staticmethod
    def get_market_holidays(market: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """
        Retourne la liste des jours fériés pour un marché donné avec leurs noms.
        
        Args:
            market: Code du marché ('XNYS' pour NYSE, 'XPAR' pour Euronext Paris)
            start_date: Date de début
            end_date: Date de fin
            
        Returns:
            Liste de dictionnaires avec date et nom du jour férié
        """
        try:
            calendar = mcal.get_calendar(market)
            schedule = calendar.schedule(start_date=start_date, end_date=end_date)
            
            # Obtenir tous les jours ouvrables du calendrier
            all_business_days = pd.date_range(start=start_date, end=end_date, freq='B')
            
            # Les jours fériés sont les jours ouvrables qui ne sont pas dans le schedule
            market_open_days = pd.to_datetime(schedule.index.date)
            holiday_dates = [d.date() for d in all_business_days if d.date() not in market_open_days.date]
            
            # Récupérer les noms des jours fériés depuis le calendrier
            holidays_with_names = []
            for holiday_date in holiday_dates:
                # Essayer de récupérer le nom du jour férié
                holiday_name = MarketHolidaysService._get_holiday_name(calendar, holiday_date)
                holidays_with_names.append({
                    'date': holiday_date,
                    'name': holiday_name
                })
            
            return holidays_with_names
        except Exception:
            return []
    
    @staticmethod
    def _get_holiday_name(calendar, holiday_date: date) -> str:
        """
        Récupère le nom d'un jour férié depuis le calendrier.
        
        Args:
            calendar: Instance du calendrier de marché
            holiday_date: Date du jour férié
            
        Returns:
            Nom du jour férié ou nom générique
        """
        try:
            # Essayer d'utiliser exchange_calendars pour obtenir le nom
            if hasattr(calendar, 'calendar'):
                xcal = calendar.calendar
                if hasattr(xcal, 'regular_holidays'):
                    # Vérifier chaque règle de jour férié
                    for rule in xcal.regular_holidays:
                        try:
                            # Générer les dates pour cette règle
                            rule_dates = rule.dates(
                                pd.Timestamp(holiday_date.year, 1, 1),
                                pd.Timestamp(holiday_date.year, 12, 31),
                                return_name=True
                            )
                            # Chercher si notre date correspond
                            for rule_date, name in rule_dates:
                                if rule_date.date() == holiday_date:
                                    return name
                        except:
                            continue
                
                # Vérifier les jours fériés ad-hoc
                if hasattr(xcal, 'adhoc_holidays'):
                    for adhoc_date, name in xcal.adhoc_holidays:
                        if adhoc_date.date() == holiday_date:
                            return name
            
            # Fallback: déterminer le nom basé sur des patterns communs
            return MarketHolidaysService._guess_holiday_name(holiday_date)
        except Exception:
            return MarketHolidaysService._guess_holiday_name(holiday_date)
    
    @staticmethod
    def _guess_holiday_name(holiday_date: date) -> str:
        """
        Devine le nom d'un jour férié basé sur la date.
        
        Args:
            holiday_date: Date du jour férié
            
        Returns:
            Nom probable du jour férié
        """
        month = holiday_date.month
        day = holiday_date.day
        
        # Jours fériés fixes communs
        if month == 1 and day == 1:
            return "New Year's Day"
        elif month == 7 and day == 4:
            return "Independence Day"
        elif month == 12 and day == 25:
            return "Christmas Day"
        elif month == 12 and day == 24:
            return "Christmas Eve"
        elif month == 11 and 22 <= day <= 28 and holiday_date.weekday() == 3:
            return "Thanksgiving"
        elif month == 1 and 15 <= day <= 21 and holiday_date.weekday() == 0:
            return "Martin Luther King Jr. Day"
        elif month == 2 and 15 <= day <= 21 and holiday_date.weekday() == 0:
            return "Presidents' Day"
        elif month == 5 and day >= 25 and holiday_date.weekday() == 0:
            return "Memorial Day"
        elif month == 9 and day <= 7 and holiday_date.weekday() == 0:
            return "Labor Day"
        elif month == 4 and 1 <= day <= 30:  # Pâques varie
            return "Good Friday"
        elif month == 5 and day == 1:
            return "Labour Day"
        elif month == 5 and day == 8:
            return "Victory in Europe Day"
        elif month == 7 and day == 14:
            return "Bastille Day"
        elif month == 8 and day == 15:
            return "Assumption of Mary"
        elif month == 11 and day == 1:
            return "All Saints' Day"
        elif month == 11 and day == 11:
            return "Armistice Day"
        # UK-specific holidays
        elif month == 1 and 1 <= day <= 3 and holiday_date.weekday() == 0:
            return "New Year's Day (observed)"
        elif month == 5 and day >= 25 and holiday_date.weekday() == 0:
            return "Spring Bank Holiday"
        elif month == 8 and day >= 25 and holiday_date.weekday() == 0:
            return "Summer Bank Holiday"
        elif month == 12 and 26 <= day <= 28:
            return "Boxing Day"
        
        return "Market Holiday"
    
    @staticmethod
    def get_early_closes(market: str, start_date: date, end_date: date) -> List[date]:
        """
        Retourne la liste des demi-journées (early closes) pour un marché donné.
        
        Args:
            market: Code du marché ('XNYS' pour NYSE, 'XPAR' pour Euronext Paris)
            start_date: Date de début
            end_date: Date de fin
            
        Returns:
            Liste des dates de demi-journées
        """
        try:
            calendar = mcal.get_calendar(market)
            early_closes = calendar.early_closes(schedule=calendar.schedule(start_date=start_date, end_date=end_date))
            
            if early_closes is not None and len(early_closes) > 0:
                return sorted([d.date() for d in early_closes.index])
            return []
        except Exception:
            return []
    
    @staticmethod
    def get_next_holidays(count: int = 2, markets: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Retourne les N prochains jours fériés ou demi-journées pour les marchés spécifiés.
        
        Args:
            count: Nombre de jours à retourner par marché
            markets: Liste des codes de marché (par défaut: ['XNYS', 'XPAR'])
            
        Returns:
            Liste de dictionnaires avec date, nom, type et marché
        """
        if markets is None:
            markets = ['XNYS', 'XPAR']
        
        today = date.today()
        # Chercher sur 2 ans pour être sûr de trouver assez d'événements
        end_date = today + timedelta(days=730)
        
        market_names = {
            'XNYS': 'NYSE',
            'XPAR': 'Euronext Paris',
            'XLON': 'LSE'
        }
        
        upcoming = []
        
        for market_code in markets:
            market_name = market_names.get(market_code, market_code)
            
            # Récupérer les jours fériés avec leurs noms
            holidays_data = MarketHolidaysService.get_market_holidays(market_code, today, end_date)
            holiday_dates = [h['date'] for h in holidays_data]
            
            for holiday_info in holidays_data:
                holiday_date = holiday_info['date']
                if holiday_date >= today:
                    upcoming.append({
                        'date': holiday_date.isoformat(),
                        'name': holiday_info['name'],
                        'type': 'holiday',
                        'market': market_code
                    })
            
            # Récupérer les demi-journées
            early_closes = MarketHolidaysService.get_early_closes(market_code, today, end_date)
            for early_date in early_closes:
                if early_date >= today and early_date not in holiday_dates:
                    upcoming.append({
                        'date': early_date.isoformat(),
                        'name': f'{market_name} Early Close',
                        'type': 'early_close',
                        'market': market_code
                    })
        
        # Trier par date et retourner les N premiers par marché
        upcoming.sort(key=lambda x: x['date'])
        
        # Limiter à count événements par marché
        result = []
        market_counts = {m: 0 for m in markets}
        
        for event in upcoming:
            market = event['market']
            if market_counts[market] < count:
                result.append(event)
                market_counts[market] += 1
            
            # Arrêter si on a count événements pour tous les marchés
            if all(c >= count for c in market_counts.values()):
                break
        
        return result
