from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'daily_journal'

router = DefaultRouter()
router.register(r'entries', views.DailyJournalEntryViewSet, basename='daily-journal-entry')

urlpatterns = [
    path(
        'journal-images/<int:pk>/',
        views.serve_journal_image_file,
        name='daily-journal-image-file',
    ),
    path('', include(router.urls)),
]
