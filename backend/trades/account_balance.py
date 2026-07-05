"""
Définitions et calculs centralisés pour le solde d'un compte de trading.

- ``trading_equity`` : capital initial + PnL des trades uniquement (performance de trading).
- ``current_balance`` (solde de trésorerie) : capital initial + PnL + dépôts - retraits.

Ces définitions sont la source de vérité pour l'endpoint ``account-transactions/balance``
et pour la validation des retraits.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING, Any, Dict, Optional, Tuple

from django.db import connection
from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.db.models.functions import Coalesce

from .account_balance_cache import (
    balance_dict_from_denormalized,
    get_cached_balance,
    get_cached_consistency,
    get_cached_peak,
    refresh_trading_account_balance_cache,
    set_cached_balance,
    set_cached_consistency,
    set_cached_peak,
)

if TYPE_CHECKING:
    from .models import TradingAccount


def _peak_balances_sql(
    trading_account: TradingAccount,
    exclude_transaction_id: Optional[int] = None,
) -> Tuple[Decimal, Decimal]:
    """
    Pic net/brut via fenêtre SQL (dépôts/retraits avant trades du jour, ordre intraday).
    """
    from .models import AccountTransaction, TopStepTrade

    initial_capital: Decimal = trading_account.initial_capital or Decimal('0')
    trade_table = TopStepTrade._meta.db_table
    tx_table = AccountTransaction._meta.db_table

    tx_exclude_sql = ''
    params: list[Any] = [initial_capital, trading_account.pk]
    if exclude_transaction_id is not None:
        tx_exclude_sql = 'AND t.id != %s'
        params.append(exclude_transaction_id)
    params.append(trading_account.pk)

    sql = f"""
        WITH initial AS (
            SELECT %s::numeric AS capital
        ),
        tx_events AS (
            SELECT
                DATE(t.transaction_date) AS event_day,
                0 AS sort_kind,
                MIN(t.transaction_date) AS sort_ts,
                0 AS trade_pk,
                SUM(
                    CASE
                        WHEN t.transaction_type = 'deposit' THEN t.amount
                        ELSE -t.amount
                    END
                )::numeric AS delta_net,
                SUM(
                    CASE
                        WHEN t.transaction_type = 'deposit' THEN t.amount
                        ELSE -t.amount
                    END
                )::numeric AS delta_gross
            FROM {tx_table} t
            WHERE t.trading_account_id = %s
            {tx_exclude_sql}
            GROUP BY DATE(t.transaction_date)
        ),
        trade_events AS (
            SELECT
                tr.trade_day AS event_day,
                1 AS sort_kind,
                COALESCE(tr.entered_at, tr.trade_day::timestamp) AS sort_ts,
                tr.id AS trade_pk,
                COALESCE(tr.net_pnl, 0)::numeric AS delta_net,
                COALESCE(tr.pnl, tr.net_pnl, 0)::numeric AS delta_gross
            FROM {trade_table} tr
            WHERE tr.trading_account_id = %s
              AND tr.trade_day IS NOT NULL
        ),
        all_events AS (
            SELECT * FROM tx_events
            UNION ALL
            SELECT * FROM trade_events
        ),
        running AS (
            SELECT
                (SELECT capital FROM initial)
                + SUM(delta_net) OVER (
                    ORDER BY event_day, sort_kind, sort_ts, trade_pk
                    ROWS UNBOUNDED PRECEDING
                ) AS running_net,
                (SELECT capital FROM initial)
                + SUM(delta_gross) OVER (
                    ORDER BY event_day, sort_kind, sort_ts, trade_pk
                    ROWS UNBOUNDED PRECEDING
                ) AS running_gross
            FROM all_events
        )
        SELECT
            GREATEST(
                COALESCE((SELECT MAX(running_net) FROM running), (SELECT capital FROM initial)),
                (SELECT capital FROM initial)
            ) AS peak_net,
            GREATEST(
                COALESCE((SELECT MAX(running_gross) FROM running), (SELECT capital FROM initial)),
                (SELECT capital FROM initial)
            ) AS peak_gross
    """

    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        row = cursor.fetchone()

    if not row:
        return initial_capital, initial_capital
    peak_net = row[0] if row[0] is not None else initial_capital
    peak_gross = row[1] if row[1] is not None else initial_capital
    return Decimal(str(peak_net)), Decimal(str(peak_gross))


def compute_peak_balances(
    trading_account: TradingAccount,
    exclude_transaction_id: Optional[int] = None,
) -> Tuple[Decimal, Decimal]:
    """Plus haut solde atteint (net et brut)."""
    return _peak_balances_sql(trading_account, exclude_transaction_id)


def compute_peak_balance(
    trading_account: TradingAccount,
    exclude_transaction_id: Optional[int] = None,
    *,
    use_gross: bool = False,
) -> Decimal:
    peak_net, peak_gross = compute_peak_balances(trading_account, exclude_transaction_id)
    return peak_gross if use_gross else peak_net


def compute_topstep_best_day(
    trading_account: TradingAccount,
) -> Optional[Dict[str, Any]]:
    """Meilleur jour all-time (agrégats journaliers SQL) pour le consistency target."""
    if trading_account.account_type != 'topstep':
        return None

    from .models import TopStepTrade

    _pnl_money = DecimalField(max_digits=18, decimal_places=9)
    _zero_pnl = Value(Decimal('0'), output_field=_pnl_money)
    gross_expr = Coalesce(F('pnl'), F('net_pnl'), _zero_pnl, output_field=_pnl_money)

    rows = (
        trading_account.topstep_trades.filter(trade_day__isnull=False)
        .values('trade_day')
        .annotate(
            day_pnl_net=Sum('net_pnl'),
            day_pnl_gross=Sum(gross_expr),
        )
        .order_by('-day_pnl_net')
    )
    best = rows.first()
    if not best or not best['day_pnl_net'] or best['day_pnl_net'] <= 0:
        return None

    return {
        'best_day': best['trade_day'],
        'best_day_pnl_net': best['day_pnl_net'] or Decimal('0'),
        'best_day_pnl_gross': best['day_pnl_gross'] or best['day_pnl_net'] or Decimal('0'),
    }


def _balance_before_calendar_date_sql(
    trading_account: TradingAccount,
    before_date: date,
) -> Tuple[Decimal, Decimal]:
    """
    Solde de trésorerie juste avant ``before_date`` (événements des jours strictement antérieurs).
    Applique tx avant trades pour chaque journée (aligné sur le pic SQL).
    """
    from .models import AccountTransaction, TopStepTrade

    initial_capital: Decimal = trading_account.initial_capital or Decimal('0')
    trade_table = TopStepTrade._meta.db_table
    tx_table = AccountTransaction._meta.db_table

    sql = f"""
        WITH initial AS (
            SELECT %s::numeric AS capital
        ),
        tx_events AS (
            SELECT
                DATE(t.transaction_date) AS event_day,
                0 AS sort_kind,
                MIN(t.transaction_date) AS sort_ts,
                0 AS trade_pk,
                SUM(
                    CASE
                        WHEN t.transaction_type = 'deposit' THEN t.amount
                        ELSE -t.amount
                    END
                )::numeric AS delta_net,
                SUM(
                    CASE
                        WHEN t.transaction_type = 'deposit' THEN t.amount
                        ELSE -t.amount
                    END
                )::numeric AS delta_gross
            FROM {tx_table} t
            WHERE t.trading_account_id = %s
            GROUP BY DATE(t.transaction_date)
        ),
        trade_events AS (
            SELECT
                tr.trade_day AS event_day,
                1 AS sort_kind,
                COALESCE(tr.entered_at, tr.trade_day::timestamp) AS sort_ts,
                tr.id AS trade_pk,
                COALESCE(tr.net_pnl, 0)::numeric AS delta_net,
                COALESCE(tr.pnl, tr.net_pnl, 0)::numeric AS delta_gross
            FROM {trade_table} tr
            WHERE tr.trading_account_id = %s
              AND tr.trade_day IS NOT NULL
        ),
        all_events AS (
            SELECT * FROM tx_events
            UNION ALL
            SELECT * FROM trade_events
        ),
        filtered AS (
            SELECT * FROM all_events WHERE event_day < %s
        ),
        running AS (
            SELECT
                event_day,
                sort_kind,
                sort_ts,
                trade_pk,
                (SELECT capital FROM initial)
                + SUM(delta_net) OVER (
                    ORDER BY event_day, sort_kind, sort_ts, trade_pk
                    ROWS UNBOUNDED PRECEDING
                ) AS running_net,
                (SELECT capital FROM initial)
                + SUM(delta_gross) OVER (
                    ORDER BY event_day, sort_kind, sort_ts, trade_pk
                    ROWS UNBOUNDED PRECEDING
                ) AS running_gross
            FROM filtered
        ),
        last_balance AS (
            SELECT running_net, running_gross
            FROM running
            ORDER BY event_day DESC, sort_kind DESC, sort_ts DESC, trade_pk DESC
            LIMIT 1
        )
        SELECT
            COALESCE(
                (SELECT running_net FROM last_balance),
                (SELECT capital FROM initial)
            ) AS balance_net,
            COALESCE(
                (SELECT running_gross FROM last_balance),
                (SELECT capital FROM initial)
            ) AS balance_gross
    """
    params = [
        initial_capital,
        trading_account.pk,
        trading_account.pk,
        before_date,
    ]
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        row = cursor.fetchone()

    if not row:
        return initial_capital, initial_capital
    balance_net = row[0] if row[0] is not None else initial_capital
    balance_gross = row[1] if row[1] is not None else initial_capital
    return Decimal(str(balance_net)), Decimal(str(balance_gross))


def compute_balance_at_period_start(
    trading_account: TradingAccount,
    start_date: Optional[date],
    *,
    use_gross: bool = False,
) -> Decimal:
    """
    Solde réel au début de ``start_date`` (capital + PnL + flux strictement avant ce jour).
    Sans ``start_date`` : retourne le capital initial effectif.
    """
    initial_capital: Decimal = trading_account.initial_capital or Decimal('0')
    if start_date is None:
        return initial_capital

    balance_net, balance_gross = _balance_before_calendar_date_sql(
        trading_account,
        start_date,
    )
    return balance_gross if use_gross else balance_net


def build_dashboard_balance_context(
    trading_account: TradingAccount,
    start_date: Optional[date],
) -> Dict[str, Any]:
    """Contexte de solde pour le graphique dashboard (compte unique)."""
    initial_capital: Decimal = trading_account.initial_capital or Decimal('0')
    opening_net = compute_balance_at_period_start(trading_account, start_date, use_gross=False)
    opening_gross = compute_balance_at_period_start(trading_account, start_date, use_gross=True)

    bal = resolve_account_balance(trading_account, include_peak=False, use_cache=True)

    profit_target_absolute: Optional[Decimal] = None
    if (
        trading_account.profit_target_enabled
        and trading_account.profit_target is not None
    ):
        profit_target_absolute = initial_capital + Decimal(str(trading_account.profit_target))

    mll_configured = bool(
        trading_account.mll_enabled is not False
        and trading_account.maximum_loss_limit is not None
    )

    return {
        'initial_capital': str(initial_capital),
        'opening_balance': str(opening_net),
        'opening_balance_gross': str(opening_gross),
        'current_balance': str(bal['current_balance']),
        'current_balance_gross': str(bal.get('current_balance_gross', bal['current_balance'])),
        'profit_target_absolute': (
            str(profit_target_absolute) if profit_target_absolute is not None else None
        ),
        'mll_configured': mll_configured,
    }


def compute_trading_account_balance(
    trading_account: TradingAccount,
    exclude_transaction_id: Optional[int] = None,
    *,
    include_peak: bool = True,
) -> Dict[str, Any]:
    """
    Calcule les agrégats de solde pour un compte.

    Si ``exclude_transaction_id`` est fourni, la transaction correspondante est exclue
    du calcul des flux (utile pour valider une création/mise à jour sans effet de bord).

    Si ``include_peak`` est False, seuls les agrégats SQL sont calculés (réponse rapide).
    """
    initial_capital: Decimal = trading_account.initial_capital or Decimal('0')

    trades_qs = trading_account.topstep_trades.all()
    _pnl_money = DecimalField(max_digits=18, decimal_places=9)
    _zero_pnl = Value(Decimal('0'), output_field=_pnl_money)
    gross_expr = Coalesce(F('pnl'), F('net_pnl'), _zero_pnl, output_field=_pnl_money)

    trade_agg = trades_qs.aggregate(
        total_pnl=Sum('net_pnl'),
        total_pnl_gross=Sum(gross_expr),
    )
    total_pnl = trade_agg['total_pnl'] or Decimal('0')
    total_pnl_gross = trade_agg['total_pnl_gross'] or Decimal('0')

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

    result: Dict[str, Any] = {
        'initial_capital': initial_capital,
        'total_pnl': total_pnl,
        'total_pnl_gross': total_pnl_gross,
        'trading_equity': initial_capital + total_pnl,
        'trading_equity_gross': initial_capital + total_pnl_gross,
        'total_deposits': total_deposits,
        'total_withdrawals': total_withdrawals,
        'net_transactions': net_transactions,
        'current_balance': current_balance,
        'current_balance_gross': current_balance_gross,
    }

    if include_peak:
        peak_balance, peak_balance_gross = compute_peak_balances(
            trading_account, exclude_transaction_id
        )
        result['peak_balance'] = peak_balance
        result['peak_balance_gross'] = peak_balance_gross

    return result


def resolve_account_balance(
    trading_account: TradingAccount,
    *,
    include_peak: bool = True,
    exclude_transaction_id: Optional[int] = None,
    use_cache: bool = True,
    use_denormalized: bool = True,
) -> Dict[str, Any]:
    """
    Point d'entrée API : cache Redis, champs dénormalisés, puis calcul complet.
    """
    if exclude_transaction_id is not None:
        return compute_trading_account_balance(
            trading_account,
            exclude_transaction_id,
            include_peak=include_peak,
        )

    account_id = trading_account.pk
    if use_cache:
        cached = get_cached_balance(account_id, include_peak=include_peak)
        if cached is not None:
            return cached

    if use_denormalized and include_peak:
        denorm = balance_dict_from_denormalized(trading_account)
        if denorm is not None and 'peak_balance' in denorm:
            if use_cache:
                set_cached_balance(account_id, include_peak=True, payload=denorm)
            return denorm

    if use_denormalized and not include_peak:
        denorm = balance_dict_from_denormalized(trading_account)
        if denorm is not None:
            slim = {k: v for k, v in denorm.items() if not k.startswith('peak_')}
            if use_cache:
                set_cached_balance(account_id, include_peak=False, payload=slim)
            return slim

    bal = compute_trading_account_balance(trading_account, include_peak=include_peak)
    if include_peak:
        consistency = compute_topstep_best_day(trading_account)
        refresh_trading_account_balance_cache(trading_account, bal, consistency)
        if use_cache:
            set_cached_balance(account_id, include_peak=True, payload=bal)
            set_cached_peak(
                account_id,
                {
                    'peak_balance': bal['peak_balance'],
                    'peak_balance_gross': bal['peak_balance_gross'],
                },
            )
            if consistency:
                set_cached_consistency(account_id, consistency)
    elif use_cache:
        set_cached_balance(account_id, include_peak=False, payload=bal)
    return bal


def resolve_peak_balance_only(
    trading_account: TradingAccount,
    *,
    use_cache: bool = True,
) -> Dict[str, Decimal]:
    """Calcule uniquement le pic (endpoint dédié, sans refaire les agrégats de solde)."""
    account_id = trading_account.pk
    if use_cache:
        cached = get_cached_peak(account_id)
        if cached is not None:
            return {
                'peak_balance': Decimal(str(cached['peak_balance'])),
                'peak_balance_gross': Decimal(str(cached['peak_balance_gross'])),
            }

    if trading_account.cached_peak_balance is not None and trading_account.balance_computed_at:
        peaks = {
            'peak_balance': trading_account.cached_peak_balance,
            'peak_balance_gross': (
                trading_account.cached_peak_balance_gross or trading_account.cached_peak_balance
            ),
        }
        if use_cache:
            set_cached_peak(account_id, peaks)
        return peaks

    peak_balance, peak_balance_gross = compute_peak_balances(trading_account)
    peaks = {'peak_balance': peak_balance, 'peak_balance_gross': peak_balance_gross}
    if use_cache:
        set_cached_peak(account_id, peaks)
    return peaks


def resolve_topstep_consistency(
    trading_account: TradingAccount,
    *,
    use_cache: bool = True,
) -> Optional[Dict[str, Any]]:
    """Meilleur jour all-time pour le consistency target TopStep."""
    if trading_account.account_type != 'topstep':
        return None

    account_id = trading_account.pk
    if use_cache:
        cached = get_cached_consistency(account_id)
        if cached is not None:
            return cached

    if (
        trading_account.cached_best_day is not None
        and trading_account.cached_best_day_pnl_net is not None
        and trading_account.balance_computed_at
    ):
        data = {
            'best_day': trading_account.cached_best_day,
            'best_day_pnl_net': trading_account.cached_best_day_pnl_net,
            'best_day_pnl_gross': (
                trading_account.cached_best_day_pnl_gross
                or trading_account.cached_best_day_pnl_net
            ),
        }
        if use_cache:
            set_cached_consistency(account_id, data)
        return data

    data = compute_topstep_best_day(trading_account)
    if data and use_cache:
        set_cached_consistency(account_id, data)
    return data


def refresh_trading_account_balance_after_mutation(trading_account_id: int) -> None:
    """Recalcule et persiste les soldes après mutation trade/transaction."""
    from .account_balance_cache import invalidate_account_balance_cache
    from .models import TradingAccount

    invalidate_account_balance_cache(trading_account_id)
    try:
        account = TradingAccount.objects.get(pk=trading_account_id)
    except TradingAccount.DoesNotExist:
        return

    full_bal = compute_trading_account_balance(account, include_peak=True)
    consistency = compute_topstep_best_day(account)
    refresh_trading_account_balance_cache(account, full_bal, consistency)
    set_cached_balance(trading_account_id, include_peak=True, payload=full_bal)
    set_cached_balance(
        trading_account_id,
        include_peak=False,
        payload={k: v for k, v in full_bal.items() if not str(k).startswith('peak_')},
    )
    set_cached_peak(
        trading_account_id,
        {
            'peak_balance': full_bal['peak_balance'],
            'peak_balance_gross': full_bal['peak_balance_gross'],
        },
    )
    if consistency:
        set_cached_consistency(trading_account_id, consistency)


def aggregate_daily_net_transactions(
    user,
    *,
    trading_account_id=None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    timezone_str: Optional[str] = None,
) -> list[Dict[str, str]]:
    """
    Agrège les dépôts/retraits par jour calendaire (fuseau utilisateur).
    deposit = +amount, withdrawal = -amount (aligné frontend DashboardPage).
    """
    import pytz
    from datetime import datetime

    from .models import AccountTransaction

    user_timezone = timezone_str or getattr(
        getattr(user, 'preferences', None), 'timezone', None
    )
    try:
        user_tz = pytz.timezone(user_timezone) if user_timezone else pytz.timezone('Europe/Paris')
    except pytz.exceptions.UnknownTimeZoneError:
        user_tz = pytz.timezone('Europe/Paris')

    qs = AccountTransaction.objects.filter(user=user)  # type: ignore
    if trading_account_id is not None:
        qs = qs.filter(trading_account_id=trading_account_id)

    if start_date:
        try:
            start_dt = user_tz.localize(datetime.strptime(start_date, '%Y-%m-%d'))
            qs = qs.filter(transaction_date__gte=start_dt)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = user_tz.localize(
                datetime.strptime(end_date, '%Y-%m-%d').replace(
                    hour=23, minute=59, second=59
                )
            )
            qs = qs.filter(transaction_date__lte=end_dt)
        except ValueError:
            pass

    from django.db.models.functions import TruncDate

    signed = Case(
        When(transaction_type='deposit', then=F('amount')),
        default=-F('amount'),
        output_field=DecimalField(max_digits=20, decimal_places=8),
    )
    rows = (
        qs.annotate(calendar_day=TruncDate('transaction_date', tzinfo=user_tz))
        .values('calendar_day')
        .annotate(net_transactions=Sum(signed))
        .order_by('calendar_day')
    )
    return [
        {
            'date': row['calendar_day'].isoformat(),
            'net_transactions': str(row['net_transactions'] or Decimal('0')),
        }
        for row in rows
        if row['calendar_day']
    ]
