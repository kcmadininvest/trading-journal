from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from trades.models import ImportedTrade, TradingAccount

from .answer_validation import validate_answer_value
from .conditional_visibility import (
    is_question_visible,
    validate_show_if_for_question,
)
from .models import (
    CHOICE_ANSWER_TYPES,
    QuestionTemplate,
    QuestionTemplateChoice,
    Questionnaire,
    QuestionnaireAnswer,
    QuestionnaireQuestion,
    QuestionnaireQuestionChoice,
)


class QuestionTemplateChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionTemplateChoice
        fields = ['id', 'label', 'order']
        read_only_fields = ['id']


class QuestionTemplateSerializer(serializers.ModelSerializer):
    choices = QuestionTemplateChoiceSerializer(many=True, required=False)

    class Meta:
        model = QuestionTemplate
        fields = [
            'id',
            'label',
            'help_text',
            'answer_type',
            'config',
            'is_active',
            'choices',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, attrs):
        answer_type = attrs.get('answer_type') or getattr(self.instance, 'answer_type', None)
        choices = attrs.get('choices', serializers.empty)
        if choices is serializers.empty and self.instance:
            has_choices = self.instance.choices.exists()
        else:
            has_choices = bool(choices) if choices is not serializers.empty else False

        if answer_type in CHOICE_ANSWER_TYPES and not has_choices and not self.partial:
            raise serializers.ValidationError(
                {'choices': 'Au moins un choix est requis pour ce type.'}
            )
        if answer_type and answer_type not in CHOICE_ANSWER_TYPES and choices not in (
            serializers.empty,
            None,
            [],
        ):
            if choices:
                raise serializers.ValidationError(
                    {'choices': 'Les choix ne s\'appliquent pas à ce type.'}
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        choices_data = validated_data.pop('choices', [])
        user = self.context['request'].user
        template = QuestionTemplate.objects.create(user=user, **validated_data)
        self._replace_choices(template, choices_data)
        return template

    @transaction.atomic
    def update(self, instance, validated_data):
        choices_data = validated_data.pop('choices', serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if choices_data is not serializers.empty:
            instance.choices.all().delete()
            self._replace_choices(instance, choices_data or [])
        return instance

    def _replace_choices(self, template, choices_data):
        for index, choice in enumerate(choices_data):
            QuestionTemplateChoice.objects.create(
                template=template,
                label=choice['label'],
                order=choice.get('order', index),
            )


class QuestionnaireQuestionChoiceSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = QuestionnaireQuestionChoice
        fields = ['id', 'label', 'order']
        # id writable pour préserver les références show_if à l'update


class QuestionnaireQuestionSerializer(serializers.ModelSerializer):
    choices = QuestionnaireQuestionChoiceSerializer(many=True, required=False)

    class Meta:
        model = QuestionnaireQuestion
        fields = [
            'id',
            'questionnaire',
            'source_template',
            'label',
            'help_text',
            'answer_type',
            'config',
            'required',
            'order',
            'is_active',
            'show_if',
            'choices',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'questionnaire',
            'source_template',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        answer_type = attrs.get('answer_type') or getattr(self.instance, 'answer_type', None)
        choices = attrs.get('choices', serializers.empty)
        if answer_type in CHOICE_ANSWER_TYPES:
            if choices is serializers.empty and self.instance:
                has_choices = self.instance.choices.exists()
            else:
                has_choices = bool(choices) if choices is not serializers.empty else False
            if not has_choices and not (self.partial and self.instance):
                if not self.partial or 'answer_type' in attrs or 'choices' in getattr(
                    self, 'initial_data', {}
                ):
                    if not has_choices:
                        raise serializers.ValidationError(
                            {'choices': 'Au moins un choix est requis pour ce type.'}
                        )

        questionnaire = self.context.get('questionnaire')
        if questionnaire is None and self.instance is not None:
            questionnaire = self.instance.questionnaire

        if 'show_if' in attrs or (not self.partial and 'show_if' in getattr(self, 'initial_data', {})):
            raw_show_if = attrs.get('show_if', None)
            if questionnaire is None:
                raise serializers.ValidationError(
                    {'show_if': 'Questionnaire requis pour valider les conditions.'}
                )
            attrs['show_if'] = validate_show_if_for_question(
                questionnaire_id=questionnaire.id,
                question_id=self.instance.id if self.instance else None,
                show_if=raw_show_if,
            )
        elif self.instance and 'answer_type' in attrs:
            # Revalider show_if des dépendants n'est pas ici ; si cette question
            # change de type et est encore référencée, on bloque à l'update.
            self._ensure_branchable_change_safe(attrs['answer_type'])

        return attrs

    def _ensure_branchable_change_safe(self, new_type: str):
        from .conditional_visibility import questions_referencing
        from .models import BRANCHABLE_ANSWER_TYPES

        if self.instance is None:
            return
        old_type = self.instance.answer_type
        if old_type == new_type:
            return
        if old_type in BRANCHABLE_ANSWER_TYPES and new_type not in BRANCHABLE_ANSWER_TYPES:
            refs = questions_referencing(self.instance.id, self.instance.questionnaire_id)
            if refs:
                raise serializers.ValidationError(
                    {
                        'answer_type': (
                            'Impossible de changer ce type : d\'autres questions '
                            'dépendent de celle-ci via des conditions.'
                        )
                    }
                )

    @transaction.atomic
    def create(self, validated_data):
        choices_data = validated_data.pop('choices', [])
        questionnaire = self.context['questionnaire']
        if 'order' not in validated_data:
            max_order = questionnaire.questions.aggregate(m=Max('order'))['m']
            validated_data['order'] = (max_order or 0) + 1
        question = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            **validated_data,
        )
        self._replace_choices(question, choices_data)
        return question

    @transaction.atomic
    def update(self, instance, validated_data):
        from .conditional_visibility import deactivate_dependent_questions

        choices_data = validated_data.pop('choices', serializers.empty)
        becoming_inactive = (
            'is_active' in validated_data
            and validated_data['is_active'] is False
            and instance.is_active
        )
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if choices_data is not serializers.empty:
            self._replace_choices(instance, choices_data or [])
        if becoming_inactive:
            deactivate_dependent_questions(instance)
        return instance

    def _replace_choices(self, question, choices_data):
        from .conditional_visibility import questions_referencing

        keep_ids = set()
        for index, choice in enumerate(choices_data):
            choice_id = choice.get('id')
            label = choice['label']
            order = choice.get('order', index)
            if choice_id:
                existing = question.choices.filter(pk=choice_id).first()
                if existing:
                    existing.label = label
                    existing.order = order
                    existing.save(update_fields=['label', 'order'])
                    keep_ids.add(existing.id)
                    continue
            created = QuestionnaireQuestionChoice.objects.create(
                question=question,
                label=label,
                order=order,
            )
            keep_ids.add(created.id)

        to_delete = question.choices.exclude(id__in=keep_ids)
        deleted_ids = set(to_delete.values_list('id', flat=True))
        if deleted_ids:
            for dep in questions_referencing(question.id, question.questionnaire_id):
                show_if = dep.show_if if isinstance(dep.show_if, dict) else None
                for cond in (show_if or {}).get('conditions', []):
                    if (
                        cond.get('question_id') == question.id
                        and isinstance(cond.get('value'), int)
                        and cond['value'] in deleted_ids
                    ):
                        raise serializers.ValidationError(
                            {
                                'choices': (
                                    'Impossible de supprimer un choix encore utilisé '
                                    'dans une condition d\'affichage.'
                                )
                            }
                        )
            to_delete.delete()


class QuestionnaireSerializer(serializers.ModelSerializer):
    questions = QuestionnaireQuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Questionnaire
        fields = [
            'id',
            'scope',
            'name',
            'is_active',
            'questions',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'scope', 'is_active', 'created_at', 'updated_at']


class QuestionnaireAnswerSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source='question.id', read_only=True)

    class Meta:
        model = QuestionnaireAnswer
        fields = [
            'id',
            'question_id',
            'value',
            'question_label_snapshot',
            'answer_type_snapshot',
            'trading_account',
            'date',
            'trade',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class AnswersFormSerializer(serializers.Serializer):
    """Payload lecture formulaire + réponses."""

    scope = serializers.ChoiceField(choices=['day', 'position'])
    questions = QuestionnaireQuestionSerializer(many=True)
    answers = QuestionnaireAnswerSerializer(many=True)
    questionnaire_id = serializers.IntegerField(allow_null=True)


class BulkAnswerItemSerializer(serializers.Serializer):
    question_id = serializers.IntegerField()
    value = serializers.JSONField(allow_null=True)


class BulkAnswersSerializer(serializers.Serializer):
    scope = serializers.ChoiceField(choices=['day', 'position'])
    date = serializers.DateField(required=False, allow_null=True)
    trading_account = serializers.IntegerField(required=False, allow_null=True)
    trade = serializers.IntegerField(required=False, allow_null=True)
    answers = BulkAnswerItemSerializer(many=True)

    def validate(self, attrs):
        scope = attrs['scope']
        user = self.context['request'].user

        if scope == 'day':
            if not attrs.get('date'):
                raise serializers.ValidationError({'date': 'Date requise pour scope=day.'})
            if attrs.get('trade'):
                raise serializers.ValidationError({'trade': 'Ne pas fournir trade pour scope=day.'})
            account_id = attrs.get('trading_account')
            if account_id is not None:
                if not TradingAccount.objects.filter(pk=account_id, user=user).exists():
                    raise serializers.ValidationError(
                        {'trading_account': 'Compte introuvable.'}
                    )
        else:
            trade_id = attrs.get('trade')
            if not trade_id:
                raise serializers.ValidationError({'trade': 'Trade requis pour scope=position.'})
            trade = ImportedTrade.objects.filter(pk=trade_id, user=user).first()
            if not trade:
                raise serializers.ValidationError({'trade': 'Trade introuvable.'})
            attrs['_trade_obj'] = trade
            if attrs.get('date') is not None:
                raise serializers.ValidationError(
                    {'date': 'Ne pas fournir date pour scope=position.'}
                )

        return attrs

    @transaction.atomic
    def save(self):
        user = self.context['request'].user
        scope = self.validated_data['scope']
        items = self.validated_data['answers']
        questionnaire = Questionnaire.get_or_create_for_scope(user, scope)

        all_questions = list(
            QuestionnaireQuestion.objects.filter(
                questionnaire=questionnaire,
            ).prefetch_related('choices')
        )
        questions_by_id = {q.id: q for q in all_questions}

        # Réponses existantes pour ce contexte
        if scope == 'day':
            account_id = self.validated_data.get('trading_account')
            existing_qs = QuestionnaireAnswer.objects.filter(
                user=user,
                question__questionnaire=questionnaire,
                date=self.validated_data['date'],
                trade__isnull=True,
            )
            if account_id is not None:
                existing_qs = existing_qs.filter(trading_account_id=account_id)
            else:
                existing_qs = existing_qs.filter(trading_account__isnull=True)
        else:
            trade = self.validated_data['_trade_obj']
            existing_qs = QuestionnaireAnswer.objects.filter(
                user=user,
                question__questionnaire=questionnaire,
                trade=trade,
            )

        existing_by_qid = {a.question_id: a for a in existing_qs}

        submitted = {item['question_id']: item.get('value') for item in items}
        answers_by_qid = {
            qid: ans.value for qid, ans in existing_by_qid.items()
        }
        for qid, value in submitted.items():
            # null dans le payload = ne pas écraser pour le calcul de visibilité
            if value is None or value == '':
                continue
            if isinstance(value, list) and len(value) == 0:
                continue
            answers_by_qid[qid] = value

        visibility_cache: dict = {}
        visible_by_id = {
            q.id: is_question_visible(q, answers_by_qid, questions_by_id, visibility_cache)
            for q in all_questions
            if q.is_active or q.id in existing_by_qid
        }

        results = []
        processed_ids: set[int] = set()

        for item in items:
            qid = item['question_id']
            question = questions_by_id.get(qid)
            if not question:
                raise serializers.ValidationError(
                    {
                        'answers': f"Question {qid} introuvable "
                        f"pour ce questionnaire."
                    }
                )
            processed_ids.add(qid)
            visible = visible_by_id.get(qid, True)

            if scope == 'day':
                account_id = self.validated_data.get('trading_account')
                lookup = {
                    'question': question,
                    'date': self.validated_data['date'],
                    'trading_account_id': account_id,
                    'trade': None,
                }
            else:
                trade = self.validated_data['_trade_obj']
                lookup = {
                    'question': question,
                    'trade': trade,
                }

            if not visible:
                QuestionnaireAnswer.objects.filter(**lookup).delete()
                continue

            value = item.get('value')
            # null = question non renseignée dans ce payload → ne pas toucher
            # à une éventuelle réponse déjà enregistrée (sauf required visible).
            if value is None or value == '':
                if question.required and answers_by_qid.get(qid) is None:
                    raise serializers.ValidationError(
                        {'answers': f'Question « {question.label} » obligatoire.'}
                    )
                continue
            if isinstance(value, list) and len(value) == 0 and not question.required:
                continue

            value = validate_answer_value(question, value)

            if value is None:
                continue

            defaults = {
                'user': user,
                'value': value,
                'question_label_snapshot': question.label,
                'answer_type_snapshot': question.answer_type,
            }

            if scope == 'day':
                defaults['trading_account_id'] = self.validated_data.get('trading_account')
                defaults['date'] = self.validated_data['date']
                defaults['trade'] = None
            else:
                trade = self.validated_data['_trade_obj']
                defaults['trade'] = trade
                defaults['trading_account'] = trade.trading_account
                defaults['date'] = None

            answer, _created = QuestionnaireAnswer.objects.update_or_create(
                **lookup,
                defaults=defaults,
            )
            results.append(answer)

        # Effacer les réponses des questions masquées non présentes dans le payload
        for q in all_questions:
            if q.id in processed_ids:
                continue
            if visible_by_id.get(q.id, True):
                continue
            if q.id not in existing_by_qid:
                continue
            if scope == 'day':
                QuestionnaireAnswer.objects.filter(
                    question=q,
                    date=self.validated_data['date'],
                    trading_account_id=self.validated_data.get('trading_account'),
                    trade__isnull=True,
                ).delete()
            else:
                QuestionnaireAnswer.objects.filter(
                    question=q,
                    trade=self.validated_data['_trade_obj'],
                ).delete()

        return results
