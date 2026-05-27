"""Conversion FX des PnL de trades pour agrégations multi-devises (tous comptes)."""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Optional

from integrations.fx_rates_service import convert_amount_to_base, fetch_latest_rates
from trades.pnl_basis import trade_pnl_as_decimal, trade_pnl_as_float


@dataclass(frozen=True)
class FxPnlResolver:
    """Convertit le PnL de chaque trade vers une devise de base."""

    base_currency: str
    rates: dict[str, float]

    def account_currency(self, trade: Any) -> Optional[str]:
        account = getattr(trade, 'trading_account', None)
        if account is None:
            return None
        code = getattr(account, 'currency', None)
        return code.strip().upper() if code else None

    def pnl_decimal(self, trade: Any, pnl_field: str) -> Decimal:
        raw = trade_pnl_as_decimal(trade, pnl_field)
        converted = self._convert_decimal(raw, self.account_currency(trade))
        return converted if converted is not None else raw

    def pnl_float(self, trade: Any, pnl_field: str) -> float:
        return float(self.pnl_decimal(trade, pnl_field))

    def convert_decimal(
        self,
        amount: Decimal | float | int | None,
        from_currency: Optional[str],
    ) -> Optional[Decimal]:
        if amount is None:
            return None
        value = float(amount)
        converted = self._convert_float(value, from_currency)
        if converted is None:
            return None
        return Decimal(str(converted))

    def _convert_decimal(self, amount: Decimal, from_currency: Optional[str]) -> Optional[Decimal]:
        return self.convert_decimal(amount, from_currency)

    def _convert_float(self, amount: float, from_currency: Optional[str]) -> Optional[float]:
        if from_currency is None:
            return None
        frm = from_currency.strip().upper()
        base = self.base_currency
        if frm == base:
            return amount
        converted = convert_amount_to_base(amount, frm, base, self.rates)
        return converted


def resolve_fx_pnl_resolver(request, trades_queryset) -> Optional[FxPnlResolver]:
    """
    Active la conversion si convert_to est fourni, tous comptes (pas de trading_account),
    et au moins deux devises parmi les comptes actifs non archivés du périmètre.
    """
    convert_to = (request.query_params.get('convert_to') or '').strip().upper()
    if not convert_to:
        return None
    if request.query_params.get('trading_account'):
        return None

    currencies: set[str] = set()
    account_ids: set[int] = set()
    for row in (
        trades_queryset.select_related('trading_account')
        .values_list('trading_account_id', 'trading_account__currency')
        .distinct()
    ):
        account_id, currency = row
        if account_id is None or not currency:
            continue
        account_ids.add(account_id)
        currencies.add(currency.strip().upper())

    if len(currencies) <= 1:
        return None

    rates = fetch_latest_rates(convert_to, sorted(currencies))
    if rates is None:
        return None

    return FxPnlResolver(base_currency=convert_to, rates=rates)


def make_pnl_getters(
    resolver: Optional[FxPnlResolver],
    pnl_field: str,
) -> tuple[Callable[[Any], Decimal], Callable[[Any], float]]:
    if resolver is None:
        return (
            lambda trade: trade_pnl_as_decimal(trade, pnl_field),
            lambda trade: trade_pnl_as_float(trade, pnl_field),
        )
    return (
        lambda trade: resolver.pnl_decimal(trade, pnl_field),
        lambda trade: resolver.pnl_float(trade, pnl_field),
    )


def combined_initial_capital_in_base(
    user,
    trading_account_id: Optional[int],
    fx_resolver: FxPnlResolver,
) -> Decimal:
    """Somme des capitaux initiaux actifs convertis en devise de base."""
    from trades.models import TradingAccount  # import local évite cycles

    accounts = TradingAccount.objects.filter(user=user, status='active')  # type: ignore
    if trading_account_id:
        accounts = accounts.filter(id=trading_account_id)
    total = Decimal('0')
    for account in accounts:
        capital = account.initial_capital
        if capital is None:
            continue
        converted = fx_resolver.convert_decimal(capital, account.currency)
        if converted is not None:
            total += converted
    return total


def sum_converted_pnl_for_queryset(
    trades_queryset,
    pnl_decimal_fn: Callable[[Any], Decimal],
) -> Decimal:
    total = Decimal('0')
    for trade in trades_queryset.select_related('trading_account').iterator():
        total += pnl_decimal_fn(trade)
    return total


def aggregate_monetary_from_trades(
    trades_list: list[Any],
    pnl_decimal_fn: Callable[[Any], Decimal],
) -> dict[str, Any]:
    """Agrégations monétaires équivalentes au bloc ORM initial de statistics()."""
    pnls = [pnl_decimal_fn(t) for t in trades_list]
    total_trades = len(pnls)
    winning_pnls = [p for p in pnls if p > 0]
    losing_pnls = [p for p in pnls if p < 0]

    total_gains = sum(winning_pnls, Decimal('0'))
    total_losses = sum(losing_pnls, Decimal('0'))
    total_pnl = sum(pnls, Decimal('0'))

    best_trade = max(winning_pnls) if winning_pnls else Decimal('0')
    worst_trade = min(losing_pnls) if losing_pnls else Decimal('0')

    return {
        'total_trades': total_trades,
        'winning_trades': len(winning_pnls),
        'losing_trades': len(losing_pnls),
        'total_pnl': total_pnl,
        'average_pnl': total_pnl / total_trades if total_trades else Decimal('0'),
        'total_gains': total_gains,
        'total_losses': total_losses,
        'best_trade': best_trade,
        'worst_trade': worst_trade,
    }
