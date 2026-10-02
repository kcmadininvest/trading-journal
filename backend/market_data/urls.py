from django.urls import path

from market_data.views import (
    BarsCsvExportView,
    BarsJsonView,
    ContractListView,
    CoverageListView,
    DownloadJobDetailView,
    DownloadJobIssuesView,
    DownloadJobListCreateView,
    InstrumentAvailableSessionsView,
    InstrumentListView,
    InstrumentSessionTimeframesView,
    InstrumentTimeframesView,
    QualityIssueListView,
    SyncHealthView,
    SyncRunListView,
    SyncSettingsRunNowView,
    SyncSettingsView,
)

app_name = 'market_data'

urlpatterns = [
    path('instruments/', InstrumentListView.as_view(), name='instruments'),
    path(
        'instruments/<str:instrument>/timeframes/',
        InstrumentTimeframesView.as_view(),
        name='instrument_timeframes',
    ),
    path(
        'instruments/<str:instrument>/available-sessions/',
        InstrumentAvailableSessionsView.as_view(),
        name='instrument_available_sessions',
    ),
    path(
        'instruments/<str:instrument>/session-timeframes/',
        InstrumentSessionTimeframesView.as_view(),
        name='instrument_session_timeframes',
    ),
    path('contracts/', ContractListView.as_view(), name='contracts'),
    path('coverage/', CoverageListView.as_view(), name='coverage'),
    path('quality-issues/', QualityIssueListView.as_view(), name='quality_issues'),
    path('bars/', BarsJsonView.as_view(), name='bars_json'),
    path('bars/export/', BarsCsvExportView.as_view(), name='bars_csv_export'),
    path('downloads/', DownloadJobListCreateView.as_view(), name='downloads'),
    path('downloads/<int:job_id>/', DownloadJobDetailView.as_view(), name='download_detail'),
    path('downloads/<int:job_id>/issues/', DownloadJobIssuesView.as_view(), name='download_issues'),
    path('sync-settings/', SyncSettingsView.as_view(), name='sync_settings'),
    path('sync-settings/run-now/', SyncSettingsRunNowView.as_view(), name='sync_settings_run_now'),
    path('sync-runs/', SyncRunListView.as_view(), name='sync_runs'),
    path('sync-health/', SyncHealthView.as_view(), name='sync_health'),
]
