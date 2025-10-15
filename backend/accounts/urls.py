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
    
    # Profil utilisateur
    path('profile/', views.UserProfileView.as_view(), name='user_profile'),
    path('profile/change-password/', views.PasswordChangeView.as_view(), name='change_password'),
    path('permissions/', views.user_permissions_view, name='user_permissions'),
    
    # Gestion de session et déconnexion automatique
    path('session/info/', views.session_info, name='session_info'),
    path('session/extend/', views.extend_session, name='extend_session'),
    
    # Administration (admin seulement)
    path('admin/users/', views.AdminUserListView.as_view(), name='admin_user_list'),
    path('admin/users/<int:id>/', views.AdminUserDetailView.as_view(), name='admin_user_detail'),
    path('admin/stats/', views.admin_stats_view, name='admin_stats'),
    
    # Django-allauth URLs (pour l'interface web si nécessaire)
    path('allauth/', include('allauth.urls')),
]


