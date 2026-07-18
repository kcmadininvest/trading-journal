"""Validation des valeurs de réponses selon answer_type."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

from rest_framework import serializers

from .models import CHOICE_ANSWER_TYPES, QuestionnaireQuestion


DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def validate_answer_value(question: QuestionnaireQuestion, value: Any) -> Any:
    answer_type = question.answer_type
    config = question.config if isinstance(question.config, dict) else {}

    # Chaîne vide = non répondu (ex. date saisie puis effacée).
    if value == '':
        value = None

    if value is None:
        if question.required:
            raise serializers.ValidationError('Cette question est obligatoire.')
        return None

    if answer_type == 'boolean':
        if not isinstance(value, bool):
            raise serializers.ValidationError('Valeur booléenne attendue.')
        return value

    if answer_type == 'text':
        if not isinstance(value, str):
            raise serializers.ValidationError('Texte attendu.')
        max_length = config.get('max_length')
        if max_length is not None and len(value) > int(max_length):
            raise serializers.ValidationError(f'Texte trop long (max {max_length}).')
        if question.required and not value.strip():
            raise serializers.ValidationError('Cette question est obligatoire.')
        if not value.strip():
            return None
        return value

    if answer_type == 'number':
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise serializers.ValidationError('Nombre attendu.')
        num = float(value)
        if config.get('min') is not None and num < float(config['min']):
            raise serializers.ValidationError(f'Valeur minimale : {config["min"]}.')
        if config.get('max') is not None and num > float(config['max']):
            raise serializers.ValidationError(f'Valeur maximale : {config["max"]}.')
        return value

    if answer_type == 'scale':
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise serializers.ValidationError('Nombre attendu pour l\'échelle.')
        num = float(value)
        min_v = float(config.get('min', 1))
        max_v = float(config.get('max', 5))
        if num < min_v or num > max_v:
            raise serializers.ValidationError(f'Échelle entre {min_v} et {max_v}.')
        return value

    if answer_type == 'date':
        if isinstance(value, date) and not isinstance(value, datetime):
            return value.isoformat()
        if not isinstance(value, str) or not DATE_RE.match(value):
            raise serializers.ValidationError('Date attendue (YYYY-MM-DD).')
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise serializers.ValidationError('Date invalide.') from exc
        return value

    if answer_type in CHOICE_ANSWER_TYPES:
        allowed_ids = set(question.choices.values_list('id', flat=True))
        if answer_type == 'single_choice':
            if not isinstance(value, int):
                raise serializers.ValidationError('Identifiant de choix (entier) attendu.')
            if value not in allowed_ids:
                raise serializers.ValidationError('Choix invalide.')
            return value
        # multiple_choice
        if not isinstance(value, list):
            raise serializers.ValidationError('Liste de choix attendue.')
        if question.required and len(value) == 0:
            raise serializers.ValidationError('Cette question est obligatoire.')
        for item in value:
            if not isinstance(item, int) or item not in allowed_ids:
                raise serializers.ValidationError('Choix invalide dans la liste.')
        return value

    raise serializers.ValidationError(f'Type de réponse inconnu : {answer_type}.')
