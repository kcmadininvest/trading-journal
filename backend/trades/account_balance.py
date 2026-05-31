"""
Définitions et calculs centralisés pour le solde d'un compte de trading.

- ``trading_equity`` : capital initial + PnL des trades uniquement (performance de trading).
- ``current_balance`` (solde de trésorerie) : capital initial + PnL + dépôts - retraits.

Ces définitions sont la source de vérité pour l'endpoint ``account-transactions/balance``
et pour la validation des retraits.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, Optional

from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.db.models.functions import Coalesce

if TYPE_CHECKING:
    from .models import TradingAccount


def _trade_pnl_value(trade, *, use_gross: bool) -> Decimal:
    if use_gross:
        raw = trade.pnl if trade.pnl is not None else trade.net_pnl
    else:
        raw = trade.net_pnl
    return raw if raw is not None else Decimal('0')


def _daily_net_transactions(
    trading_account: TradingAccount,
    exclude_transaction_id: Optional[int] = None,
) -> Dict[date, Decimal]:
    qs = trading_account.transactions.all()
    if exclude_transaction_id is not None:
        qs = qs.exclude(pk=exclude_transaction_id)
    daily: Dict[date, Decimal] = defaultdict(lambda: Decimal('0'))
    for txn in qs.only('transaction_type', 'amount', 'transaction_date'):
        txn_date = txn.transaction_date.date()  # type: ignore[union-attr]
        signed = txn.amount if txn.transaction_type == 'deposit' else -txn.amount
        daily[txn_date] += signed
    return daily


def compute_peak_balance(
    trading_account: TradingAccount,
    exclude_transaction_id: Optional[int] = None,
    *,
    use_gross: bool = False,
) -> Decimal:
    """
    Plus haut solde atteint (tout historique) : capital initial + flux journaliers.

    Par jour civil : dépôts/retraits d'abord, puis PnL des trades (aligné dashboard).
    """
    initial_capital: Decimal = trading_account.initial_capital or Decimal('0')
    daily_tx = _daily_net_transactions(trading_account, exclude_transaction_id)

    trade_dates: set[date] = set()
    trades_by_day: Dict[date, list] = defaultdict(list)
    for trade in trading_account.topstep_trades.all().only(
        'trade_day', 'entered_at', 'net_pnl', 'pnl'
    ):
        if not trade.trade_day:
            continue
        trade_dates.add(trade.trade_day)
        trades_by_day[trade.trade_day].append(trade)

    for day_trades in trades_by_day.values():
        day_trades.sort(
            key=lambda t: (
                t.entered_at if t.entered_at is not None else t.trade_day,
                t.pk,
            )
        )

    all_dates = sorted(set(daily_tx.keys()) | trade_dates)
    running = initial_capital
    peak = initial_capital

    for day in all_dates:
        if day in daily_tx:
            running += daily_tx[day]
            if running > peak:
                peak = running
        for trade in trades_by_day.get(day, []):
            running += _trade_pnl_value(trade, use_gross=use_gross)
            if running > peak:
                peak = running

    return peak


def compute_trading_account_balance(
    trading_account: TradingAccount,
    exclude_transaction_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Calcule les agrégats de solde pour un compte.

    Si ``exclude_transaction_id`` est fourni, la transaction correspondante est exclue
    du calcul des flux (utile pour valider une création/mise à jour sans effet de bord).
    """
    initial_capital: Decimal = trading_account.initial_capital or Decimal('0')

    trades_qs = trading_account.topstep_trades.all()
    _pnl_money = DecimalField(max_digits=18, decimal_places=9)
    _zero_pnl = Value(Decimal('0'), output_field=_pnl_money)
    # Net : agrégat historique (SUM ignore les NULL)
    total_pnl = trades_qs.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
    # Brut affichage : cohérent avec trade_pnl_as_decimal(..., 'pnl') — repli net si pnl absent
    gross_expr = Coalesce(F('pnl'), F('net_pnl'), _zero_pnl, output_field=_pnl_money)
    total_pnl_gross = trades_qs.aggregate(total=Sum(gross_expr))['total'] or Decimal('0')

    trading_equity: Decimal = initial_capital + total_pnl
    trading_equity_gross: Decimal = initial_capital + total_pnl_gross

    qs = trading_account.transactions.all()
    if exclude_transaction_id is not None:
        qs = qs.exclude(pk=exclude_transaction_id)

    amount_field = DecimalField(max_digits=15, decimal_places=2)
    tx_agg = qs.aggregate(
        total_deposits=Sum(
            Case(
                When(transaction_type='deposit', then=F('amount')),
                default=Value(Decimal('0')),
                output_field=amount_field,
            )
        ),
        total_withdrawals=Sum(
            Case(
                When(transaction_type='withdrawal', then=F('amount')),
                default=Value(Decimal('0')),
                output_field=amount_field,
            )
        ),
    )
    total_deposits: Decimal = tx_agg['total_deposits'] or Decimal('0')
    total_withdrawals: Decimal = tx_agg['total_withdrawals'] or Decimal('0')
    net_transactions: Decimal = total_deposits - total_withdrawals

    current_balance: Decimal = initial_capital + total_pnl + net_transactions
    current_balance_gross: Decimal = initial_capital + total_pnl_gross + net_transactions

    peak_balance = compute_peak_balance(
        trading_account, exclude_transaction_id, use_gross=False
    )
    peak_balance_gross = compute_peak_balance(
        trading_account, exclude_transaction_id, use_gross=True
    )

    return {
        'initial_capital': initial_capital,
        'total_pnl': total_pnl,
        'total_pnl_gross': total_pnl_gross,
        'trading_equity': trading_equity,
        'trading_equity_gross': trading_equity_gross,
        'total_deposits': total_deposits,
        'total_withdrawals': total_withdrawals,
        'net_transactions': net_transactions,
        'current_balance': current_balance,
        'current_balance_gross': current_balance_gross,
        'peak_balance': peak_balance,
        'peak_balance_gross': peak_balance_gross,
    }
