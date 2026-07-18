from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from . import questionnaire_views

app_name = 'daily_journal'

router = DefaultRouter()
router.register(r'entries', views.DailyJournalEntryViewSet, basename='daily-journal-entry')
router.register(
    r'question-templates',
    questionnaire_views.QuestionTemplateViewSet,
    basename='question-template',
)
router.register(
    r'questionnaires',
    questionnaire_views.QuestionnaireViewSet,
    basename='questionnaire',
)
router.register(
    r'questionnaire-questions',
    questionnaire_views.QuestionnaireQuestionViewSet,
    basename='questionnaire-question',
)

urlpatterns = [
    path(
        'journal-images/<int:pk>/',
        views.serve_journal_image_file,
        name='daily-journal-image-file',
    ),
    path(
        'answers/',
        questionnaire_views.QuestionnaireAnswersView.as_view(),
        name='questionnaire-answers',
    ),
    path(
        'answers/bulk/',
        questionnaire_views.answers_bulk,
        name='questionnaire-answers-bulk',
    ),
    path('', include(router.urls)),
]
