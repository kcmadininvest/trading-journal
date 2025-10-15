from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.db.models import Q
from rolepermissions.decorators import has_permission_decorator
from rolepermissions.checkers import has_permission

from .models import User
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
    CustomTokenObtainPairSerializer
)


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vue personnalisée pour l'obtention des tokens JWT avec gestion de session
    """
    serializer_class = CustomTokenObtainPairSerializer


class UserRegistrationView(APIView):
    """
    Vue pour l'inscription des utilisateurs
    """
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'message': 'Utilisateur créé avec succès',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserProfileSerializer(user).data
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(APIView):
    """
    Vue pour récupérer, mettre à jour et supprimer le profil utilisateur
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        from .serializers import UserFullUpdateSerializer
        serializer = UserFullUpdateSerializer(request.user, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Profil mis à jour avec succès',
                'user': UserProfileSerializer(request.user).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request):
        """
        Supprimer définitivement le compte utilisateur et toutes les données associées
        """
        try:
            user = request.user
            
            # Supprimer tous les modèles associés à l'utilisateur
            from trades.models import TopStepTrade, TopStepImportLog, TradeStrategy
            
            # Supprimer les stratégies de trades (doit être fait avant les trades)
            TradeStrategy.objects.filter(user=user).delete()
            
            # Supprimer tous les trades associés à l'utilisateur
            TopStepTrade.objects.filter(user=user).delete()
            
            # Supprimer les logs d'import
            TopStepImportLog.objects.filter(user=user).delete()
            
            # Supprimer l'utilisateur (cela devrait supprimer en cascade le reste)
            user.delete()
            
            return Response({
                'message': 'Compte supprimé avec succès'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': f'Erreur lors de la suppression du compte: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class PasswordChangeView(APIView):
    """
    Vue pour le changement de mot de passe
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Mot de passe modifié avec succès'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    """
    Vue pour la déconnexion avec blacklist des tokens
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            # Récupérer le token d'accès depuis l'en-tête Authorization
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                access_token_str = auth_header.split(' ')[1]
                
                try:
                    # Blacklister le token d'accès manuellement
                    access_token = AccessToken(access_token_str)
                    jti = access_token.get('jti')
                    
                    if jti:
                        # Créer une entrée OutstandingToken si elle n'existe pas
                        from datetime import datetime
                        
                        # Convertir les timestamps en datetime
                        iat_timestamp = access_token.get('iat')
                        exp_timestamp = access_token.get('exp')
                        
                        created_at = datetime.fromtimestamp(iat_timestamp) if iat_timestamp else datetime.now()
                        expires_at = datetime.fromtimestamp(exp_timestamp) if exp_timestamp else datetime.now()
                        
                        outstanding_token, created = OutstandingToken.objects.get_or_create(
                            jti=jti,
                            defaults={
                                'user': request.user,
                                'token': access_token_str,
                                'created_at': created_at,
                                'expires_at': expires_at
                            }
                        )
                        
                        # Créer une entrée BlacklistedToken
                        BlacklistedToken.objects.get_or_create(token=outstanding_token)
                        
                except Exception as e:
                    print(f"Erreur lors de la blacklist du token d'accès: {e}")
            
            # Essayer de récupérer le refresh token depuis le body
            refresh_token = request.data.get("refresh")
            
            if refresh_token:
                try:
                    # Blacklister le refresh token
                    token = RefreshToken(refresh_token)
                    token.blacklist()
                except Exception as e:
                    print(f"Erreur lors de la blacklist du refresh token: {e}")
            
            return Response({'message': 'Déconnexion réussie - Tokens blacklistés'})
                
        except Exception as e:
            print(f"Erreur générale lors de la déconnexion: {e}")
            # En cas d'erreur, confirmer quand même la déconnexion côté frontend
            return Response({'message': 'Déconnexion réussie'})


# Vues Admin
class AdminUserListView(generics.ListAPIView):
    """
    Vue pour lister tous les utilisateurs (admin seulement)
    """
    serializer_class = AdminUserListSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        if not has_permission(self.request.user, 'view_all_users'):
            return User.objects.none()
        return User.objects.all().order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        if not has_permission(request.user, 'view_all_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().list(request, *args, **kwargs)


class AdminUserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Vue pour gérer un utilisateur spécifique (admin seulement)
    """
    serializer_class = AdminUserUpdateSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'id'
    
    def get_queryset(self):
        if not has_permission(self.request.user, 'view_all_users'):
            return User.objects.none()
        return User.objects.all()
    
    def retrieve(self, request, *args, **kwargs):
        if not has_permission(request.user, 'view_all_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().retrieve(request, *args, **kwargs)
    
    def update(self, request, *args, **kwargs):
        if not has_permission(request.user, 'change_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().update(request, *args, **kwargs)
    
    def destroy(self, request, *args, **kwargs):
        if not has_permission(request.user, 'delete_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def user_permissions_view(request):
    """
    Vue pour récupérer les permissions de l'utilisateur connecté
    """
    user = request.user
    permissions_list = []
    
    # Récupérer les permissions basées sur le rôle
    if user.is_admin:
        permissions_list = [
            'view_all_users', 'add_users', 'change_users', 'delete_users',
            'view_all_trades', 'change_all_trades', 'delete_all_trades',
            'view_system_statistics', 'manage_system_settings',
            'view_admin_panel', 'export_data', 'manage_backups'
        ]
    else:
        permissions_list = [
            'view_own_trades', 'add_own_trades', 'change_own_trades',
            'delete_own_trades', 'view_own_profile', 'change_own_profile',
            'view_own_statistics'
        ]
    
    return Response({
        'user_id': user.id,
        'role': user.role,
        'permissions': permissions_list,
        'is_admin': user.is_admin
    })


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def admin_stats_view(request):
    """
    Vue pour les statistiques administrateur
    """
    if not has_permission(request.user, 'view_system_statistics'):
        return Response(
            {'error': 'Permission refusée'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    stats = {
        'total_users': User.objects.count(),
        'active_users': User.objects.filter(is_active=True).count(),
        'admin_users': User.objects.filter(role='admin').count(),
        'regular_users': User.objects.filter(role='user').count(),
        'verified_users': User.objects.filter(is_verified=True).count(),
        # Ces statistiques seront complétées quand le modèle Trade sera créé
        'total_trades': 0,
        'trades_this_month': 0,
    }
    
    return Response(stats)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def session_info(request):
    """
    Retourne les informations de session de l'utilisateur connecté
    """
    from rest_framework_simplejwt.tokens import RefreshToken
    from datetime import datetime, timedelta
    
    try:
        # Récupérer le token de rafraîchissement depuis les cookies ou headers
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            # Essayer de récupérer depuis les headers
            auth_header = request.META.get('HTTP_AUTHORIZATION', '')
            if auth_header.startswith('Bearer '):
                # Pour l'instant, on utilise le token d'accès pour calculer l'expiration
                access_token = auth_header.split(' ')[1]
                # Décoder le token pour récupérer l'expiration
                from rest_framework_simplejwt.tokens import AccessToken
                try:
                    token = AccessToken(access_token)
                    exp_timestamp = token['exp']
                    exp_datetime = datetime.fromtimestamp(exp_timestamp)
                    
                    # Calculer les temps restants
                    now = datetime.now()
                    time_remaining = int((exp_datetime - now).total_seconds())
                    warning_time_remaining = max(0, time_remaining - 300)  # 5 minutes avant expiration
                    
                    return Response({
                        'access_token_expires_at': exp_datetime.isoformat(),
                        'refresh_token_expires_at': (exp_datetime + timedelta(hours=1, minutes=45)).isoformat(),  # Approximation
                        'session_expires_at': (exp_datetime + timedelta(hours=1, minutes=45)).isoformat(),
                        'auto_logout_warning_at': (exp_datetime - timedelta(minutes=5)).isoformat(),
                        'time_remaining': max(0, time_remaining),
                        'warning_time_remaining': max(0, warning_time_remaining),
                        'is_expired': time_remaining <= 0,
                        'needs_refresh': time_remaining <= 300,  # Besoin de rafraîchir si moins de 5 minutes
                    })
                except Exception:
                    pass
        
        return Response({
            'error': 'Token non valide ou expiré'
        }, status=status.HTTP_401_UNAUTHORIZED)
        
    except Exception as e:
        return Response({
            'error': 'Erreur lors de la récupération des informations de session'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def extend_session(request):
    """
    Étend la session de l'utilisateur en rafraîchissant les tokens
    """
    from rest_framework_simplejwt.tokens import RefreshToken
    from datetime import datetime, timedelta
    
    try:
        # Créer de nouveaux tokens pour l'utilisateur
        refresh = RefreshToken.for_user(request.user)
        access_token = refresh.access_token
        
        # Calculer les nouveaux temps d'expiration
        now = datetime.now()
        access_expiry = now + timedelta(minutes=15)
        refresh_expiry = now + timedelta(hours=2)
        
        # Calculer le temps restant en secondes
        time_remaining = int((refresh_expiry - now).total_seconds())
        warning_time_remaining = max(0, time_remaining - 300)  # 5 minutes avant expiration
        
        return Response({
            'access': str(access_token),
            'refresh': str(refresh),
            'session_info': {
                'access_token_expires_at': access_expiry.isoformat(),
                'refresh_token_expires_at': refresh_expiry.isoformat(),
                'session_expires_at': refresh_expiry.isoformat(),
                'auto_logout_warning_at': (refresh_expiry - timedelta(minutes=5)).isoformat(),
                'time_remaining': time_remaining,
                'warning_time_remaining': warning_time_remaining,
                'is_expired': False,
                'needs_refresh': False,
            },
            'message': 'Session étendue avec succès'
        })
        
    except Exception as e:
        return Response({
            'error': 'Erreur lors de l\'extension de la session'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
