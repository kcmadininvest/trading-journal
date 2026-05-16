from django.urls import path

from .views import IntegrationDetailView, IntegrationListView, IntegrationTestConnectionView

app_name = 'integrations'

urlpatterns = [
    path('', IntegrationListView.as_view(), name='integration_list'),
    path('<str:provider>/', IntegrationDetailView.as_view(), name='integration_detail'),
    path(
        '<str:provider>/test-connection/',
        IntegrationTestConnectionView.as_view(),
        name='integration_test_connection',
    ),
]
