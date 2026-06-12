"""Construction automatique des sessions replay après import de trades."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Iterable

import pytz

from billing.permissions import user_has_premium_access
from integrations.topstepx_auth import get_topstepx_integration
from trades.models import TradingAccount

logger = logging.getLogger(__name__)

MAX_AUTO_REPLAY_BUILD_DAYS = 31


@dataclass
class ReplayAutoBuildSummary:
    built: int = 0
    failed: int = 0
    skipped_cap: int = 0
    built_dates: list[str] = field(default_factory=list)
    failed_dates: list[str] = field(default_factory=list)


def user_timezone_name(user) -> str:
    user_timezone = getattr(getattr(user, 'preferences', None), 'timezone', None)
    if user_timezone:
        try:
            pytz.timezone(user_timezone)
            return str(user_timezone)
        except pytz.exceptions.UnknownTimeZoneError:
            pass
    return 'Europe/Paris'


def build_replay_for_new_trade_days(
    user,
    trading_account: TradingAccount,
    trade_days: Iterable[date],
    *,
    tz_name: str | None = None,
) -> ReplayAutoBuildSummary:
    """
    Construit les sessions replay pour les jours où de nouveaux trades ont été importés.

    Les erreurs sur un jour donné n'interrompent pas la sync ni les autres builds.
    """
    summary = ReplayAutoBuildSummary()
    unique_days = sorted({d for d in trade_days if d}, reverse=True)
    if not unique_days:
        return summary

    if not user_has_premium_access(user):
        return summary

    if trading_account.account_type != 'topstep':
        return summary

    integration = get_topstepx_integration(user)
    if integration is None or not integration.secrets_encrypted:
        return summary

    if tz_name is None:
        tz_name = user_timezone_name(user)

    days_to_build = unique_days[:MAX_AUTO_REPLAY_BUILD_DAYS]
    if len(unique_days) > MAX_AUTO_REPLAY_BUILD_DAYS:
        summary.skipped_cap = len(unique_days) - MAX_AUTO_REPLAY_BUILD_DAYS
        logger.warning(
            'Replay auto-build: %d jours tronqués (plafond %d) pour compte %s',
            summary.skipped_cap,
            MAX_AUTO_REPLAY_BUILD_DAYS,
            trading_account.pk,
        )

    from .session_builder import SessionReplayBuilder

    builder = SessionReplayBuilder()
    for session_date in days_to_build:
        try:
            builder.build(user, trading_account, session_date, tz_name=tz_name)
            summary.built += 1
            summary.built_dates.append(session_date.isoformat())
        except ValueError as exc:
            summary.failed += 1
            summary.failed_dates.append(session_date.isoformat())
            logger.warning(
                'Replay auto-build échoué pour compte %s date %s: %s',
                trading_account.pk,
                session_date,
                exc,
            )

    return summary
