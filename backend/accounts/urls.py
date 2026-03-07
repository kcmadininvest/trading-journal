from django.urls import path, include
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

app_name = 'accounts'

urlpatterns = [
    # Authentification
    path('auth/login/', views.CustomTokenObtainPairView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/register/', views.UserRegistrationView.as_view(), name='register'),
    
    # Activation de compte
    path('auth/activate/<uuid:token>/', views.AccountActivationView.as_view(), name='activate_account'),
    path('auth/resend-activation/', views.ResendActivationEmailView.as_view(), name='resend_activation'),
    
    # Profil utilisateur
    path('profile/', views.UserProfileView.as_view(), name='user_profile'),
    path('profile/change-password/', views.PasswordChangeView.as_view(), name='change_password'),
    path('permissions/', views.user_permissions_view, name='user_permissions'),
    
    # Préférences utilisateur
    path('preferences/', views.UserPreferencesView.as_view(), name='user_preferences'),
    
    # Gestion de session et déconnexion automatique
    path('session/info/', views.session_info, name='session_info'),
    path('session/extend/', views.extend_session, name='extend_session'),
    path('sessions/', views.ActiveSessionsView.as_view(), name='active_sessions'),
    
    # Historique et données
    path('login-history/', views.LoginHistoryView.as_view(), name='login_history'),
    path('export-data/', views.DataExportView.as_view(), name='export_data'),
    
    # Administration (admin seulement)
    path('admin/users/', views.AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/<int:id>/', views.AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/users/<int:id>/deletion-preview/', views.AdminUserDeletionPreviewView.as_view(), name='admin_user_deletion_preview'),
    path('admin/users/bulk-delete/', views.AdminBulkDeleteUsersView.as_view(), name='admin_bulk_delete_users'),
    path('admin/stats/', views.admin_stats_view, name='admin_stats'),
    path('admin/system/stats/', views.SystemStatsView.as_view(), name='system_stats'),
    path('admin/system/backup/', views.create_system_backup, name='create_system_backup'),
    path('admin/system/clean-logs/', views.clean_system_logs, name='clean_system_logs'),
    path('admin/system/check-integrity/', views.check_system_integrity, name='check_system_integrity'),
    
    # Contact
    path('contact/', views.ContactView.as_view(), name='contact'),
]