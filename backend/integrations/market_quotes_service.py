"""Cache et normalisation des cours marché TopStepX pour le bandeau dashboard."""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.cache import cache

from integrations.market_quotes_config import MARKET_QUOTE_INSTRUMENTS, ResolvedMarketContract

logger = logging.getLogger(__name__)

CACHE_KEY_SNAPSHOT = 'market_quotes:snapshot'
CACHE_KEY_CONTRACTS = 'market_quotes:contracts'
CACHE_TTL_SNAPSHOT = 120
CACHE_TTL_CONTRACTS = 60 * 60 * 12

_INSTRUMENT_LABELS = {item.key: item.label for item in MARKET_QUOTE_INSTRUMENTS}


def _var_dir() -> Path:
    configured = getattr(settings, 'MARKET_QUOTES_DATA_DIR', None)
    if configured:
        directory = Path(configured)
        try:
            directory.mkdir(parents=True, exist_ok=True)
            probe = directory / '.write_probe'
            probe.write_text('ok', encoding='utf-8')
            probe.unlink(missing_ok=True)
            return directory
        except OSError:
            logger.warning(
                'MARKET_QUOTES_DATA_DIR non accessible en écriture (%s), repli sur /tmp',
                directory,
            )

    candidates = [
        Path(getattr(settings, 'BASE_DIR', Path.cwd())) / 'var',
        Path('/tmp/trading_journal_market_quotes'),
    ]
    for directory in candidates:
        try:
            directory.mkdir(parents=True, exist_ok=True)
            probe = directory / '.write_probe'
            probe.write_text('ok', encoding='utf-8')
            probe.unlink(missing_ok=True)
            return directory
        except OSError:
            continue
    fallback = Path('/tmp/trading_journal_market_quotes')
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def _snapshot_file_path() -> Path:
    configured = getattr(settings, 'MARKET_QUOTES_SNAPSHOT_FILE', None)
    if configured:
        return Path(configured)
    return _var_dir() / 'market_quotes_snapshot.json'


def _contracts_file_path() -> Path:
    configured = getattr(settings, 'MARKET_QUOTES_CONTRACTS_FILE', None)
    if configured:
        return Path(configured)
    return _var_dir() / 'market_quotes_contracts.json'


def _write_json_file(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as handle:
        json.dump(payload, handle)
    os.replace(tmp, path)


def _read_json_file(path: Path) -> Any | None:
    if not path.is_file():
        return None
    try:
        with open(path, encoding='utf-8') as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        logger.warning('Impossible de lire %s', path)
        return None


def _decimal_places_from_tick(tick_size: float) -> int:
    if tick_size <= 0:
        return 2
    tick = Decimal(str(tick_size))
    normalized = tick.normalize()
    exponent = normalized.as_tuple().exponent
    return max(0, -exponent)


def format_price(value: float | None, tick_size: float) -> str | None:
    if value is None:
        return None
    places = _decimal_places_from_tick(tick_size)
    quant = Decimal(str(value)).quantize(
        Decimal(10) ** -places,
        rounding=ROUND_HALF_UP,
    )
    formatted = f'{quant:.{places}f}'
    if '.' in formatted:
        formatted = formatted.rstrip('0').rstrip('.')
    return formatted


def normalize_gateway_quote(
    payload: dict[str, Any],
    *,
    instrument_key: str,
    contract_id: str,
    label: str,
    tick_size: float,
) -> dict[str, Any]:
    last_price = payload.get('lastPrice')
    change = payload.get('change')
    change_percent = payload.get('changePercent')
    timestamp = payload.get('lastUpdated') or payload.get('timestamp')

    try:
        last_f = float(last_price) if last_price is not None else None
    except (TypeError, ValueError):
        last_f = None
    try:
        change_f = float(change) if change is not None else None
    except (TypeError, ValueError):
        change_f = None
    try:
        change_pct_f = float(change_percent) if change_percent is not None else None
    except (TypeError, ValueError):
        change_pct_f = None

    return {
        'key': instrument_key,
        'label': label,
        'contract_id': contract_id,
        'last_price': last_f,
        'last_price_display': format_price(last_f, tick_size),
        'change': change_f,
        'change_percent': change_pct_f,
        'timestamp': str(timestamp) if timestamp else None,
    }


def build_empty_snapshot(*, connected: bool = False, message: str | None = None) -> dict[str, Any]:
    return {
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'connected': connected,
        'message': message,
        'quotes': [
            {
                'key': item.key,
                'label': item.label,
                'contract_id': None,
                'last_price': None,
                'last_price_display': None,
                'change': None,
                'change_percent': None,
                'timestamp': None,
            }
            for item in MARKET_QUOTE_INSTRUMENTS
        ],
    }


def save_contracts_resolved(contracts: list[ResolvedMarketContract]) -> None:
    payload = [
        {
            'key': c.key,
            'label': c.label,
            'contract_id': c.contract_id,
            'symbol_id': c.symbol_id,
            'tick_size': c.tick_size,
            'name': c.name,
        }
        for c in contracts
    ]
    cache.set(CACHE_KEY_CONTRACTS, payload, CACHE_TTL_CONTRACTS)
    _write_json_file(_contracts_file_path(), payload)


def load_contracts_resolved() -> list[ResolvedMarketContract]:
    raw = cache.get(CACHE_KEY_CONTRACTS)
    if not raw:
        raw = _read_json_file(_contracts_file_path())
    if not raw:
        return []
    out: list[ResolvedMarketContract] = []
    for row in raw:
        if not isinstance(row, dict):
            continue
        out.append(
            ResolvedMarketContract(
                key=str(row['key']),
                label=str(row.get('label') or _INSTRUMENT_LABELS.get(str(row['key']), row['key'])),
                contract_id=str(row['contract_id']),
                symbol_id=str(row.get('symbol_id') or ''),
                tick_size=float(row.get('tick_size') or 0.01),
                name=str(row.get('name') or ''),
            )
        )
    return out


def load_snapshot() -> dict[str, Any]:
    raw = cache.get(CACHE_KEY_SNAPSHOT)
    if not raw:
        raw = _read_json_file(_snapshot_file_path())
    if not raw:
        return build_empty_snapshot(connected=False, message='market_quotes_unavailable')
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return build_empty_snapshot(connected=False, message='market_quotes_invalid_cache')
    return raw


def save_snapshot(snapshot: dict[str, Any]) -> None:
    snapshot['updated_at'] = datetime.now(timezone.utc).isoformat()
    cache.set(CACHE_KEY_SNAPSHOT, snapshot, CACHE_TTL_SNAPSHOT)
    _write_json_file(_snapshot_file_path(), snapshot)


def update_quote_in_snapshot(quote: dict[str, Any]) -> None:
    snapshot = load_snapshot()
    quotes = snapshot.get('quotes') or []
    if not quotes:
        snapshot = build_empty_snapshot(connected=True)
        quotes = snapshot['quotes']

    key = quote.get('key')
    updated = False
    for idx, existing in enumerate(quotes):
        if existing.get('key') == key:
            quotes[idx] = {**existing, **quote}
            updated = True
            break
    if not updated:
        quotes.append(quote)

    snapshot['quotes'] = quotes
    snapshot['connected'] = True
    snapshot['message'] = None
    save_snapshot(snapshot)


def get_quotes_credentials() -> tuple[str, str] | None:
    username = getattr(settings, 'TOPSTEPX_QUOTES_USERNAME', '') or ''
    api_key = getattr(settings, 'TOPSTEPX_QUOTES_API_KEY', '') or ''
    if username.strip() and api_key.strip():
        return username.strip(), api_key.strip()
    return None
