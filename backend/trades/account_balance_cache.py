"""Cache Redis et champs dénormalisés pour les soldes de compte."""
from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Optional

from django.core.cache import cache
from django.utils import timezone

CACHE_TTL_SECONDS = 300
CACHE_KEY_FAST = 'bal:{account_id}:fast'
CACHE_KEY_FULL = 'bal:{account_id}:full'
CACHE_KEY_PEAK = 'bal:{account_id}:peak'
CACHE_KEY_CONSISTENCY = 'bal:{account_id}:consistency'


def _cache_key(template: str, account_id: int) -> str:
    return template.format(account_id=account_id)


def invalidate_account_balance_cache(account_id: int) -> None:
    cache.delete_many([
        _cache_key(CACHE_KEY_FAST, account_id),
        _cache_key(CACHE_KEY_FULL, account_id),
        _cache_key(CACHE_KEY_PEAK, account_id),
        _cache_key(CACHE_KEY_CONSISTENCY, account_id),
    ])


def get_cached_balance(account_id: int, *, include_peak: bool) -> Optional[Dict[str, Any]]:
    key = _cache_key(CACHE_KEY_FULL if include_peak else CACHE_KEY_FAST, account_id)
    result = cache.get(key)
    return result if isinstance(result, dict) else None


def get_cached_peak(account_id: int) -> Optional[Dict[str, Any]]:
    result = cache.get(_cache_key(CACHE_KEY_PEAK, account_id))
    return result if isinstance(result, dict) else None


def get_cached_consistency(account_id: int) -> Optional[Dict[str, Any]]:
    result = cache.get(_cache_key(CACHE_KEY_CONSISTENCY, account_id))
    return result if isinstance(result, dict) else None


def set_cached_balance(account_id: int, *, include_peak: bool, payload: Dict[str, Any]) -> None:
    key = _cache_key(CACHE_KEY_FULL if include_peak else CACHE_KEY_FAST, account_id)
    cache.set(key, payload, CACHE_TTL_SECONDS)


def set_cached_peak(account_id: int, payload: Dict[str, Any]) -> None:
    cache.set(_cache_key(CACHE_KEY_PEAK, account_id), payload, CACHE_TTL_SECONDS)


def set_cached_consistency(account_id: int, payload: Dict[str, Any]) -> None:
    cache.set(_cache_key(CACHE_KEY_CONSISTENCY, account_id), payload, CACHE_TTL_SECONDS)


def _decimal_to_str(value: Optional[Decimal]) -> Optional[str]:
    if value is None:
        return None
    return str(value)


def balance_dict_from_denormalized(account) -> Optional[Dict[str, Any]]:
    """Construit le dict balance depuis les champs cached_* si disponibles."""
    if account.balance_computed_at is None:
        return None
    if account.cached_current_balance is None:
        return None

    initial = account.initial_capital or Decimal('0')
    total_pnl = (account.cached_current_balance or Decimal('0')) - initial - (account.cached_net_transactions or Decimal('0'))
    total_pnl_gross = None
    if account.cached_current_balance_gross is not None and account.cached_net_transactions is not None:
        total_pnl_gross = account.cached_current_balance_gross - initial - account.cached_net_transactions

    result: Dict[str, Any] = {
        'initial_capital': initial,
        'total_pnl': total_pnl,
        'total_pnl_gross': total_pnl_gross or total_pnl,
        'trading_equity': initial + total_pnl,
        'trading_equity_gross': initial + (total_pnl_gross or total_pnl),
        'total_deposits': account.cached_total_deposits or Decimal('0'),
        'total_withdrawals': account.cached_total_withdrawals or Decimal('0'),
        'net_transactions': account.cached_net_transactions or Decimal('0'),
        'current_balance': account.cached_current_balance,
        'current_balance_gross': account.cached_current_balance_gross or account.cached_current_balance,
    }
    if account.cached_peak_balance is not None:
        result['peak_balance'] = account.cached_peak_balance
        result['peak_balance_gross'] = (
            account.cached_peak_balance_gross or account.cached_peak_balance
        )
    return result


def refresh_trading_account_balance_cache(account, bal: Dict[str, Any], consistency: Optional[Dict[str, Any]] = None) -> None:
    """Persiste les agrégats calculés sur TradingAccount."""
    from .models import TradingAccount

    update_fields = {
        'cached_current_balance': bal['current_balance'],
        'cached_current_balance_gross': bal.get('current_balance_gross', bal['current_balance']),
        'cached_peak_balance': bal.get('peak_balance'),
        'cached_peak_balance_gross': bal.get('peak_balance_gross'),
        'cached_total_deposits': bal.get('total_deposits'),
        'cached_total_withdrawals': bal.get('total_withdrawals'),
        'cached_net_transactions': bal.get('net_transactions'),
        'balance_computed_at': timezone.now(),
    }
    if consistency:
        update_fields['cached_best_day'] = consistency.get('best_day')
        update_fields['cached_best_day_pnl_net'] = consistency.get('best_day_pnl_net')
        update_fields['cached_best_day_pnl_gross'] = consistency.get('best_day_pnl_gross')

    TradingAccount.objects.filter(pk=account.pk).update(**update_fields)
