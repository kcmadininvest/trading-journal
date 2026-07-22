"""Règles show_if : validation et évaluation de visibilité."""
from __future__ import annotations

from typing import Any, Mapping

from django.core.exceptions import ValidationError
from rest_framework import serializers

from .models import (
    BRANCHABLE_ANSWER_TYPES,
    CHOICE_ANSWER_TYPES,
    SHOW_IF_MAX_CONDITIONS,
    QuestionnaireQuestion,
)


def normalize_show_if(raw: Any) -> dict | None:
    """Normalise null / {} / règle vide → None ; sinon retourne un dict canonique."""
    if raw is None or raw == {} or raw == '':
        return None
    if not isinstance(raw, dict):
        raise serializers.ValidationError({'show_if': 'Objet JSON attendu.'})
    conditions = raw.get('conditions')
    if not conditions:
        return None
    if not isinstance(conditions, list):
        raise serializers.ValidationError({'show_if': 'conditions doit être une liste.'})
    if len(conditions) > SHOW_IF_MAX_CONDITIONS:
        raise serializers.ValidationError(
            {'show_if': f'Maximum {SHOW_IF_MAX_CONDITIONS} conditions.'}
        )
    logic = raw.get('logic') or 'and'
    if logic not in ('and', 'or'):
        raise serializers.ValidationError({'show_if': 'logic doit être "and" ou "or".'})
    if len(conditions) == 1:
        logic = 'and'
    normalized = []
    for index, cond in enumerate(conditions):
        if not isinstance(cond, dict):
            raise serializers.ValidationError(
                {'show_if': f'Condition {index + 1} invalide.'}
            )
        qid = cond.get('question_id')
        operator = cond.get('operator')
        value = cond.get('value')
        if not isinstance(qid, int):
            raise serializers.ValidationError(
                {'show_if': f'Condition {index + 1} : question_id entier requis.'}
            )
        if operator not in ('eq', 'neq'):
            raise serializers.ValidationError(
                {'show_if': f'Condition {index + 1} : operator eq ou neq requis.'}
            )
        normalized.append(
            {'question_id': qid, 'operator': operator, 'value': value}
        )
    return {'logic': logic, 'conditions': normalized}


def _choice_ids(question: QuestionnaireQuestion) -> set[int]:
    return set(question.choices.values_list('id', flat=True))


def validate_condition_value(source: QuestionnaireQuestion, value: Any) -> Any:
    if source.answer_type == 'boolean':
        if not isinstance(value, bool):
            raise serializers.ValidationError(
                'Valeur booléenne attendue pour une condition sur une question Oui/Non.'
            )
        return value
    if source.answer_type in CHOICE_ANSWER_TYPES:
        if not isinstance(value, int):
            raise serializers.ValidationError(
                'Identifiant de choix (entier) attendu pour cette condition.'
            )
        if value not in _choice_ids(source):
            raise serializers.ValidationError(
                'Choix introuvable pour la question source de la condition.'
            )
        return value
    raise serializers.ValidationError(
        f'Type {source.answer_type} non utilisable dans une condition.'
    )


def collect_dependency_ids(show_if: dict | None) -> set[int]:
    if not show_if:
        return set()
    return {c['question_id'] for c in show_if.get('conditions', [])}


def would_create_cycle(
    question_id: int | None,
    dependency_ids: set[int],
    questions_by_id: Mapping[int, QuestionnaireQuestion],
) -> bool:
    """True si question_id dépend (via show_if) d'une chaîne menant à elle-même."""
    if question_id is None:
        return False
    if question_id in dependency_ids:
        return True

    visited: set[int] = set()
    stack = list(dependency_ids)
    while stack:
        current = stack.pop()
        if current == question_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        other = questions_by_id.get(current)
        if not other:
            continue
        stack.extend(collect_dependency_ids(other.show_if if isinstance(other.show_if, dict) else None))
    return False


def validate_show_if_for_question(
    *,
    questionnaire_id: int,
    question_id: int | None,
    show_if: Any,
    questions_by_id: Mapping[int, QuestionnaireQuestion] | None = None,
) -> dict | None:
    """Valide et normalise show_if pour une question d'instance."""
    normalized = normalize_show_if(show_if)
    if normalized is None:
        return None

    if questions_by_id is None:
        qs = QuestionnaireQuestion.objects.filter(
            questionnaire_id=questionnaire_id
        ).prefetch_related('choices')
        questions_by_id = {q.id: q for q in qs}

    for index, cond in enumerate(normalized['conditions']):
        src_id = cond['question_id']
        if question_id is not None and src_id == question_id:
            raise serializers.ValidationError(
                {'show_if': f'Condition {index + 1} : auto-référence interdite.'}
            )
        source = questions_by_id.get(src_id)
        if source is None or source.questionnaire_id != questionnaire_id:
            raise serializers.ValidationError(
                {
                    'show_if': (
                        f'Condition {index + 1} : question {src_id} introuvable '
                        f'dans ce questionnaire.'
                    )
                }
            )
        if source.answer_type not in BRANCHABLE_ANSWER_TYPES:
            raise serializers.ValidationError(
                {
                    'show_if': (
                        f'Condition {index + 1} : le type '
                        f'{source.answer_type} ne peut pas déclencher une condition.'
                    )
                }
            )
        try:
            cond['value'] = validate_condition_value(source, cond['value'])
        except serializers.ValidationError as exc:
            detail = exc.detail
            msg = detail if isinstance(detail, str) else str(detail)
            raise serializers.ValidationError(
                {'show_if': f'Condition {index + 1} : {msg}'}
            ) from exc

    deps = collect_dependency_ids(normalized)
    if would_create_cycle(question_id, deps, questions_by_id):
        raise serializers.ValidationError(
            {'show_if': 'Les conditions formeraient un cycle de dépendances.'}
        )

    return normalized


def condition_matches(
    operator: str,
    expected: Any,
    actual: Any,
    answer_type: str,
) -> bool:
    if actual is None or actual == '':
        matched = False
    elif answer_type == 'multiple_choice':
        selected = actual if isinstance(actual, list) else []
        matched = expected in selected
    else:
        matched = actual == expected

    if operator == 'eq':
        return matched
    if operator == 'neq':
        return not matched
    return False


def is_question_visible(
    question: QuestionnaireQuestion,
    answers_by_qid: Mapping[int, Any],
    questions_by_id: Mapping[int, QuestionnaireQuestion],
    _cache: dict[int, bool] | None = None,
) -> bool:
    if _cache is None:
        _cache = {}
    if question.id in _cache:
        return _cache[question.id]

    show_if = question.show_if if isinstance(question.show_if, dict) else None
    if not show_if or not show_if.get('conditions'):
        _cache[question.id] = True
        return True

    # Marquer en cours pour éviter récursion infinie sur cycle résiduel
    _cache[question.id] = False

    results = []
    for cond in show_if['conditions']:
        src_id = cond['question_id']
        source = questions_by_id.get(src_id)
        if source is None:
            results.append(False)
            continue
        if not is_question_visible(source, answers_by_qid, questions_by_id, _cache):
            results.append(False)
            continue
        actual = answers_by_qid.get(src_id)
        results.append(
            condition_matches(
                cond.get('operator', 'eq'),
                cond.get('value'),
                actual,
                source.answer_type,
            )
        )

    logic = show_if.get('logic') or 'and'
    visible = all(results) if logic == 'and' else any(results)
    _cache[question.id] = visible
    return visible


def questions_referencing(question_id: int, questionnaire_id: int) -> list[QuestionnaireQuestion]:
    """Questions du même questionnaire dont show_if référence question_id."""
    dependents = []
    for q in QuestionnaireQuestion.objects.filter(questionnaire_id=questionnaire_id):
        show_if = q.show_if if isinstance(q.show_if, dict) else None
        if question_id in collect_dependency_ids(show_if):
            dependents.append(q)
    return dependents


def deactivate_dependent_questions(question: QuestionnaireQuestion) -> list[int]:
    """Désactive récursivement les questions qui dépendent de `question`."""
    deactivated_ids: list[int] = []
    queue = [question.id]
    seen = {question.id}
    while queue:
        current_id = queue.pop(0)
        for dep in questions_referencing(current_id, question.questionnaire_id):
            if dep.id in seen:
                continue
            seen.add(dep.id)
            if dep.is_active:
                dep.is_active = False
                dep.save(update_fields=['is_active', 'updated_at'])
                deactivated_ids.append(dep.id)
            queue.append(dep.id)
    return deactivated_ids


def django_validate_show_if(question: QuestionnaireQuestion) -> None:
    """Validation modèle (clean) — lève ValidationError Django."""
    try:
        validate_show_if_for_question(
            questionnaire_id=question.questionnaire_id,
            question_id=question.pk,
            show_if=question.show_if,
        )
    except serializers.ValidationError as exc:
        raise ValidationError(exc.detail) from exc
