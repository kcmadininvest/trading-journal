from django.db import transaction
from django.db.models import Max, Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from trades.models import TopStepTrade

from .models import (
    QuestionTemplate,
    Questionnaire,
    QuestionnaireAnswer,
    QuestionnaireQuestion,
    QuestionnaireQuestionChoice,
)
from .questionnaire_serializers import (
    BulkAnswersSerializer,
    QuestionnaireAnswerSerializer,
    QuestionnaireQuestionSerializer,
    QuestionnaireSerializer,
    QuestionTemplateSerializer,
)


class QuestionTemplateViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuestionTemplateSerializer

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return QuestionTemplate.objects.none()
        qs = QuestionTemplate.objects.filter(user=self.request.user).prefetch_related(
            'choices'
        )
        active = self.request.query_params.get('is_active')
        if active is not None:
            qs = qs.filter(is_active=active.lower() in ('1', 'true', 'yes'))
        return qs.order_by('label', 'id')


class QuestionnaireViewSet(viewsets.ModelViewSet):
    """
    Liste / détail des questionnaires user.
    POST avec {scope} → get_or_create le questionnaire actif pour ce scope.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuestionnaireSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return Questionnaire.objects.none()
        qs = Questionnaire.objects.filter(user=self.request.user).prefetch_related(
            Prefetch(
                'questions',
                queryset=QuestionnaireQuestion.objects.prefetch_related('choices').order_by(
                    'order', 'id'
                ),
            )
        )
        scope = self.request.query_params.get('scope')
        if scope:
            qs = qs.filter(scope=scope)
        active = self.request.query_params.get('is_active')
        if active is not None:
            qs = qs.filter(is_active=active.lower() in ('1', 'true', 'yes'))
        return qs.order_by('scope', 'id')

    def create(self, request, *args, **kwargs):
        scope = request.data.get('scope')
        if scope not in ('day', 'position'):
            return Response(
                {'scope': 'Scope day ou position requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        questionnaire = Questionnaire.get_or_create_for_scope(request.user, scope)
        if request.data.get('name'):
            questionnaire.name = request.data['name']
            questionnaire.save(update_fields=['name', 'updated_at'])
        serializer = self.get_serializer(questionnaire)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get', 'post'], url_path='questions')
    def questions(self, request, pk=None):
        questionnaire = self.get_object()
        if request.method == 'GET':
            qs = questionnaire.questions.prefetch_related('choices').order_by('order', 'id')
            active = request.query_params.get('is_active')
            if active is not None:
                qs = qs.filter(is_active=active.lower() in ('1', 'true', 'yes'))
            return Response(
                QuestionnaireQuestionSerializer(qs, many=True).data
            )

        serializer = QuestionnaireQuestionSerializer(
            data=request.data,
            context={'request': request, 'questionnaire': questionnaire},
        )
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        return Response(
            QuestionnaireQuestionSerializer(question).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='questions/from-template')
    def from_template(self, request, pk=None):
        questionnaire = self.get_object()
        template_id = request.data.get('template_id')
        if not template_id:
            return Response(
                {'template_id': 'Requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        template = get_object_or_404(
            QuestionTemplate,
            pk=template_id,
            user=request.user,
        )
        question = clone_template_to_questionnaire(template, questionnaire)
        return Response(
            QuestionnaireQuestionSerializer(question).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'], url_path='questions/reorder')
    def reorder_questions(self, request, pk=None):
        questionnaire = self.get_object()
        ids = request.data.get('ids')
        if not isinstance(ids, list) or not ids:
            return Response(
                {'ids': 'Liste d\'ids requise.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        questions = {
            q.id: q
            for q in questionnaire.questions.filter(id__in=ids)
        }
        if len(questions) != len(set(ids)):
            return Response(
                {'ids': 'Une ou plusieurs questions sont introuvables.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            for order, qid in enumerate(ids):
                questions[qid].order = order
                questions[qid].save(update_fields=['order', 'updated_at'])
        qs = questionnaire.questions.prefetch_related('choices').order_by('order', 'id')
        return Response(QuestionnaireQuestionSerializer(qs, many=True).data)


class QuestionnaireQuestionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = QuestionnaireQuestionSerializer
    http_method_names = ['get', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return QuestionnaireQuestion.objects.none()
        return QuestionnaireQuestion.objects.filter(
            questionnaire__user=self.request.user
        ).prefetch_related('choices').select_related('questionnaire')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        if self.detail and self.request.method in ('PUT', 'PATCH'):
            obj = self.get_object()
            ctx['questionnaire'] = obj.questionnaire
        return ctx

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.answers.exists():
            instance.is_active = False
            instance.save(update_fields=['is_active', 'updated_at'])
            return Response(
                {
                    'detail': 'Question désactivée (des réponses existent).',
                    'question': QuestionnaireQuestionSerializer(instance).data,
                },
                status=status.HTTP_200_OK,
            )
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class QuestionnaireAnswersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        scope = request.query_params.get('scope')
        if scope not in ('day', 'position'):
            return Response(
                {'scope': 'Paramètre scope=day|position requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        questionnaire = Questionnaire.get_or_create_for_scope(request.user, scope)
        questions_qs = (
            questionnaire.questions.filter(is_active=True)
            .prefetch_related('choices')
            .order_by('order', 'id')
        )

        answers_qs = QuestionnaireAnswer.objects.none()
        if scope == 'day':
            date = request.query_params.get('date')
            if not date:
                return Response(
                    {'date': 'Paramètre date requis pour scope=day.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            account = request.query_params.get('trading_account')
            answers_qs = QuestionnaireAnswer.objects.filter(
                user=request.user,
                question__questionnaire=questionnaire,
                date=date,
                trade__isnull=True,
            )
            if account:
                answers_qs = answers_qs.filter(trading_account_id=account)
            else:
                answers_qs = answers_qs.filter(trading_account__isnull=True)

            # Inclure aussi les questions inactives qui ont déjà une réponse ce jour-là
            answered_question_ids = list(answers_qs.values_list('question_id', flat=True))
            questions_qs = (
                questionnaire.questions.filter(is_active=True)
                | questionnaire.questions.filter(id__in=answered_question_ids)
            ).prefetch_related('choices').distinct().order_by('order', 'id')
        else:
            trade_id = request.query_params.get('trade')
            if not trade_id:
                return Response(
                    {'trade': 'Paramètre trade requis pour scope=position.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            trade = TopStepTrade.objects.filter(pk=trade_id, user=request.user).first()
            if not trade:
                return Response(
                    {'trade': 'Trade introuvable.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            answers_qs = QuestionnaireAnswer.objects.filter(
                user=request.user,
                question__questionnaire=questionnaire,
                trade=trade,
            )
            answered_question_ids = list(answers_qs.values_list('question_id', flat=True))
            questions_qs = (
                questionnaire.questions.filter(is_active=True)
                | questionnaire.questions.filter(id__in=answered_question_ids)
            ).prefetch_related('choices').distinct().order_by('order', 'id')

        return Response(
            {
                'scope': scope,
                'questionnaire_id': questionnaire.id,
                'questions': QuestionnaireQuestionSerializer(questions_qs, many=True).data,
                'answers': QuestionnaireAnswerSerializer(answers_qs, many=True).data,
            }
        )

    def put(self, request):
        """Alias non utilisé — bulk est sur /answers/bulk/."""
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)


@api_view(['PUT'])
@permission_classes([permissions.IsAuthenticated])
def answers_bulk(request):
    serializer = BulkAnswersSerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    answers = serializer.save()
    return Response(
        {
            'answers': QuestionnaireAnswerSerializer(answers, many=True).data,
        }
    )


@transaction.atomic
def clone_template_to_questionnaire(template: QuestionTemplate, questionnaire: Questionnaire):
    max_order = questionnaire.questions.aggregate(m=Max('order'))['m']
    question = QuestionnaireQuestion.objects.create(
        questionnaire=questionnaire,
        source_template=template,
        label=template.label,
        help_text=template.help_text,
        answer_type=template.answer_type,
        config=template.config if isinstance(template.config, dict) else {},
        required=False,
        order=(max_order or 0) + 1,
        is_active=True,
    )
    for choice in template.choices.order_by('order', 'id'):
        QuestionnaireQuestionChoice.objects.create(
            question=question,
            label=choice.label,
            order=choice.order,
        )
    return question
