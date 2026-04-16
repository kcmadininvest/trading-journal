"""
Définitions et calculs centralisés pour le solde d'un compte de trading.

- ``trading_equity`` : capital initial + PnL des trades uniquement (performance de trading).
- ``current_balance`` (solde de trésorerie) : capital initial + PnL + dépôts - retraits.

Ces définitions sont la source de vérité pour l'endpoint ``account-transactions/balance``
et pour la validation des retraits.
"""
from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, Optional

from django.db.models import Case, DecimalField, F, Sum, Value, When

if TYPE_CHECKING:
    from .models import TradingAccount


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

    total_pnl = trading_account.topstep_trades.aggregate(total=Sum('net_pnl'))['total'] or Decimal('0')
    trading_equity: Decimal = initial_capital + total_pnl

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

    return {
        'initial_capital': initial_capital,
        'total_pnl': total_pnl,
        'trading_equity': trading_equity,
        'total_deposits': total_deposits,
        'total_withdrawals': total_withdrawals,
        'net_transactions': net_transactions,
        'current_balance': current_balance,
    }
