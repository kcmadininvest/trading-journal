from django.db import transaction
from django.db.models import Max
from rest_framework import serializers

from trades.models import ImportedTrade, TradingAccount

from .answer_validation import validate_answer_value
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
    class Meta:
        model = QuestionnaireQuestionChoice
        fields = ['id', 'label', 'order']
        read_only_fields = ['id']


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
        return attrs

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
        choices_data = validated_data.pop('choices', serializers.empty)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if choices_data is not serializers.empty:
            instance.choices.all().delete()
            self._replace_choices(instance, choices_data or [])
        return instance

    def _replace_choices(self, question, choices_data):
        for index, choice in enumerate(choices_data):
            QuestionnaireQuestionChoice.objects.create(
                question=question,
                label=choice['label'],
                order=choice.get('order', index),
            )


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

        question_ids = [item['question_id'] for item in items]
        questions = {
            q.id: q
            for q in QuestionnaireQuestion.objects.filter(
                questionnaire=questionnaire,
                id__in=question_ids,
            ).prefetch_related('choices')
        }

        results = []
        for item in items:
            question = questions.get(item['question_id'])
            if not question:
                raise serializers.ValidationError(
                    {
                        'answers': f"Question {item['question_id']} introuvable "
                        f"pour ce questionnaire."
                    }
                )
            value = validate_answer_value(question, item.get('value'))

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

            # null = question non renseignée dans ce payload → ne pas toucher
            # à une éventuelle réponse déjà enregistrée.
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

        return results
