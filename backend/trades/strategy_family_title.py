"""
Titre partagé par toutes les versions d'une stratégie.

Le titre identifie la famille. Les règles restent celles de la version liée au trade.
"""
from collections import defaultdict

from django.db.models import Q


def canonical_family_title(versions):
    """
    Titre à appliquer à la famille, ou None si elle doit rester inchangée.

    Une seule version courante fournit le titre. Plusieurs versions courantes
    ne le fournissent que si elles portent déjà le même titre non vide.
    Aucune version courante, ou des titres courants divergents ou vides : None.
    """
    current = [version for version in versions if version.is_current]
    if not current:
        return None
    titles = []
    for version in current:
        title = version.title or ""
        if not str(title).strip():
            return None
        titles.append(title)
    if len(set(titles)) != 1:
        return None
    return titles[0]


def propagate_current_title(strategy) -> int:
    """
    Recopie le titre de la version courante sur les autres versions de sa famille.

    Ne fait rien si la ligne n'est pas courante ou si le titre est vide.
    N'écrit pas la ligne source et n'appelle pas save().
    """
    title = strategy.title or ""
    if not strategy.is_current or not str(title).strip():
        return 0
    root_id = strategy.parent_strategy_id or strategy.pk
    model = strategy.__class__
    return model.objects.filter(user_id=strategy.user_id).filter(
        Q(pk=root_id) | Q(parent_strategy_id=root_id)
    ).exclude(pk=strategy.pk).exclude(title=title).update(title=title)


def align_family_titles(model) -> int:
    """
    Aligne les titres déjà divergents. Retourne le nombre de lignes modifiées.
    """
    rows = list(model.objects.all().only(
        "id", "user_id", "parent_strategy_id", "is_current", "title",
    ))
    families = defaultdict(list)
    for row in rows:
        root_id = row.parent_strategy_id or row.id
        families[(row.user_id, root_id)].append(row)

    updated = 0
    for members in families.values():
        title = canonical_family_title(members)
        if title is None:
            continue
        ids = [member.id for member in members if member.title != title]
        if not ids:
            continue
        updated += model.objects.filter(id__in=ids).update(title=title)
    return updated
