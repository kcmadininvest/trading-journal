"""
Commande de gestion Django pour nettoyer les fichiers screenshots orphelins.

Un fichier sous MEDIA_ROOT/screenshots/ est considéré comme orphelin s'il n'est
référencé par aucun des champs suivants (original ou miniature) :
- TradeStrategy.screenshot_url
- DayStrategyCompliance.screenshot_url
- PositionStrategy.example_screenshot / example_screenshot_thumbnail
- ManualBacktestObservation.screenshot_before_url / screenshot_after_url

Les fichiers modifiés depuis moins de --min-age-days jours sont ignorés : ils
peuvent appartenir à un brouillon (localStorage) ou à une modale encore ouverte.

Le dossier daily_journal/ n'est pas concerné.

Usage:
    python manage.py cleanup_orphan_screenshots [--dry-run] [--user-id USER_ID] [--min-age-days N]
"""

import time
from pathlib import Path
from typing import Optional, Set
from urllib.parse import parse_qs, urlparse

from django.conf import settings
from django.core import signing
from django.core.management.base import BaseCommand

from backtest_journal.models import ManualBacktestObservation
from trades.models import DayStrategyCompliance, PositionStrategy, TradeStrategy
from trades.protected_screenshot_urls import SIGN_SALT, _relative_under_media_from_url

DEFAULT_MIN_AGE_DAYS = 7


def _relative_path_from_stored_value(value: str) -> Optional[str]:
    """Chemin relatif à MEDIA_ROOT (ex. screenshots/1/2026/03/x.webp) ou None."""
    if not value or not isinstance(value, str):
        return None
    raw = value.strip()
    if not raw:
        return None

    parsed = urlparse(raw)
    if 'protected-screenshot' in (parsed.path or '') and parsed.query:
        token = (parse_qs(parsed.query).get('s') or [None])[0]
        if not token:
            return None
        try:
            # Sans max_age : un jeton expiré en base doit quand même protéger le fichier.
            payload = signing.loads(token, salt=SIGN_SALT)
        except signing.BadSignature:
            return None
        rel = payload.get('r')
        return str(rel).lstrip('/') if rel else None

    if raw.startswith('screenshots/'):
        return raw.split('?', 1)[0]

    return _relative_under_media_from_url(raw)


def _with_thumbnail_pair(rel: str) -> Set[str]:
    paths = {rel}
    if rel.endswith('_thumb.webp'):
        paths.add(rel[: -len('_thumb.webp')] + '.webp')
    elif rel.endswith('.webp'):
        paths.add(rel[: -len('.webp')] + '_thumb.webp')
    return paths


def collect_referenced_screenshot_paths() -> Set[str]:
    querysets = [
        TradeStrategy.objects.exclude(screenshot_url='').values_list('screenshot_url', flat=True),
        DayStrategyCompliance.objects.exclude(screenshot_url='').values_list('screenshot_url', flat=True),
        PositionStrategy.objects.exclude(example_screenshot='').values_list('example_screenshot', flat=True),
        PositionStrategy.objects.exclude(example_screenshot_thumbnail='').values_list(
            'example_screenshot_thumbnail', flat=True
        ),
        ManualBacktestObservation.objects.exclude(screenshot_before_url='').values_list(
            'screenshot_before_url', flat=True
        ),
        ManualBacktestObservation.objects.exclude(screenshot_after_url='').values_list(
            'screenshot_after_url', flat=True
        ),
    ]

    referenced: Set[str] = set()
    for qs in querysets:
        for value in qs.iterator():
            rel = _relative_path_from_stored_value(value)
            if rel and rel.startswith('screenshots/'):
                referenced |= _with_thumbnail_pair(rel)
    return referenced


class Command(BaseCommand):
    help = 'Nettoie les fichiers screenshots orphelins (non référencés en base de données)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche les fichiers qui seraient supprimés sans les supprimer réellement',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Nettoie uniquement les fichiers d\'un utilisateur spécifique',
        )
        parser.add_argument(
            '--min-age-days',
            type=float,
            default=DEFAULT_MIN_AGE_DAYS,
            help=(
                'Ignore les fichiers modifiés depuis moins de N jours '
                f'(défaut : {DEFAULT_MIN_AGE_DAYS}, durée de validité des liens signés)'
            ),
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        user_id = options.get('user_id')
        min_age_days = max(0.0, float(options.get('min_age_days') or 0))
        cutoff_ts = time.time() - min_age_days * 86400

        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Nettoyage des screenshots orphelins'))
        self.stdout.write(self.style.SUCCESS('=' * 70))

        if dry_run:
            self.stdout.write(self.style.WARNING('Mode DRY-RUN : Aucun fichier ne sera supprimé'))

        self.stdout.write('\nRécupération des screenshots référencés en base de données...')
        referenced_paths = collect_referenced_screenshot_paths()
        self.stdout.write(f'{len(referenced_paths)} fichiers référencés en base de données')
        self.stdout.write(f'Délai de grâce : fichiers de moins de {min_age_days:g} jour(s) ignorés')

        media_root = Path(settings.MEDIA_ROOT)
        screenshots_dir = media_root / 'screenshots'

        if not screenshots_dir.exists():
            self.stdout.write(self.style.WARNING(f'\nLe dossier {screenshots_dir} n\'existe pas'))
            return

        self.stdout.write(f'\nScan du dossier : {screenshots_dir}')

        if user_id:
            user_dir = screenshots_dir / str(user_id)
            if not user_dir.exists():
                self.stdout.write(self.style.WARNING(f'\nLe dossier utilisateur {user_dir} n\'existe pas'))
                return
            scan_dirs = [user_dir]
            self.stdout.write(f'   Filtrage par utilisateur : {user_id}')
        else:
            scan_dirs = [screenshots_dir]

        orphan_files = []
        total_size = 0
        skipped_recent = 0

        for scan_dir in scan_dirs:
            for file_path in scan_dir.rglob('*.webp'):
                relative_path = file_path.relative_to(media_root).as_posix()
                if relative_path in referenced_paths:
                    continue
                stat = file_path.stat()
                if stat.st_mtime > cutoff_ts:
                    skipped_recent += 1
                    continue
                orphan_files.append(file_path)
                total_size += stat.st_size

        self.stdout.write('\n' + '=' * 70)
        self.stdout.write('Résultats du scan :')
        self.stdout.write(f'   Fichiers orphelins trouvés : {len(orphan_files)}')
        self.stdout.write(f'   Fichiers non référencés récents ignorés : {skipped_recent}')
        self.stdout.write(f'   Espace disque récupérable : {total_size / (1024 * 1024):.2f} MB')
        self.stdout.write('=' * 70)

        if not orphan_files:
            self.stdout.write(self.style.SUCCESS('\nAucun fichier orphelin trouvé !'))
            return

        self.stdout.write('\nFichiers orphelins :')
        for i, file_path in enumerate(orphan_files[:20], 1):
            size_kb = file_path.stat().st_size / 1024
            self.stdout.write(f'   {i}. {file_path.name} ({size_kb:.1f} KB)')

        if len(orphan_files) > 20:
            self.stdout.write(f'   ... et {len(orphan_files) - 20} autres fichiers')

        if dry_run:
            self.stdout.write(self.style.WARNING('\nMode DRY-RUN : Aucun fichier n\'a été supprimé'))
            self.stdout.write(self.style.WARNING('   Exécutez sans --dry-run pour supprimer réellement les fichiers'))
        else:
            self.stdout.write('\nSuppression des fichiers orphelins...')
            deleted_count = 0
            for file_path in orphan_files:
                try:
                    file_path.unlink()
                    deleted_count += 1
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'   Erreur lors de la suppression de {file_path.name}: {e}')
                    )
            self.stdout.write(self.style.SUCCESS(f'\n{deleted_count} fichiers supprimés avec succès !'))
            self.stdout.write(self.style.SUCCESS(f'Espace disque récupéré : {total_size / (1024 * 1024):.2f} MB'))

        self.stdout.write('\n' + '=' * 70)
        self.stdout.write(self.style.SUCCESS('Nettoyage terminé !'))
        self.stdout.write('=' * 70)
