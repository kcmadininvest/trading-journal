"""Copie le métier d'un utilisateur vers le compte de test e2e.

Les barres et les secrets ne sont pas copiés. Un modèle avec clé vers
l'utilisateur qui n'est ni copié, ni exclu, ni recalculé fait échouer
la commande.
"""
from __future__ import annotations

from collections import defaultdict

from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.management.base import CommandError
from django.db import transaction
from django.db.models import Q

from accounts.e2e_guard import assert_clone_allowed

User = get_user_model()

TARGET_USERNAME = 'e2e'
TARGET_EMAIL = 'e2e@localhost'

# Modèles dont les lignes suivent l'utilisateur de test.
COPY_LABELS = frozenset({
    'accounts.UserPreferences',
    'trades.TradingAccount',
    'trades.AccountTransaction',
    'trades.ImportedTrade',
    'trades.TradeStrategy',
    'trades.PositionStrategy',
    'trades.TradingGoal',
    'trades.DayStrategyCompliance',
    'trades.ExportTemplate',
    'trades.TradingSession',
    'trades.TradeTag',
    'daily_journal.DailyJournalEntry',
    'daily_journal.QuestionTemplate',
    'daily_journal.Questionnaire',
    'daily_journal.QuestionnaireAnswer',
    'billing.CustomerSubscription',
    'trading_activity.TradingActivityExpenseCategory',
    'trading_activity.TradingActivityTaxPaymentType',
    'trading_activity.TradingActivityTaxPaymentBuiltinLabel',
    'trading_activity.TradingActivityExpense',
    'trading_activity.TradingActivityCredit',
    'trading_activity.TradingActivityTaxPayment',
    'backtest_journal.ManualBacktestStrategy',
    'backtest_journal.ManualBacktestCampaign',
    'backtest_journal.ManualBacktestObservation',
})

# Historique, jetons, secrets, journaux techniques, données marché.
EXCLUDE_LABELS = frozenset({
    'admin.LogEntry',
    'token_blacklist.OutstandingToken',
    'guardian.UserObjectPermission',
    'accounts.LoginHistory',
    'accounts.EmailActivationToken',
    'trades.TradeSyncLog',
    'trades.TopStepImportLog',
    'integrations.UserApiIntegration',
    'market_data.HistoricalBar',
    'market_data.BarCoverage',
    'market_data.HistoricalDownloadJob',
    'market_data.HistoricalSyncSettings',
    'market_data.HistoricalSyncRun',
})

# Caches reconstruits après la copie, pas recopiés.
REBUILD_LABELS = frozenset({
    'trades.TradeDailyRollup',
    'trades.TradeStatistics',
    'trades.ConditionalProbability',
})

CLASSIFIED = COPY_LABELS | EXCLUDE_LABELS | REBUILD_LABELS


def user_fk_fields():
    """(modèle, champ) pour chaque clé concrète vers l'utilisateur."""
    found = []
    for model in apps.get_models():
        if model._meta.proxy or not model._meta.managed:
            continue
        for field in model._meta.concrete_fields:
            if field.is_relation and field.related_model is User:
                found.append((model, field))
    return found


def unclassified_labels() -> list[str]:
    labels = []
    for model, _field in user_fk_fields():
        label = model._meta.label
        if label not in CLASSIFIED:
            labels.append(label)
    return sorted(set(labels))


def assert_models_classified() -> None:
    missing = unclassified_labels()
    if missing:
        joined = ', '.join(missing)
        raise CommandError(
            'Modèles liés à l\'utilisateur non classés pour le clone : '
            f'{joined}. Ajoute-les à COPY_LABELS, EXCLUDE_LABELS ou REBUILD_LABELS.'
        )


def _user_field_by_label() -> dict[str, object]:
    return {model._meta.label: field for model, field in user_fk_fields()}


def _copy_models():
    by_label = {model._meta.label: model for model, _field in user_fk_fields()}
    models = [by_label[label] for label in COPY_LABELS if label in by_label]
    known = {model._meta.label for model in models}
    # Dépendants sans clé utilisateur : enfants des modèles copiés.
    changed = True
    while changed:
        changed = False
        for model in apps.get_models():
            if model._meta.proxy or not model._meta.managed:
                continue
            label = model._meta.label
            if label in known or label in EXCLUDE_LABELS or label in REBUILD_LABELS:
                continue
            if model._meta.app_label == 'market_data':
                continue
            for field in model._meta.concrete_fields:
                if not field.is_relation or field.related_model is None:
                    continue
                if field.related_model._meta.label in known and field.related_model is not User:
                    models.append(model)
                    known.add(label)
                    changed = True
                    break
    return models


def _sort_models(models: list) -> list:
    labels = {model._meta.label: model for model in models}
    deps: dict[str, set[str]] = {label: set() for label in labels}
    for model in models:
        label = model._meta.label
        for field in model._meta.concrete_fields:
            if not field.is_relation or field.related_model is None:
                continue
            related = field.related_model._meta.label
            if related in labels and related != label:
                deps[label].add(related)
    ready = [label for label, needed in deps.items() if not needed]
    order: list[str] = []
    while ready:
        label = ready.pop()
        order.append(label)
        for other, needed in deps.items():
            if label in needed:
                needed.remove(label)
                if not needed and other not in order and other not in ready:
                    ready.append(other)
    for label in labels:
        if label not in order:
            order.append(label)
    return [labels[label] for label in order]


def _rewrite_unique(model, values: dict) -> None:
    for field in model._meta.concrete_fields:
        if not field.unique or field.primary_key or field.is_relation:
            continue
        value = values.get(field.attname)
        if value in (None, ''):
            continue
        if not model.objects.filter(**{field.attname: value}).exists():
            continue
        if not isinstance(value, str):
            raise CommandError(
                f'Collision unique non textuelle sur {model._meta.label}.{field.name}.'
            )
        suffix = '-e2e'
        max_len = field.max_length or (len(value) + len(suffix))
        candidate = f'{value[: max_len - len(suffix)]}{suffix}'
        index = 2
        while model.objects.filter(**{field.attname: candidate}).exists():
            extra = f'-e2e{index}'
            candidate = f'{value[: max_len - len(extra)]}{extra}'
            index += 1
            if index > 50:
                raise CommandError(
                    f'Impossible de dédoublonner {model._meta.label}.{field.name}.'
                )
        values[field.attname] = candidate


def _remap_value(field, raw_id, *, target_user, id_map, deferred, old_pk):
    if raw_id is None:
        return None
    if field.related_model is User:
        return target_user.pk
    related_label = field.related_model._meta.label
    if related_label in EXCLUDE_LABELS or related_label in REBUILD_LABELS:
        if field.null:
            return None
        raise CommandError(
            f'{field.model._meta.label}.{field.name} pointe vers {related_label}, '
            'qui est exclu du clone et non nullable.'
        )
    if related_label in id_map:
        mapped = id_map[related_label]
        if raw_id in mapped:
            return mapped[raw_id]
        if field.null:
            deferred.append((field.model._meta.label, old_pk, field.attname, related_label, raw_id))
            return None
        raise CommandError(
            f'{field.model._meta.label}.{field.name}={raw_id} sans ligne copiée '
            f'dans {related_label}.'
        )
    return raw_id


def _copy_model(model, source_user, target_user, id_map, user_fields) -> int:
    label = model._meta.label
    id_map.setdefault(label, {})
    user_field = user_fields.get(label)
    if user_field is not None:
        queryset = model.objects.filter(**{user_field.name: source_user})
    else:
        query = Q()
        matched = False
        for field in model._meta.concrete_fields:
            if not field.is_relation or field.related_model is None:
                continue
            related_label = field.related_model._meta.label
            old_ids = list(id_map.get(related_label, {}).keys())
            if not old_ids:
                continue
            query |= Q(**{f'{field.attname}__in': old_ids})
            matched = True
        if not matched:
            return 0, []
        queryset = model.objects.filter(query).distinct()

    deferred: list[tuple] = []
    batch = []
    old_ids: list = []
    copied = 0

    def flush() -> None:
        nonlocal copied
        if not batch:
            return
        model.objects.bulk_create(batch, batch_size=200)
        for old_id, obj in zip(old_ids, batch):
            if obj.pk is None:
                raise CommandError(f'Pas de clé après copie de {label}.')
            id_map[label][old_id] = obj.pk
        copied += len(batch)
        batch.clear()
        old_ids.clear()

    for source in queryset.iterator(chunk_size=200):
        values = {}
        for field in model._meta.concrete_fields:
            if field.primary_key:
                continue
            raw = getattr(source, field.attname)
            if field.is_relation:
                raw = _remap_value(
                    field,
                    raw,
                    target_user=target_user,
                    id_map=id_map,
                    deferred=deferred,
                    old_pk=source.pk,
                )
            values[field.attname] = raw
        _rewrite_unique(model, values)
        batch.append(model(**values))
        old_ids.append(source.pk)
        if len(batch) >= 200:
            flush()
    flush()

    return copied, deferred


def _copy_m2m(models, id_map) -> None:
    for model in models:
        label = model._meta.label
        mapping = id_map.get(label) or {}
        if not mapping:
            continue
        for field in model._meta.many_to_many:
            through = field.remote_field.through
            if not through._meta.auto_created:
                continue
            source_column = field.m2m_column_name()
            target_column = field.m2m_reverse_name()
            target_label = field.related_model._meta.label
            target_map = id_map.get(target_label, {})
            rows = through.objects.filter(**{f'{source_column}__in': list(mapping.keys())})
            clones = []
            for row in rows.iterator(chunk_size=200):
                old_source = getattr(row, source_column)
                old_target = getattr(row, target_column)
                new_source = mapping.get(old_source)
                if new_source is None:
                    continue
                new_target = target_map.get(old_target, old_target)
                clones.append(through(**{
                    source_column: new_source,
                    target_column: new_target,
                }))
                if len(clones) >= 200:
                    through.objects.bulk_create(clones, ignore_conflicts=True)
                    clones.clear()
            if clones:
                through.objects.bulk_create(clones, ignore_conflicts=True)


def _rebuild(target_user) -> None:
    from trades.services.rollup_service import rebuild_rollups_for_user

    rebuild_rollups_for_user(target_user.pk)


def clone_user_dataset(
    *,
    source_username: str,
    password: str = '',
    reset: bool = False,
) -> User:
    """Crée ou réutilise le compte e2e. Ne modifie pas la source."""
    assert_clone_allowed()
    assert_models_classified()
    if source_username == TARGET_USERNAME:
        raise CommandError('La source et la cible doivent être distinctes.')

    try:
        source = User.objects.get(username=source_username)
    except User.DoesNotExist as exc:
        raise CommandError(f'Utilisateur source « {source_username} » introuvable.') from exc

    existing = User.objects.filter(username=TARGET_USERNAME).first()
    if existing is not None and existing.pk == source.pk:
        raise CommandError('La cible ne peut pas être la source.')
    if existing is not None and not reset:
        return existing
    if not password:
        raise CommandError('E2E_TEST_PASSWORD est requis pour créer le compte de test.')

    user_fields = _user_field_by_label()
    models = _sort_models(_copy_models())

    with transaction.atomic():
        if existing is not None:
            existing.delete()
        email_owner = User.objects.filter(email__iexact=TARGET_EMAIL).first()
        if email_owner is not None:
            raise CommandError(f'L\'email {TARGET_EMAIL} est déjà utilisé.')
        target = User(
            email=TARGET_EMAIL,
            username=TARGET_USERNAME,
            first_name='E2E',
            last_name='Qualif',
            role='user',
            is_active=True,
            is_verified=True,
            is_staff=False,
            is_superuser=False,
        )
        target.set_password(password)
        target.save()

        id_map: dict[str, dict] = defaultdict(dict)
        for model in models:
            id_map.setdefault(model._meta.label, {})
        by_label = {model._meta.label: model for model in models}
        deferred_all = []
        for model in models:
            _copied, deferred = _copy_model(model, source, target, id_map, user_fields)
            deferred_all.extend(deferred)
        for model_label, old_pk, attname, related_label, raw_id in deferred_all:
            new_pk = id_map.get(model_label, {}).get(old_pk)
            new_related = id_map.get(related_label, {}).get(raw_id)
            if new_pk is None or new_related is None:
                continue
            by_label[model_label].objects.filter(pk=new_pk).update(**{attname: new_related})
        _copy_m2m(models, id_map)
        _rebuild(target)
    return target
