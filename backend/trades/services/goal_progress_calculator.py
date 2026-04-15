"""
Services pour le calcul de progression des objectifs de trading.
"""
from django.db.models import Sum, Avg, QuerySet
from decimal import Decimal
from typing import cast, TYPE_CHECKING

if TYPE_CHECKING:
    from ..models import TradingAccount

from ..models import TradingGoal, TopStepTrade, TradeStrategy, AccountTransaction


class GoalProgressCalculator:
    """
    Service pour calculer la progression des objectifs de trading.
    """

    @staticmethod
    def _to_decimal(value) -> Decimal:
        """Convertit une valeur (DecimalField ou autre) en Decimal."""
        if value is None:
            return Decimal('0')
        if isinstance(value, Decimal):
            return value
        return Decimal(str(value))

    def _get_target_value(self, goal: TradingGoal) -> Decimal:
        """Récupère la valeur cible (threshold_target ou target_value pour rétrocompatibilité)."""
        if goal.threshold_target is not None:
            return self._to_decimal(goal.threshold_target)
        if goal.target_value is not None:
            return self._to_decimal(goal.target_value)
        return Decimal('0')

    def _calculate_percentage(self, goal: TradingGoal, current_value: Decimal, target_value: Decimal) -> float:
        """Calcule le pourcentage de progression selon la direction."""
        if target_value == 0:
            return 0.0

        if goal.direction == 'minimum':
            return float(min(100, (current_value / target_value) * 100))
        if current_value >= target_value:
            return 0.0
        return float(min(100, ((target_value - current_value) / target_value) * 100))

    def calculate_progress(self, goal: TradingGoal) -> dict:
        """
        Calcule la progression d'un objectif.

        Returns:
            dict: {
                'current_value': Decimal,
                'percentage': float,
                'status': str,
                'remaining_days': int,
                'remaining_amount': Decimal (pour PnL)
            }
        """
        trades = self._get_trades_for_goal(goal)

        if goal.goal_type == 'pnl_total':
            return self._calculate_pnl_goal(goal, trades)
        if goal.goal_type == 'withdrawal_amount':
            return self._calculate_withdrawal_amount_goal(goal)
        if goal.goal_type == 'max_consecutive_losses':
            return self._calculate_max_consecutive_losses_goal(goal, trades)
        if goal.goal_type == 'daily_loss_limit_breaches':
            return self._calculate_daily_loss_limit_breaches_goal(goal, trades)
        if goal.goal_type == 'expectancy':
            return self._calculate_expectancy_goal(goal, trades)
        if goal.goal_type == 'avg_rr_actual':
            return self._calculate_avg_rr_actual_goal(goal, trades)
        if goal.goal_type == 'journal_completion_rate':
            return self._calculate_journal_completion_rate_goal(goal, trades)
        if goal.goal_type == 'win_rate':
            return self._calculate_winrate_goal(goal, trades)
        if goal.goal_type == 'trades_count':
            return self._calculate_trades_count_goal(goal, trades)
        if goal.goal_type == 'profit_factor':
            return self._calculate_profit_factor_goal(goal, trades)
        if goal.goal_type == 'max_drawdown':
            return self._calculate_drawdown_goal(goal, trades)
        if goal.goal_type == 'strategy_respect':
            return self._calculate_strategy_respect_goal(goal, trades)
        if goal.goal_type == 'winning_days':
            return self._calculate_winning_days_goal(goal, trades)
        return {
            'current_value': Decimal('0'),
            'percentage': 0,
            'status': 'active',
            'remaining_days': goal.remaining_days,
            'remaining_amount': Decimal('0'),
        }

    def _get_trades_for_goal(self, goal: TradingGoal):
        """Récupère les trades pertinents pour l'objectif."""
        if goal.trading_account:
            trading_account = cast('TradingAccount', goal.trading_account)
            topstep_trades = getattr(trading_account, 'topstep_trades')
            trades: QuerySet[TopStepTrade] = topstep_trades.filter(
                user=goal.user
            )
        else:
            trades_manager = getattr(TopStepTrade, 'objects')
            all_trades: QuerySet[TopStepTrade] = trades_manager.filter(
                user=goal.user
            )
            trades = all_trades.filter(
                trade_day__gte=goal.start_date,
                trade_day__lte=goal.end_date
            )
            return trades

        trades = trades.filter(
            trade_day__gte=goal.start_date,
            trade_day__lte=goal.end_date
        )

        return trades

    def _calculate_pnl_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif PnL total."""
        total_pnl = trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        current_value = total_pnl

        target_value_decimal = self._get_target_value(goal)
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_winrate_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Win Rate."""
        total_trades = trades.count()
        target_value_decimal = self._get_target_value(goal)

        if total_trades == 0:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': target_value_decimal,
            }

        winning_trades = trades.filter(net_pnl__gt=0).count()
        win_rate = (winning_trades / total_trades) * 100
        current_value = Decimal(str(win_rate))

        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_withdrawal_amount_goal(self, goal: TradingGoal) -> dict:
        """Calcule la progression pour un objectif de montant total des retraits."""
        transactions = AccountTransaction.objects.filter(
            user=goal.user,
            transaction_type='withdrawal',
            transaction_date__date__gte=goal.start_date,
            transaction_date__date__lte=goal.end_date,
        )

        if goal.trading_account:
            transactions = transactions.filter(trading_account=goal.trading_account)

        total_withdrawals = transactions.aggregate(total=Sum('amount'))['total'] or Decimal('0')
        current_value = self._to_decimal(total_withdrawals)

        target_value_decimal = self._get_target_value(goal)
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_trades_count_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Nombre de Trades."""
        current_value = Decimal(str(trades.count()))

        target_value_decimal = self._get_target_value(goal)
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_max_consecutive_losses_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif de pertes consécutives maximales."""
        ordered_trades = trades.order_by('trade_day', 'entered_at').values_list('net_pnl', flat=True)
        current_streak = 0
        max_streak = 0

        for pnl in ordered_trades:
            pnl_value = pnl or Decimal('0')
            if pnl_value < 0:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0

        current_value = Decimal(str(max_streak))
        target_value_decimal = self._get_target_value(goal)
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_daily_loss_limit_breaches_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif de dépassements de perte journalière."""
        target_value_decimal = self._get_target_value(goal)
        if target_value_decimal <= 0:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': Decimal('0'),
            }

        daily_pnl = trades.values('trade_day').annotate(daily_total=Sum('net_pnl'))
        breach_threshold = -target_value_decimal
        breaches = sum(
            1 for day in daily_pnl
            if day['daily_total'] is not None and Decimal(str(day['daily_total'])) < breach_threshold
        )

        current_value = Decimal(str(breaches))
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_expectancy_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif d'expectancy."""
        total_trades = trades.count()
        target_value_decimal = self._get_target_value(goal)

        if total_trades == 0:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': target_value_decimal,
            }

        wins_qs = trades.filter(net_pnl__gt=0)
        losses_qs = trades.filter(net_pnl__lt=0)
        winning_count = wins_qs.count()
        losing_count = losses_qs.count()

        avg_win = wins_qs.aggregate(avg=Avg('net_pnl'))['avg'] or Decimal('0')
        avg_loss = losses_qs.aggregate(avg=Avg('net_pnl'))['avg'] or Decimal('0')

        win_rate = Decimal(str(winning_count)) / Decimal(str(total_trades))
        loss_rate = Decimal(str(losing_count)) / Decimal(str(total_trades))

        expectancy = (win_rate * Decimal(str(avg_win))) - (loss_rate * abs(Decimal(str(avg_loss))))
        current_value = expectancy

        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)
        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_avg_rr_actual_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif de R:R réel moyen."""
        rr_avg = trades.filter(actual_risk_reward_ratio__isnull=False).aggregate(
            avg=Avg('actual_risk_reward_ratio')
        )['avg']
        current_value = self._to_decimal(rr_avg)
        target_value_decimal = self._get_target_value(goal)
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_journal_completion_rate_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif de complétion du journal de trades."""
        total_trades = trades.count()
        target_value_decimal = self._get_target_value(goal)

        if total_trades == 0:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': target_value_decimal,
            }

        trade_ids = list(trades.values_list('id', flat=True))
        reviewed_trade_ids = set(
            TradeStrategy.objects.filter(user=goal.user, trade_id__in=trade_ids).values_list('trade_id', flat=True)
        )

        reviewed_trades = 0
        for trade in trades.only('id', 'notes'):
            has_notes = bool((trade.notes or '').strip())
            has_strategy_review = trade.id in reviewed_trade_ids
            if has_notes or has_strategy_review:
                reviewed_trades += 1

        completion_rate = (Decimal(str(reviewed_trades)) / Decimal(str(total_trades))) * Decimal('100')
        current_value = completion_rate
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)
        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_profit_factor_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Profit Factor."""
        total_gains = trades.filter(net_pnl__gt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
        total_losses = trades.filter(net_pnl__lt=0).aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')

        if total_losses == 0:
            current_value = Decimal('999999')
        else:
            profit_factor = abs(total_gains) / abs(total_losses)
            current_value = Decimal(str(profit_factor))

        target_value_decimal = self._get_target_value(goal)
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_drawdown_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Drawdown Maximum."""
        target_value_decimal = self._get_target_value(goal)

        if not trades.exists():
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': target_value_decimal,
            }

        trades_ordered = trades.order_by('trade_day', 'entered_at')

        if goal.trading_account:
            trading_account = cast('TradingAccount', goal.trading_account)
            initial_capital = self._to_decimal(getattr(trading_account, 'initial_capital', None))
            if initial_capital == 0:
                initial_capital = Decimal('50000')
        else:
            first_trade = trades_ordered.first()
            if first_trade and first_trade.trading_account:
                trading_account = cast('TradingAccount', first_trade.trading_account)
                initial_capital = self._to_decimal(getattr(trading_account, 'initial_capital', None))
                if initial_capital == 0:
                    initial_capital = Decimal('50000')
            else:
                initial_capital = Decimal('50000')

        cumulative_pnl = Decimal('0')
        peak_capital = initial_capital
        max_drawdown = Decimal('0')

        for trade in trades_ordered:
            cumulative_pnl += trade.net_pnl or Decimal('0')
            current_capital = initial_capital + cumulative_pnl

            if current_capital > peak_capital:
                peak_capital = current_capital

            drawdown = peak_capital - current_capital
            if drawdown > max_drawdown:
                max_drawdown = drawdown

        max_drawdown_pct = (max_drawdown / peak_capital * 100) if peak_capital > 0 else Decimal('0')
        current_value = max_drawdown_pct

        if current_value >= target_value_decimal:
            percentage_float = 0.0
            status = 'failed'
        elif current_value < target_value_decimal:
            if goal.remaining_days <= 0:
                percentage_float = 100.0
                status = 'achieved'
            else:
                percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)
                status = 'active'
        else:
            percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)
            status = 'active' if goal.remaining_days > 0 else 'failed'

        remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_strategy_respect_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Respect de Stratégie."""
        trade_ids = trades.values_list('id', flat=True)
        strategies_manager = getattr(TradeStrategy, 'objects')
        strategies: QuerySet[TradeStrategy] = strategies_manager.filter(
            trade_id__in=trade_ids,
            user=goal.user
        )

        target_value_decimal = self._get_target_value(goal)
        total_strategies = strategies.count()

        if total_strategies == 0:
            return {
                'current_value': Decimal('0'),
                'percentage': 0,
                'status': 'active',
                'remaining_days': goal.remaining_days,
                'remaining_amount': target_value_decimal,
            }

        respected_count = strategies.filter(strategy_respected=True).count()
        respect_percentage = (respected_count / total_strategies) * 100
        current_value = Decimal(str(respect_percentage))

        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _calculate_winning_days_goal(self, goal: TradingGoal, trades) -> dict:
        """Calcule la progression pour un objectif Nombre de Jours Gagnants."""
        daily_pnl = trades.values('trade_day').annotate(
            daily_total=Sum('net_pnl')
        )

        winning_days = sum(1 for day in daily_pnl if day['daily_total'] and day['daily_total'] > 0)
        current_value = Decimal(str(winning_days))

        target_value_decimal = self._get_target_value(goal)
        percentage_float = self._calculate_percentage(goal, current_value, target_value_decimal)

        if goal.direction == 'minimum':
            remaining_amount = max(Decimal('0'), target_value_decimal - current_value)
        else:
            remaining_amount = max(Decimal('0'), current_value - target_value_decimal)

        status = self._determine_status(goal, percentage_float, current_value, target_value_decimal)

        return {
            'current_value': current_value,
            'percentage': percentage_float,
            'status': status,
            'remaining_days': goal.remaining_days,
            'remaining_amount': remaining_amount,
        }

    def _determine_status(self, goal: TradingGoal, percentage: float, current_value: Decimal, target_value: Decimal) -> str:
        """Détermine le statut de l'objectif."""
        if goal.status == 'cancelled':
            return 'cancelled'

        if goal.direction == 'minimum':
            if current_value >= target_value:
                return 'achieved'
        else:
            if current_value > target_value:
                return 'failed'
            if goal.remaining_days <= 0 and current_value <= target_value:
                return 'achieved'

        if percentage >= 100:
            return 'achieved'

        if goal.remaining_days <= 0:
            return 'failed'

        return 'active'
