from decimal import Decimal
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from django.db.models import QuerySet, Sum, Avg, Count, Q, Max, Min, F, ExpressionWrapper
from django.db.models.functions import Coalesce
from django.db.models.fields import DecimalField
from django.utils import timezone
import pytz


class PortfolioStatsCalculator:
    """
    Calculateur de statistiques pour un portefeuille.
    Centralise tous les calculs pour réutilisation dans les exports et l'API.
    """
    
    def __init__(self, trading_account, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None):
        """
        Initialise le calculateur avec un compte de trading et une période optionnelle.
        
        Args:
            trading_account: Instance de TradingAccount
            start_date: Date de début (optionnel)
            end_date: Date de fin (optionnel)
        """
        self.trading_account = trading_account
        self.start_date = start_date
        self.end_date = end_date
        self.user = trading_account.user
        
    def get_trades_queryset(self) -> QuerySet:
        """Retourne le queryset des trades filtrés par période."""
        from trades.models import TopStepTrade

        trades = (
            TopStepTrade.objects.filter(
                user=self.user,
                trading_account=self.trading_account,
            )
            .select_related('position_strategy')
            .annotate(
                effective_fees=ExpressionWrapper(
                    Coalesce(F('fees'), Decimal('0')) + Coalesce(F('commissions'), Decimal('0')),
                    output_field=DecimalField(max_digits=20, decimal_places=9),
                ),
                effective_pnl=Coalesce(
                    'net_pnl',
                    ExpressionWrapper(
                        Coalesce(F('pnl'), Decimal('0')) - (Coalesce(F('fees'), Decimal('0')) + Coalesce(F('commissions'), Decimal('0'))),
                        output_field=DecimalField(max_digits=20, decimal_places=9),
                    ),
                    output_field=DecimalField(max_digits=20, decimal_places=9),
                ),
            )
        )

        if self.start_date:
            trades = trades.filter(entered_at__gte=self.start_date)
        if self.end_date:
            trades = trades.filter(entered_at__lte=self.end_date)

        return trades
    
    def calculate_all_stats(self) -> Dict[str, Any]:
        """
        Calcule toutes les statistiques du portefeuille.
        
        Returns:
            Dictionnaire contenant toutes les statistiques
        """
        trades = self.get_trades_queryset()
        
        return {
            'general': self.calculate_general_stats(trades),
            'performance': self.calculate_performance_stats(trades),
            'risk': self.calculate_risk_stats(trades),
            'by_strategy': self.calculate_stats_by_strategy(trades),
            'by_instrument': self.calculate_stats_by_instrument(trades),
            'by_timeframe': self.calculate_stats_by_timeframe(trades),
            'by_day_of_week': self.calculate_stats_by_day_of_week(trades),
            'by_hour': self.calculate_stats_by_hour(trades),
            'monthly_performance': self.calculate_monthly_performance(trades),
            'equity_curve': self.calculate_equity_curve(trades),
            'top_trades': self.get_top_trades(trades),
            'all_trades': self.get_all_trades(trades),
        }
    
    def calculate_general_stats(self, trades: QuerySet) -> Dict[str, Any]:
        """Calcule les statistiques générales."""
        total_trades = trades.count()
        winning_trades = trades.filter(effective_pnl__gt=0).count()
        losing_trades = trades.filter(effective_pnl__lt=0).count()
        breakeven_trades = trades.filter(effective_pnl=0).count()
        
        total_pnl = trades.aggregate(total=Sum('effective_pnl'))['total'] or Decimal('0')
        total_fees = trades.aggregate(total=Sum('effective_fees'))['total'] or Decimal('0')
        net_pnl = total_pnl
        
        win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
        
        return {
            'total_trades': total_trades,
            'winning_trades': winning_trades,
            'losing_trades': losing_trades,
            'breakeven_trades': breakeven_trades,
            'win_rate': round(win_rate, 2),
            'total_pnl': float(total_pnl),
            'total_fees': float(total_fees),
            'net_pnl': float(net_pnl),
            'initial_capital': float(self.trading_account.initial_capital or 0),
            'current_capital': float(self.trading_account.initial_capital or 0) + float(net_pnl),
            'return_pct': round((float(net_pnl) / float(self.trading_account.initial_capital or 1)) * 100, 2) if self.trading_account.initial_capital else 0,
        }
    
    def calculate_performance_stats(self, trades: QuerySet) -> Dict[str, Any]:
        """Calcule les statistiques de performance."""
        winning_trades = trades.filter(effective_pnl__gt=0)
        losing_trades = trades.filter(effective_pnl__lt=0)
        
        avg_win = winning_trades.aggregate(avg=Avg('effective_pnl'))['avg'] or Decimal('0')
        avg_loss = losing_trades.aggregate(avg=Avg('effective_pnl'))['avg'] or Decimal('0')
        
        largest_win = winning_trades.aggregate(max=Max('effective_pnl'))['max'] or Decimal('0')
        largest_loss = losing_trades.aggregate(min=Min('effective_pnl'))['min'] or Decimal('0')
        
        total_wins = winning_trades.aggregate(sum=Sum('effective_pnl'))['sum'] or Decimal('0')
        total_losses = abs(losing_trades.aggregate(sum=Sum('effective_pnl'))['sum'] or Decimal('0'))
        
        profit_factor = float(total_wins / total_losses) if total_losses > 0 else 0
        
        expectancy = float(avg_win) - abs(float(avg_loss)) if avg_loss else float(avg_win)
        
        return {
            'average_win': float(avg_win),
            'average_loss': float(avg_loss),
            'largest_win': float(largest_win),
            'largest_loss': float(largest_loss),
            'profit_factor': round(profit_factor, 2),
            'expectancy': round(expectancy, 2),
            'risk_reward_ratio': round(abs(float(avg_win) / float(avg_loss)), 2) if avg_loss else 0,
        }
    
    def calculate_risk_stats(self, trades: QuerySet) -> Dict[str, Any]:
        """Calcule les statistiques de risque."""
        equity_curve = self.calculate_equity_curve(trades)
        
        if not equity_curve:
            return {
                'max_drawdown': 0,
                'max_drawdown_pct': 0,
                'current_drawdown': 0,
                'sharpe_ratio': 0,
            }
        
        balances = [point['balance'] for point in equity_curve]
        peak = balances[0]
        max_dd = 0
        max_dd_pct = 0
        
        for balance in balances:
            if balance > peak:
                peak = balance
            dd = peak - balance
            dd_pct = (dd / peak * 100) if peak > 0 else 0
            if dd > max_dd:
                max_dd = dd
                max_dd_pct = dd_pct
        
        current_balance = balances[-1] if balances else 0
        current_peak = max(balances) if balances else 0
        current_dd = current_peak - current_balance
        
        returns = []
        for i in range(1, len(balances)):
            if balances[i-1] != 0:
                ret = (balances[i] - balances[i-1]) / balances[i-1]
                returns.append(ret)
        
        sharpe_ratio = 0
        if returns:
            avg_return = sum(returns) / len(returns)
            std_return = (sum((r - avg_return) ** 2 for r in returns) / len(returns)) ** 0.5
            sharpe_ratio = (avg_return / std_return * (252 ** 0.5)) if std_return > 0 else 0
        
        return {
            'max_drawdown': round(max_dd, 2),
            'max_drawdown_pct': round(max_dd_pct, 2),
            'current_drawdown': round(current_dd, 2),
            'sharpe_ratio': round(sharpe_ratio, 2),
        }
    
    def calculate_stats_by_strategy(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Calcule les statistiques par stratégie."""
        strategies = trades.values('position_strategy__title').annotate(
            total_trades=Count('id'),
            winning_trades=Count('id', filter=Q(effective_pnl__gt=0)),
            total_pnl=Sum('effective_pnl'),
            avg_pnl=Avg('effective_pnl')
        ).order_by('-total_pnl')
        
        result = []
        for strategy in strategies:
            win_rate = (strategy['winning_trades'] / strategy['total_trades'] * 100) if strategy['total_trades'] > 0 else 0
            result.append({
                'strategy': strategy['position_strategy__title'] or 'Sans stratégie',
                'total_trades': strategy['total_trades'],
                'winning_trades': strategy['winning_trades'],
                'win_rate': round(win_rate, 2),
                'total_pnl': float(strategy['total_pnl'] or 0),
                'avg_pnl': float(strategy['avg_pnl'] or 0),
            })
        
        return result
    
    def calculate_stats_by_instrument(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Calcule les statistiques par instrument."""
        instruments = trades.values('contract_name').annotate(
            total_trades=Count('id'),
            winning_trades=Count('id', filter=Q(effective_pnl__gt=0)),
            total_pnl=Sum('effective_pnl'),
            avg_pnl=Avg('effective_pnl')
        ).order_by('-total_trades')
        
        result = []
        for instrument in instruments:
            win_rate = (instrument['winning_trades'] / instrument['total_trades'] * 100) if instrument['total_trades'] > 0 else 0
            result.append({
                'instrument': instrument['contract_name'] or 'Inconnu',
                'total_trades': instrument['total_trades'],
                'winning_trades': instrument['winning_trades'],
                'win_rate': round(win_rate, 2),
                'total_pnl': float(instrument['total_pnl'] or 0),
                'avg_pnl': float(instrument['avg_pnl'] or 0),
            })
        
        return result
    
    def calculate_stats_by_timeframe(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Calcule les statistiques par timeframe."""
        return []
    
    def calculate_stats_by_day_of_week(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Calcule les statistiques par jour de la semaine."""
        days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
        result = []
        
        for day_num in range(7):
            day_trades = trades.filter(entered_at__week_day=day_num + 1)
            total = day_trades.count()
            winning = day_trades.filter(effective_pnl__gt=0).count()
            total_pnl = day_trades.aggregate(sum=Sum('effective_pnl'))['sum'] or Decimal('0')
            
            win_rate = (winning / total * 100) if total > 0 else 0
            
            result.append({
                'day': days[day_num],
                'total_trades': total,
                'winning_trades': winning,
                'win_rate': round(win_rate, 2),
                'total_pnl': float(total_pnl),
            })
        
        return result
    
    def calculate_stats_by_hour(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Calcule les statistiques par heure de la journée."""
        result = []
        
        for hour in range(24):
            hour_trades = trades.filter(entered_at__hour=hour)
            total = hour_trades.count()
            if total == 0:
                continue

            winning = hour_trades.filter(effective_pnl__gt=0).count()
            total_pnl = hour_trades.aggregate(sum=Sum('effective_pnl'))['sum'] or Decimal('0')
            win_rate = (winning / total * 100) if total > 0 else 0
            
            result.append({
                'hour': f"{hour:02d}:00",
                'total_trades': total,
                'winning_trades': winning,
                'win_rate': round(win_rate, 2),
                'total_pnl': float(total_pnl),
            })
        
        return result
    
    def calculate_monthly_performance(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Calcule la performance mensuelle."""
        from django.db.models.functions import TruncMonth
        
        monthly = trades.annotate(
            month=TruncMonth('entered_at')
        ).values('month').annotate(
            total_trades=Count('id'),
            winning_trades=Count('id', filter=Q(effective_pnl__gt=0)),
            total_pnl=Sum('effective_pnl')
        ).order_by('month')
        
        result = []
        for month in monthly:
            win_rate = (month['winning_trades'] / month['total_trades'] * 100) if month['total_trades'] > 0 else 0
            result.append({
                'month': month['month'].strftime('%Y-%m') if month['month'] else 'Inconnu',
                'total_trades': month['total_trades'],
                'winning_trades': month['winning_trades'],
                'win_rate': round(win_rate, 2),
                'total_pnl': float(month['total_pnl'] or 0),
            })
        
        return result
    
    def calculate_equity_curve(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Calcule la courbe d'équité."""
        ordered_trades = trades.order_by('entered_at', 'id')
        
        initial_capital = float(self.trading_account.initial_capital or 0)
        balance = initial_capital
        
        equity_curve = [{
            'date': self.start_date.isoformat() if self.start_date else datetime.now().isoformat(),
            'balance': balance,
            'pnl': 0,
        }]
        
        for trade in ordered_trades:
            pnl_value = getattr(trade, 'effective_pnl', None)
            balance += float(pnl_value if pnl_value is not None else 0)
            equity_curve.append({
                'date': trade.entered_at.isoformat() if trade.entered_at else datetime.now().isoformat(),
                'balance': round(balance, 2),
                'pnl': float(pnl_value if pnl_value is not None else 0),
                'trade_id': trade.id,
            })
        
        return equity_curve
    
    def get_top_trades(self, trades: QuerySet, limit: int = 10) -> Dict[str, List[Dict[str, Any]]]:
        """Retourne les meilleurs et pires trades."""
        best_trades = trades.order_by('-effective_pnl')[:limit]
        worst_trades = trades.order_by('effective_pnl')[:limit]
        
        def format_trade(trade):
            pnl_value = getattr(trade, 'effective_pnl', None)
            return {
                'id': trade.id,
                'date': getattr(trade, 'entered_at', None),
                'instrument': getattr(trade, 'contract_name', None) or 'Inconnu',
                'strategy': (trade.position_strategy.title if getattr(trade, 'position_strategy', None) else None) or 'Sans stratégie',
                'direction': getattr(trade, 'trade_type', None) or '',
                'pnl': float(pnl_value if pnl_value is not None else 0),
                'pnl_pct': float(trade.pnl_percentage or 0),
                'notes': trade.notes or '',
            }
        
        return {
            'best': [format_trade(t) for t in best_trades],
            'worst': [format_trade(t) for t in worst_trades],
        }
    
    def get_all_trades(self, trades: QuerySet) -> List[Dict[str, Any]]:
        """Retourne tous les trades formatés pour l'export."""
        def format_trade(trade):
            pnl_value = getattr(trade, 'effective_pnl', None)
            return {
                'id': trade.id,
                'date': getattr(trade, 'entered_at', None),
                'instrument': getattr(trade, 'contract_name', None) or 'Inconnu',
                'strategy': (trade.position_strategy.title if getattr(trade, 'position_strategy', None) else None) or 'Sans stratégie',
                'direction': getattr(trade, 'trade_type', None) or '',
                'pnl': float(pnl_value if pnl_value is not None else 0),
                'pnl_pct': float(trade.pnl_percentage or 0),
                'notes': trade.notes or '',
            }
        
        return [format_trade(t) for t in trades.order_by('-entered_at')]
