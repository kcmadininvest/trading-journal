"""
Vide en base les champs screenshot qui pointent vers des fichiers absents du disque
(chemins /media/screenshots/... ou URLs signées protected-screenshot valides pour l'utilisateur).

Complémentaire de cleanup_orphan_screenshots (qui supprime les fichiers non référencés).

Usage:
    python manage.py clear_missing_screenshot_db_refs [--dry-run] [--user-id N]
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from trades.image_processor import image_processor
from trades.models import DayStrategyCompliance, PositionStrategy, TradeStrategy
from trades.protected_screenshot_urls import resolve_screenshot_url_for_delete


def _should_clear_stored_url(url: str, owner_user_id: int) -> bool:
    if not (url or '').strip():
        return False
    canonical = resolve_screenshot_url_for_delete(url.strip(), int(owner_user_id))
    if not canonical:
        return False
    return not image_processor.canonical_screenshot_has_any_file(canonical)


class Command(BaseCommand):
    help = (
        'Met à blanc les références screenshot en base lorsque les fichiers media '
        'correspondants sont introuvables sous MEDIA_ROOT.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les enregistrements concernés sans les modifier.',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Limiter le traitement à un utilisateur (user_id).',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_id = options.get('user_id')

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Références screenshot → fichiers manquants'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        if dry_run:
            self.stdout.write(self.style.WARNING('Mode DRY-RUN : aucune écriture en base.'))

        n_trade = 0
        n_day = 0
        n_pos_fields = 0

        def log_clear(model: str, pk: int, field: str, url_preview: str) -> None:
            tail = url_preview if len(url_preview) <= 100 else url_preview[:100] + '…'
            self.stdout.write(f'  - {model} id={pk} champ={field} url={tail}')

        # TradeStrategy
        ts_qs = TradeStrategy.objects.exclude(screenshot_url='')
        if user_id is not None:
            ts_qs = ts_qs.filter(user_id=user_id)
        for ts in ts_qs.iterator():
            if _should_clear_stored_url(ts.screenshot_url, ts.user_id):
                log_clear('TradeStrategy', ts.pk, 'screenshot_url', ts.screenshot_url)
                n_trade += 1
                if not dry_run:
                    TradeStrategy.objects.filter(pk=ts.pk).update(screenshot_url='')

        # DayStrategyCompliance
        day_qs = DayStrategyCompliance.objects.exclude(screenshot_url='')
        if user_id is not None:
            day_qs = day_qs.filter(user_id=user_id)
        for row in day_qs.iterator():
            if _should_clear_stored_url(row.screenshot_url, row.user_id):
                log_clear('DayStrategyCompliance', row.pk, 'screenshot_url', row.screenshot_url)
                n_day += 1
                if not dry_run:
                    DayStrategyCompliance.objects.filter(pk=row.pk).update(screenshot_url='')

        # PositionStrategy (example_screenshot + thumbnail)
        ps_qs = PositionStrategy.objects.all()
        if user_id is not None:
            ps_qs = ps_qs.filter(user_id=user_id)
        for ps in ps_qs.iterator():
            updates: dict[str, str] = {}
            for field in ('example_screenshot', 'example_screenshot_thumbnail'):
                raw = getattr(ps, field, '') or ''
                if not raw.strip():
                    continue
                if _should_clear_stored_url(raw, ps.user_id):
                    log_clear('PositionStrategy', ps.pk, field, raw)
                    n_pos_fields += 1
                    updates[field] = ''
            if updates and not dry_run:
                PositionStrategy.objects.filter(pk=ps.pk).update(**updates)

        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(
            self.style.SUCCESS(
                f'Résumé : TradeStrategy={n_trade}, DayStrategyCompliance={n_day}, '
                f'champs PositionStrategy={n_pos_fields}'
            )
        )
        self.stdout.write('=' * 70)
