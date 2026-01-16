from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views

app_name = 'daily_journal'

router = DefaultRouter()
router.register(r'entries', views.DailyJournalEntryViewSet, basename='daily-journal-entry')

urlpatterns = [
    path('', include(router.urls)),
]
