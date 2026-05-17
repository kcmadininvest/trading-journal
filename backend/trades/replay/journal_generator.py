"""Génération du brouillon de journal quotidien depuis une session."""
from __future__ import annotations

from decimal import Decimal

from trades.models import SessionEvent, SessionInsight, TradingSession


def generate_journal_draft(
    session: TradingSession,
    events: list[SessionEvent],
    insights: list[SessionInsight],
) -> str:
    lines: list[str] = [
        f'# Session du {session.session_date}',
        '',
        f'**Compte** : {session.trading_account.name}',  # type: ignore
        f'**Trades fermés** : {session.trade_count}',
    ]
    if session.net_pnl is not None:
        lines.append(f'**PnL net session** : {session.net_pnl}')
    if session.max_drawdown_intraday is not None:
        lines.append(f'**Drawdown intraday max** : {session.max_drawdown_intraday}')
    lines.append(f'**Événements** : {len(events)}')
    lines.append('')

    closes = [e for e in events if e.event_type == 'position_close']
    if closes:
        pnls: list[Decimal] = []
        for c in closes:
            raw = (c.payload or {}).get('pnl')
            if raw is not None:
                try:
                    pnls.append(Decimal(str(raw)))
                except Exception:
                    pass
        if pnls:
            best = max(pnls)
            worst = min(pnls)
            lines.extend([
                '## Trades',
                f'- Meilleur trade : {best}',
                f'- Pire trade : {worst}',
                '',
            ])

    if insights:
        lines.append('## Points d\'attention')
        for ins in insights:
            lines.append(f'- [{ins.severity.upper()}] {ins.message}')
        lines.append('')

    lines.append('## Chronologie (résumé)')
    for evt in events:
        if evt.event_type in ('position_open', 'position_close', 'order_created'):
            label = evt.get_event_type_display()  # type: ignore
            ts = evt.occurred_at.strftime('%H:%M:%S')
            contract = (evt.payload or {}).get('contract_name', '')
            lines.append(f'- {ts} — {label}' + (f' ({contract})' if contract else ''))

    lines.append('')
    lines.append('_Généré automatiquement par le replay de session._')
    return '\n'.join(lines)
