from rest_framework import status, generics, permissions
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.conf import settings
from rolepermissions.decorators import has_permission_decorator
from rolepermissions.checkers import has_permission
from django.core.mail import send_mail
from typing import cast
import logging

logger = logging.getLogger(__name__)
security_logger = logging.getLogger('security')

from .models import User, UserPreferences, LoginHistory, EmailActivationToken
from .utils import send_activation_email, create_activation_token
from .throttling import LoginThrottle, RegisterThrottle, EmailBasedRegisterThrottle, ActivationThrottle, PasswordResetThrottle
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer,
    UserUpdateSerializer,
    UserFullUpdateSerializer,
    PasswordChangeSerializer,
    AdminUserListSerializer,
    AdminUserUpdateSerializer,
    CustomTokenObtainPairSerializer,
    UserPreferencesSerializer,
    ActiveSessionSerializer,
    LoginHistorySerializer
)

# Imports des modèles trades pour éviter les erreurs de linting
try:
    from trades.models import TopStepTrade, TopStepImportLog, TradeStrategy, PositionStrategy, TradingAccount
except ImportError:
    # Les modèles trades n'existent pas encore
    TopStepTrade = TopStepImportLog = TradeStrategy = PositionStrategy = TradingAccount = None

def safe_count(model, user):
    """Compte les objets d'un modèle pour un utilisateur de manière sécurisée"""
    if model is None:
        return 0
    try:
        return model.objects.filter(user=user).count()
    except AttributeError:
        return 0

def safe_first(model, user, order_by):
    """Récupère le premier objet d'un modèle pour un utilisateur de manière sécurisée"""
    if model is None:
        return None
    try:
        return model.objects.filter(user=user).order_by(order_by).first()
    except AttributeError:
        return None


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Vue personnalisée pour l'obtention des tokens JWT avec gestion de session
    Protection contre les attaques par force brute avec rate limiting
    """
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginThrottle]
    
    def post(self, request, *args, **kwargs):
        """Enregistrer l'historique de connexion"""
        response = super().post(request, *args, **kwargs)
        
        # Enregistrer l'historique de connexion si la connexion a réussi
        if response.status_code == 200:
            try:
                # Récupérer l'utilisateur depuis la réponse ou le serializer
                response_data = response.data if hasattr(response, 'data') else None
                user_data = response_data.get('user', {}) if response_data else {}
                user_id = user_data.get('id')
                
                if not user_id:
                    # Essayer de récupérer par email
                    email = getattr(request, 'data', {}).get('email') if hasattr(request, 'data') else None
                    if email:
                        try:
                            user = User.objects.get(email=email)
                            user_id = user.id
                        except Exception:  # User.DoesNotExist ou autre exception
                            pass
                
                if user_id:
                    try:
                        user = User.objects.get(id=user_id)
                        LoginHistory.objects.create(
                            user=user,
                            ip_address=self._get_client_ip(request),
                            user_agent=request.META.get('HTTP_USER_AGENT', ''),
                            success=True
                        )
                    except Exception as e:  # User.DoesNotExist ou autre exception
                        # Logger l'erreur pour debug mais ne pas faire échouer la connexion
                        import logging
                        logger = logging.getLogger(__name__)
                        logger.warning(f"Erreur lors de l'enregistrement de l'historique de connexion: {str(e)}")
            except Exception as e:
                # Ne pas faire échouer la connexion si l'enregistrement de l'historique échoue
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Erreur lors de l'enregistrement de l'historique de connexion: {str(e)}")
        else:
            # Enregistrer les tentatives de connexion échouées avec logging détaillé
            try:
                email = getattr(request, 'data', {}).get('email') if hasattr(request, 'data') else None
                ip_address = self._get_client_ip(request)
                user_agent = request.META.get('HTTP_USER_AGENT', '')
                
                # Logger la tentative échouée
                security_logger.warning(
                    f"Tentative de connexion échouée - Email: {email}, IP: {ip_address}, "
                    f"User-Agent: {user_agent}, Status: {response.status_code}"
                )
                
                if email:
                    try:
                        user = User.objects.get(email=email)
                        LoginHistory.objects.create(
                            user=user,
                            ip_address=ip_address,
                            user_agent=user_agent,
                            success=False
                        )
                    except Exception:  # User.DoesNotExist ou autre exception
                        # Logger les tentatives avec des emails inexistants (possible reconnaissance)
                        security_logger.warning(
                            f"Tentative de connexion avec email inexistant - Email: {email}, IP: {ip_address}"
                        )
            except Exception as e:
                security_logger.error(f"Erreur lors de l'enregistrement de la tentative de connexion échouée: {str(e)}")
        
        return response
    
    def _get_client_ip(self, request):
        """Récupérer l'adresse IP du client"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class UserRegistrationView(APIView):
    """
    Vue pour l'inscription des utilisateurs
    Le compte est désactivé par défaut et nécessite une activation par email
    Protection contre le spam d'inscriptions avec rate limiting basé sur l'email
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [EmailBasedRegisterThrottle]
    
    def post(self, request):
        try:
            serializer = UserRegistrationSerializer(data=request.data)
            if serializer.is_valid():
                user = cast(User, serializer.save())
                
                # Détecter la langue depuis les headers ou les données de la requête
                language = None
                if 'language' in request.data:
                    language = request.data.get('language')
                elif 'Accept-Language' in request.headers:
                    # Extraire la langue principale depuis Accept-Language
                    accept_lang = request.headers.get('Accept-Language', '').split(',')[0].split('-')[0].lower()
                    if accept_lang in ['fr', 'en', 'es', 'de', 'it', 'pt', 'ja', 'ko', 'zh']:
                        language = accept_lang
                
                # Créer un token d'activation
                try:
                    activation_token = create_activation_token(user)
                    
                    # Envoyer l'email d'activation avec la langue détectée
                    email_sent = send_activation_email(user, activation_token, language=language or 'fr')
                    
                    if not email_sent:
                        # Si l'email n'a pas pu être envoyé, on retourne quand même un succès
                        # mais avec un message d'avertissement
                        return Response({
                            'message': 'Compte créé avec succès, mais l\'email d\'activation n\'a pas pu être envoyé. Veuillez contacter le support.',
                            'user': UserProfileSerializer(user).data,
                            'email_sent': False,
                            'is_active': False
                        }, status=status.HTTP_201_CREATED)
                    
                    return Response({
                        'message': 'Compte créé avec succès. Un email d\'activation a été envoyé à votre adresse email.',
                        'user': UserProfileSerializer(user).data,
                        'email_sent': True,
                        'is_active': False
                    }, status=status.HTTP_201_CREATED)
                except Exception as e:
                    # Logger l'erreur pour le debugging
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.error(f"Erreur lors de la création du token d'activation ou de l'envoi de l'email: {str(e)}")
                    
                    # Retourner quand même un succès si l'utilisateur a été créé
                    return Response({
                        'message': 'Compte créé avec succès, mais l\'email d\'activation n\'a pas pu être envoyé. Veuillez contacter le support.',
                        'user': UserProfileSerializer(user).data,
                        'email_sent': False,
                        'is_active': False
                    }, status=status.HTTP_201_CREATED)
            
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            # Logger l'erreur détaillée côté serveur pour le debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de l'inscription: {str(e)}", exc_info=True)
            
            # Retourner une réponse d'erreur JSON générique (ne jamais exposer les détails)
            return Response({
                'error': 'Une erreur est survenue lors de la création du compte. Veuillez réessayer plus tard ou contacter le support.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AccountActivationView(APIView):
    """
    Vue pour activer un compte utilisateur via le token d'activation
    Protection contre les tentatives d'activation abusives avec rate limiting
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ActivationThrottle]
    
    def post(self, request, token=None):
        """
        Active un compte utilisateur avec un token d'activation
        """
        if not token:
            return Response(
                {'error': 'Token d\'activation requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Récupérer le token d'activation
            activation_token = EmailActivationToken.objects.get(token=token)
            user = activation_token.user
            
            # Vérifier si le compte est déjà activé
            if user.is_active:
                return Response(
                    {
                        'message': 'Ce compte est déjà activé. Vous pouvez vous connecter.',
                        'already_activated': True,
                        'user': UserProfileSerializer(user).data
                    },
                    status=status.HTTP_200_OK
                )
            
            # Vérifier si le token est valide
            if not activation_token.is_valid():
                if activation_token.is_used:
                    # Si le token est utilisé mais le compte n'est pas actif, il y a un problème
                    # Mais normalement, si le token est utilisé, le compte devrait être actif
                    return Response(
                        {'error': 'Ce lien d\'activation a déjà été utilisé'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                elif activation_token.is_expired():
                    # Vérifier si le token expiré peut être utilisé quand même
                    if activation_token.can_be_used_expired():
                        # Le token est expiré mais peut être utilisé (moins de 30 jours, non utilisé, compte inactif)
                        # On permet l'activation
                        pass  # Continuer avec l'activation ci-dessous
                    else:
                        # Token trop ancien ou conditions non remplies, proposer de renvoyer un nouvel email
                        return Response(
                            {
                                'error': 'Ce lien d\'activation a expiré',
                                'can_resend': True,
                                'user_id': activation_token.user.id
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )
            
            # Activer le compte
            user.is_active = True
            user.is_verified = True
            user.save()
            
            # Marquer le token comme utilisé
            activation_token.is_used = True
            activation_token.save()
            
            return Response({
                'message': 'Compte activé avec succès. Vous pouvez maintenant vous connecter.',
                'already_activated': False,
                'user': UserProfileSerializer(user).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:  # EmailActivationToken.DoesNotExist ou autre exception
            import logging
            logger = logging.getLogger(__name__)
            # Si c'est DoesNotExist, retourner 404, sinon 500
            if 'DoesNotExist' in str(type(e).__name__):
                return Response(
                    {'error': 'Token d\'activation invalide'},
                    status=status.HTTP_404_NOT_FOUND
                )
            logger.error(f"Erreur lors de l'activation du compte: {str(e)}")
            return Response(
                {'error': 'Une erreur est survenue lors de l\'activation du compte'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request, token=None):
        """
        Méthode GET pour la vérification du token (optionnel)
        """
        if not token:
            return Response(
                {'error': 'Token d\'activation requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            activation_token = EmailActivationToken.objects.get(token=token)
            
            if not activation_token.is_valid():
                if activation_token.is_used:
                    return Response(
                        {'valid': False, 'error': 'Ce lien d\'activation a déjà été utilisé'},
                        status=status.HTTP_200_OK
                    )
                elif activation_token.is_expired():
                    # Vérifier si le token expiré peut être utilisé quand même
                    if activation_token.can_be_used_expired():
                        # Token expiré mais utilisable (moins de 30 jours)
                        return Response({
                            'valid': True,
                            'message': 'Token expiré mais utilisable',
                            'expired_but_usable': True
                        }, status=status.HTTP_200_OK)
                    else:
                        # Token trop ancien
                        return Response(
                            {
                                'valid': False,
                                'error': 'Ce lien d\'activation a expiré',
                                'can_resend': True,
                                'user_id': activation_token.user.id
                            },
                            status=status.HTTP_200_OK
                        )
            
            return Response({
                'valid': True,
                'message': 'Token valide'
            }, status=status.HTTP_200_OK)
            
        except Exception:  # EmailActivationToken.DoesNotExist
            return Response(
                {'valid': False, 'error': 'Token d\'activation invalide'},
                status=status.HTTP_200_OK
            )


class ResendActivationEmailView(APIView):
    """
    Vue pour renvoyer un email d'activation
    Protection contre les abus avec rate limiting
    """
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ActivationThrottle]
    
    def post(self, request):
        """
        Renvoie un email d'activation à l'utilisateur
        """
        email = request.data.get('email')
        user_id = request.data.get('user_id')
        
        if not email and not user_id:
            return Response(
                {'error': 'Email ou ID utilisateur requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Récupérer l'utilisateur
            if user_id:
                user = User.objects.get(id=user_id)
            else:
                user = User.objects.get(email=email)
            
            # Vérifier que le compte n'est pas déjà activé
            if user.is_active:
                return Response(
                    {'error': 'Ce compte est déjà activé'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Créer un nouveau token d'activation
            activation_token = create_activation_token(user)
            
            # Envoyer l'email d'activation
            email_sent = send_activation_email(user, activation_token)
            
            if not email_sent:
                return Response(
                    {'error': 'L\'email d\'activation n\'a pas pu être envoyé. Veuillez réessayer plus tard.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
            
            return Response({
                'message': 'Un nouvel email d\'activation a été envoyé à votre adresse email.'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:  # User.DoesNotExist ou autre exception
            # Ne pas révéler si l'email existe ou non pour des raisons de sécurité
            # Si c'est User.DoesNotExist, on retourne le même message pour la sécurité
            if 'DoesNotExist' in str(type(e).__name__):
                return Response({
                    'message': 'Si ce compte existe et n\'est pas activé, un email d\'activation a été envoyé.'
                }, status=status.HTTP_200_OK)
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors du renvoi de l'email d'activation: {str(e)}")
            return Response(
                {'error': 'Une erreur est survenue. Veuillez réessayer plus tard.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
        # Autoriser la modification de l'email pour les utilisateurs normaux
        update_data = request.data.copy()
        if 'email' in update_data and request.user.role == 'user':
            # Vérifier que l'email n'est pas déjà utilisé
            email = update_data['email']
            if User.objects.filter(email=email).exclude(id=request.user.id).exists():
                return Response(
                    {'email': ['Cet email est déjà utilisé par un autre compte.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            request.user.email = email
            request.user.save()
            update_data.pop('email', None)
        
        serializer = UserFullUpdateSerializer(request.user, data=update_data, partial=True, context={'request': request})
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
            # Logger l'erreur détaillée côté serveur
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la suppression du compte: {str(e)}", exc_info=True)
            
            # Retourner une erreur générique (ne jamais exposer les détails)
            return Response({
                'error': 'Une erreur est survenue lors de la suppression du compte. Veuillez réessayer plus tard ou contacter le support.'
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
    Permet la déconnexion même si le token est expiré
    """
    permission_classes = []  # Pas d'authentification requise pour la déconnexion
    
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
                        
                        # Essayer de récupérer l'utilisateur depuis le token
                        user_id = access_token.get('user_id')
                        user = None
                        if user_id:
                            try:
                                from django.contrib.auth import get_user_model
                                UserModel = get_user_model()
                                if UserModel:
                                    user = UserModel.objects.get(id=user_id)
                            except Exception:
                                pass
                        
                        outstanding_token, created = OutstandingToken.objects.get_or_create(
                            jti=jti,
                            defaults={
                                'user': user,
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
        # Exclure les utilisateurs anonymes et invalides
        return User.objects.exclude(
            username='AnonymousUser'
        ).exclude(
            email='AnonymousUser'
        ).exclude(
            email__isnull=True
        ).exclude(
            email=''
        ).order_by('-created_at')
    
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
        
        # Récupérer l'utilisateur avant la mise à jour
        user = self.get_object()
        old_role = user.role
        
        # Effectuer la mise à jour
        response = super().update(request, *args, **kwargs)
        
        # Si le rôle a changé, mettre à jour les permissions django-role-permissions
        if response.status_code == 200 and 'role' in request.data:
            new_role = request.data['role']
            if old_role != new_role:
                try:
                    from accounts.roles import Admin, User as UserRole
                    
                    if new_role == 'admin':
                        Admin.assign_role_to_user(user)
                    else:
                        UserRole.assign_role_to_user(user)
                    
                    print(f"Permissions mises à jour pour {user.email}: {old_role} → {new_role}")
                except Exception as e:
                    print(f"Erreur lors de la mise à jour des permissions pour {user.email}: {e}")
        
        return response
    
    def destroy(self, request, *args, **kwargs):
        if not has_permission(request.user, 'delete_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Récupérer l'utilisateur à supprimer
        user_to_delete = self.get_object()
        
        # Empêcher l'auto-suppression
        if user_to_delete.id == request.user.id:
            return Response(
                {'error': 'Vous ne pouvez pas supprimer votre propre compte'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Compter les données à supprimer
        
        stats = {
            'user_email': user_to_delete.email,
            'trading_accounts': TradingAccount.objects.filter(user=user_to_delete).count(),
            'trades': TopStepTrade.objects.filter(user=user_to_delete).count(),
            'import_logs': TopStepImportLog.objects.filter(user=user_to_delete).count(),
            'trade_strategies': TradeStrategy.objects.filter(user=user_to_delete).count(),
            'position_strategies': PositionStrategy.objects.filter(user=user_to_delete).count(),
        }
        
        try:
            # Supprimer toutes les données associées (cascade automatique)
            user_to_delete.delete()
            
            return Response({
                'message': f'Utilisateur {user_to_delete.email} supprimé avec succès',
                'deleted_data': stats
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            # Logger l'erreur détaillée côté serveur
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la suppression: {str(e)}", exc_info=True)
            
            # Retourner une erreur générique (ne jamais exposer les détails)
            return Response(
                {'error': 'Une erreur est survenue lors de la suppression. Veuillez réessayer plus tard ou contacter le support.'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    


class AdminUserDeletionPreviewView(APIView):
    """
    Vue pour l'aperçu des données qui seront supprimées avec un utilisateur
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, id=None):
        if not has_permission(request.user, 'delete_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_to_delete = get_object_or_404(User, id=id)
        
        # Compter toutes les données associées
        
        stats = {
            'user': {
                'id': user_to_delete.id,
                'email': user_to_delete.email,
                'first_name': user_to_delete.first_name,
                'last_name': user_to_delete.last_name,
                'role': user_to_delete.role,
                'is_active': user_to_delete.is_active,
                'created_at': user_to_delete.created_at,
                'last_login': user_to_delete.last_login,
            },
            'data_summary': {
                'trading_accounts': safe_count(TradingAccount, user_to_delete),
                'trades': safe_count(TopStepTrade, user_to_delete),
                'import_logs': safe_count(TopStepImportLog, user_to_delete),
                'trade_strategies': safe_count(TradeStrategy, user_to_delete),
                'position_strategies': safe_count(PositionStrategy, user_to_delete),
            },
            'recent_activity': {
                'last_trade': safe_first(TopStepTrade, user_to_delete, '-entered_at'),
                'last_import': safe_first(TopStepImportLog, user_to_delete, '-imported_at'),
            }
        }
        
        return Response(stats)


class AdminBulkDeleteUsersView(APIView):
    """
    Vue pour supprimer plusieurs utilisateurs en une fois (admin seulement)
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        if not has_permission(request.user, 'delete_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        user_ids = request.data.get('user_ids', [])
        if not user_ids:
            return Response(
                {'error': 'Aucun utilisateur spécifié'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Empêcher l'auto-suppression
        if request.user.id in user_ids:
            return Response(
                {'error': 'Vous ne pouvez pas supprimer votre propre compte'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        
        results = []
        errors = []
        
        for user_id in user_ids:
            try:
                user_to_delete = User.objects.filter(id=user_id).first()
                
                if not user_to_delete:
                    errors.append({
                        'user_id': user_id,
                        'error': 'Utilisateur non trouvé'
                    })
                    continue
                
                # Compter les données
                stats = {
                    'user_email': user_to_delete.email,
                    'trading_accounts': safe_count(TradingAccount, user_to_delete),
                    'trades': safe_count(TopStepTrade, user_to_delete),
                    'import_logs': safe_count(TopStepImportLog, user_to_delete),
                    'trade_strategies': safe_count(TradeStrategy, user_to_delete),
                    'position_strategies': safe_count(PositionStrategy, user_to_delete),
                }
                
                # Supprimer l'utilisateur et toutes ses données
                user_to_delete.delete()
                
                results.append({
                    'user_id': user_id,
                    'user_email': user_to_delete.email,
                    'status': 'deleted',
                    'deleted_data': stats
                })
                
            except Exception as e:
                # Logger l'erreur détaillée côté serveur
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Erreur lors de la suppression de l'utilisateur {user_id}: {str(e)}", exc_info=True)
                
                # Ajouter une erreur générique (ne jamais exposer les détails)
                errors.append({
                    'user_id': user_id,
                    'error': 'Une erreur est survenue lors de la suppression de cet utilisateur.'
                })
        
        return Response({
            'message': f'Suppression terminée: {len(results)} utilisateurs supprimés, {len(errors)} erreurs',
            'results': results,
            'errors': errors
        }, status=status.HTTP_200_OK)


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
                    exp_datetime = datetime.fromtimestamp(float(exp_timestamp))
                    
                    # Calculer les temps restants
                    now = datetime.now()
                    time_remaining = int((exp_datetime - now).total_seconds())
                    warning_time_remaining = max(0, time_remaining - 600)  # 10 minutes avant expiration
                    
                    return Response({
                        'access_token_expires_at': exp_datetime.isoformat(),
                        'refresh_token_expires_at': (exp_datetime + timedelta(hours=3)).isoformat(),  # Approximation
                        'session_expires_at': (exp_datetime + timedelta(hours=3)).isoformat(),
                        'auto_logout_warning_at': (exp_datetime - timedelta(minutes=10)).isoformat(),
                        'time_remaining': max(0, time_remaining),
                        'warning_time_remaining': max(0, warning_time_remaining),
                        'is_expired': time_remaining <= 0,
                        'needs_refresh': time_remaining <= 600,  # Besoin de rafraîchir si moins de 10 minutes
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
        access_expiry = now + timedelta(hours=1)
        refresh_expiry = now + timedelta(hours=4)
        
        # Calculer le temps restant en secondes
        time_remaining = int((refresh_expiry - now).total_seconds())
        warning_time_remaining = max(0, time_remaining - 600)  # 10 minutes avant expiration
        
        return Response({
            'access': str(access_token),
            'refresh': str(refresh),
            'session_info': {
                'access_token_expires_at': access_expiry.isoformat(),
                'refresh_token_expires_at': refresh_expiry.isoformat(),
                'session_expires_at': refresh_expiry.isoformat(),
                'auto_logout_warning_at': (refresh_expiry - timedelta(minutes=10)).isoformat(),
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


class SystemStatsView(APIView):
    """
    Vue pour récupérer les statistiques système (admin uniquement)
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        if not has_permission(request.user, 'view_all_users'):
            return Response(
                {'error': 'Permission refusée'}, 
                status=status.HTTP_403_FORBIDDEN
            )
        
        from datetime import datetime, timedelta
        import shutil
        import os
        
        try:
            # Utilisateurs actifs aujourd'hui (dernière connexion dans les dernières 24h)
            today = datetime.now().date()
            active_users_today = User.objects.filter(
                last_login__date=today
            ).count()
            
            # Total des utilisateurs
            total_users = User.objects.count()
            
            # Total des trades (à implémenter quand le modèle Trade sera créé)
            total_trades = 0  # Trade.objects.count() quand le modèle sera créé
            
            # Espace disque utilisé (approximation)
            try:
                total, used, free = shutil.disk_usage("/")
                disk_usage = f"{used // (1024**3)} GB / {total // (1024**3)} GB"
            except:
                disk_usage = "N/A"
            
            # Dernière sauvegarde (à implémenter)
            last_backup = None
            
            # Uptime système (approximation)
            try:
                with open('/proc/uptime', 'r') as f:
                    uptime_seconds = float(f.readline().split()[0])
                    uptime_hours = int(uptime_seconds // 3600)
                    uptime_days = uptime_hours // 24
                    uptime_hours = uptime_hours % 24
                    system_uptime = f"{uptime_days}j {uptime_hours}h"
            except:
                system_uptime = "N/A"
            
            return Response({
                'active_users_today': active_users_today,
                'total_users': total_users,
                'total_trades': total_trades,
                'disk_usage': disk_usage,
                'last_backup': last_backup,
                'system_uptime': system_uptime
            })
            
        except Exception as e:
            # Logger l'erreur détaillée côté serveur
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la récupération des statistiques: {str(e)}", exc_info=True)
            
            # Retourner une erreur générique (ne jamais exposer les détails)
            return Response({
                'error': 'Une erreur est survenue lors de la récupération des statistiques. Veuillez réessayer plus tard.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_system_backup(request):
    """
    Créer une sauvegarde du système (admin uniquement)
    """
    if not has_permission(request.user, 'view_all_users'):
        return Response(
            {'error': 'Permission refusée'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        # Simulation d'une sauvegarde (à implémenter selon vos besoins)
        import uuid
        backup_id = str(uuid.uuid4())[:8]
        
        # Ici vous pourriez implémenter la vraie logique de sauvegarde
        # Par exemple : dump de la base de données, sauvegarde des fichiers, etc.
        
        return Response({
            'message': f'Sauvegarde créée avec succès (ID: {backup_id})',
            'backup_id': backup_id
        })
        
    except Exception as e:
        # Logger l'erreur détaillée côté serveur
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erreur lors de la création de la sauvegarde: {str(e)}", exc_info=True)
        
        # Retourner une erreur générique (ne jamais exposer les détails)
        return Response({
            'error': 'Une erreur est survenue lors de la création de la sauvegarde. Veuillez réessayer plus tard.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def clean_system_logs(request):
    """
    Nettoyer les logs du système (admin uniquement)
    """
    if not has_permission(request.user, 'view_all_users'):
        return Response(
            {'error': 'Permission refusée'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        # Simulation du nettoyage des logs (à implémenter selon vos besoins)
        logs_cleaned = 0
        
        # Ici vous pourriez implémenter la vraie logique de nettoyage
        # Par exemple : suppression des anciens logs, rotation des fichiers, etc.
        
        return Response({
            'message': f'Nettoyage terminé. {logs_cleaned} logs supprimés.',
            'logs_cleaned': logs_cleaned
        })
        
    except Exception as e:
        # Logger l'erreur détaillée côté serveur
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erreur lors du nettoyage des logs: {str(e)}", exc_info=True)
        
        # Retourner une erreur générique (ne jamais exposer les détails)
        return Response({
            'error': 'Une erreur est survenue lors du nettoyage des logs. Veuillez réessayer plus tard.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def check_system_integrity(request):
    """
    Vérifier l'intégrité du système (admin uniquement)
    """
    if not has_permission(request.user, 'view_all_users'):
        return Response(
            {'error': 'Permission refusée'}, 
            status=status.HTTP_403_FORBIDDEN
        )
    
    try:
        # Simulation de la vérification d'intégrité (à implémenter selon vos besoins)
        issues_found = 0
        
        # Ici vous pourriez implémenter la vraie logique de vérification
        # Par exemple : vérification de la base de données, des fichiers, des permissions, etc.
        
        return Response({
            'message': f'Vérification terminée. {issues_found} problème(s) trouvé(s).',
            'issues_found': issues_found
        })
        
    except Exception as e:
        # Logger l'erreur détaillée côté serveur
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Erreur lors de la vérification d'intégrité: {str(e)}", exc_info=True)
        
        # Retourner une erreur générique (ne jamais exposer les détails)
        return Response({
            'error': 'Une erreur est survenue lors de la vérification d\'intégrité. Veuillez réessayer plus tard.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserPreferencesView(APIView):
    """
    Vue pour récupérer et mettre à jour les préférences utilisateur
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Récupérer les préférences de l'utilisateur"""
        preferences, created = UserPreferences.objects.get_or_create(user=request.user)
        serializer = UserPreferencesSerializer(preferences)
        return Response(serializer.data)
    
    def put(self, request):
        """Mettre à jour les préférences de l'utilisateur"""
        preferences, created = UserPreferences.objects.get_or_create(user=request.user)
        serializer = UserPreferencesSerializer(preferences, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({
                'message': 'Préférences mises à jour avec succès',
                'preferences': serializer.data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ActiveSessionsView(APIView):
    """
    Vue pour récupérer et gérer les sessions actives
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Récupérer toutes les sessions actives de l'utilisateur"""
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            from rest_framework_simplejwt.tokens import RefreshToken
            from datetime import datetime
            
            # OutstandingToken contient uniquement les refresh tokens
            # Récupérer le jti du refresh token actuel depuis le cookie/localStorage via le body
            # Pour cela, on va utiliser une approche différente : comparer les tokens par leur date de création récente
            
            # Récupérer tous les refresh tokens non expirés et non blacklistés de l'utilisateur
            from datetime import datetime
            now = datetime.now()
            outstanding_tokens = OutstandingToken.objects.filter(
                user=request.user,
                expires_at__gt=now
            ).select_related().order_by('-created_at')
            
            # Récupérer les jti des tokens blacklistés pour les exclure
            blacklisted_jtis = set(
                BlacklistedToken.objects.filter(
                    token__user=request.user,
                    token__expires_at__gt=now
                ).values_list('token__jti', flat=True)
            )
            
            sessions = []
            seen_jtis = set()  # Pour éviter les doublons
            
            for token in outstanding_tokens:
                # Vérifier si le token est blacklisté
                if token.jti in blacklisted_jtis:
                    continue
                
                # Éviter les doublons
                if token.jti in seen_jtis:
                    continue
                seen_jtis.add(token.jti)
                
                # Déterminer si c'est la session actuelle
                # On considère la session la plus récente comme la session actuelle
                # ou on vérifie si le token correspond au refresh token actuel
                is_current = len(sessions) == 0  # La première session (la plus récente) est la session actuelle
                
                sessions.append({
                    'jti': token.jti,
                    'created_at': token.created_at,
                    'expires_at': token.expires_at,
                    'is_current': is_current,
                    'device_info': getattr(token, 'device_info', None) or 'Unknown device'
                })
            
            # Marquer seulement la session la plus récente comme actuelle
            if sessions:
                for i, session in enumerate(sessions):
                    session['is_current'] = (i == 0)
            
            serializer = ActiveSessionSerializer(sessions, many=True)
            return Response(serializer.data)
            
        except Exception as e:
            # Logger l'erreur détaillée côté serveur
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la récupération des sessions: {str(e)}", exc_info=True)
            
            # Retourner une erreur générique (ne jamais exposer les détails)
            return Response({
                'error': 'Une erreur est survenue lors de la récupération des sessions. Veuillez réessayer plus tard.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """Déconnecter une session spécifique ou toutes les sessions"""
        try:
            from rest_framework_simplejwt.token_blacklist.models import OutstandingToken
            
            jti = request.data.get('jti')
            if jti:
                # Déconnecter une session spécifique
                try:
                    token = OutstandingToken.objects.get(jti=jti, user=request.user)
                    BlacklistedToken.objects.get_or_create(token=token)
                    return Response({'message': 'Session déconnectée avec succès'})
                except Exception:  # OutstandingToken.DoesNotExist
                    return Response(
                        {'error': 'Session non trouvée'}, 
                        status=status.HTTP_404_NOT_FOUND
                    )
            else:
                # Déconnecter toutes les sessions (y compris la session actuelle)
                # Blacklister tous les refresh tokens non expirés de l'utilisateur
                from datetime import datetime
                now = datetime.now()
                outstanding_tokens = OutstandingToken.objects.filter(
                    user=request.user,
                    expires_at__gt=now
                )
                
                count = 0
                for token in outstanding_tokens:
                    # Vérifier si le token n'est pas déjà blacklisté
                    if not BlacklistedToken.objects.filter(token=token).exists():
                        BlacklistedToken.objects.get_or_create(token=token)
                        count += 1
                
                return Response({
                    'message': f'{count} session(s) déconnectée(s) avec succès'
                })
                
        except Exception as e:
            # Logger l'erreur détaillée côté serveur
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la déconnexion: {str(e)}", exc_info=True)
            
            # Retourner une erreur générique (ne jamais exposer les détails)
            return Response({
                'error': 'Une erreur est survenue lors de la déconnexion. Veuillez réessayer plus tard.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class LoginHistoryView(APIView):
    """
    Vue pour récupérer l'historique des connexions
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Récupérer l'historique des connexions de l'utilisateur"""
        try:
            limit = int(request.query_params.get('limit', 50))
            history = LoginHistory.objects.filter(user=request.user)[:limit]
            serializer = LoginHistorySerializer(history, many=True)
            return Response(serializer.data)
        except Exception as e:
            # Logger l'erreur détaillée côté serveur
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de la récupération de l'historique: {str(e)}", exc_info=True)
            
            # Retourner une erreur générique (ne jamais exposer les détails)
            return Response({
                'error': 'Une erreur est survenue lors de la récupération de l\'historique. Veuillez réessayer plus tard.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DataExportView(APIView):
    """
    Vue pour exporter toutes les données de l'utilisateur
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        """Exporter toutes les données de l'utilisateur au format JSON"""
        try:
            from django.http import JsonResponse
            import json
            from datetime import datetime
            
            user = request.user
            
            # Préparer les données à exporter
            export_data = {
                'export_date': datetime.now().isoformat(),
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'username': user.username,
                    'first_name': user.first_name,
                    'last_name': user.last_name,
                    'role': user.role,
                    'created_at': user.created_at.isoformat() if user.created_at else None,
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                },
                'preferences': {},
                'trading_accounts': [],
                'trades': [],
                'strategies': [],
                'login_history': []
            }
            
            # Préférences
            try:
                preferences = UserPreferences.objects.get(user=user)
                export_data['preferences'] = UserPreferencesSerializer(preferences).data
            except Exception:  # UserPreferences.DoesNotExist
                pass
            
            # Comptes de trading
            try:
                from trades.models import TradingAccount
                accounts = TradingAccount.objects.filter(user=user)
                for account in accounts:
                    export_data['trading_accounts'].append({
                        'id': account.id,
                        'name': account.name,
                        'account_type': account.account_type,
                        'broker_account_id': account.broker_account_id,
                        'currency': account.currency,
                        'status': account.status,
                        'is_default': account.is_default,
                        'created_at': account.created_at.isoformat() if account.created_at else None,
                        'updated_at': account.updated_at.isoformat() if account.updated_at else None,
                    })
            except Exception as e:
                # Logger l'erreur détaillée côté serveur
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Erreur lors de l'export des comptes de trading: {str(e)}", exc_info=True)
                # Ne pas exposer les détails dans l'export
                export_data['trading_accounts_error'] = 'Erreur lors de l\'export des comptes de trading'
            
            # Trades
            try:
                from trades.models import TopStepTrade
                trades = TopStepTrade.objects.filter(user=user)
                for trade in trades:
                    export_data['trades'].append({
                        'id': trade.id,
                        'topstep_id': trade.topstep_id,
                        'contract_name': trade.contract_name,
                        'entered_at': trade.entered_at.isoformat() if trade.entered_at else None,
                        'exited_at': trade.exited_at.isoformat() if trade.exited_at else None,
                        'entry_price': str(trade.entry_price) if trade.entry_price else None,
                        'exit_price': str(trade.exit_price) if trade.exit_price else None,
                        'fees': str(trade.fees) if trade.fees else None,
                        'pnl': str(trade.pnl) if trade.pnl else None,
                        'net_pnl': str(trade.net_pnl) if trade.net_pnl else None,
                        'size': str(trade.size) if trade.size else None,
                        'trade_type': trade.trade_type,
                        'commissions': str(trade.commissions) if trade.commissions else None,
                        'trade_day': trade.trade_day.isoformat() if trade.trade_day else None,
                        'trade_duration': str(trade.trade_duration) if trade.trade_duration else None,
                        'trading_account_id': trade.trading_account.id if trade.trading_account else None,
                        'imported_at': trade.imported_at.isoformat() if trade.imported_at else None,
                        'updated_at': trade.updated_at.isoformat() if trade.updated_at else None,
                    })
            except Exception as e:
                # Logger l'erreur détaillée côté serveur
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Erreur lors de l'export des trades: {str(e)}", exc_info=True)
                # Ne pas exposer les détails dans l'export
                export_data['trades_error'] = 'Erreur lors de l\'export des trades'
            
            # Stratégies
            try:
                from trades.models import TradeStrategy
                strategies = TradeStrategy.objects.filter(user=user).select_related('trade')
                for strategy in strategies:
                    export_data['strategies'].append({
                        'id': strategy.id,
                        'trade_id': strategy.trade.id if strategy.trade else None,
                        'trade_topstep_id': strategy.trade.topstep_id if strategy.trade else None,
                        'strategy_respected': strategy.strategy_respected,
                        'gain_if_strategy_respected': strategy.gain_if_strategy_respected,
                        'dominant_emotions': strategy.dominant_emotions,
                        'tp1_reached': strategy.tp1_reached,
                        'tp2_plus_reached': strategy.tp2_plus_reached,
                        'session_rating': strategy.session_rating,
                        'emotion_details': strategy.emotion_details,
                        'possible_improvements': strategy.possible_improvements,
                        'screenshot_url': strategy.screenshot_url,
                        'video_url': strategy.video_url,
                        'created_at': strategy.created_at.isoformat() if strategy.created_at else None,
                        'updated_at': strategy.updated_at.isoformat() if strategy.updated_at else None,
                    })
            except Exception as e:
                # Logger l'erreur détaillée côté serveur
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Erreur lors de l'export des stratégies: {str(e)}", exc_info=True)
                # Ne pas exposer les détails dans l'export
                export_data['strategies_error'] = 'Erreur lors de l\'export des stratégies'
            
            # Historique des connexions
            try:
                history = LoginHistory.objects.filter(user=user)[:100]
                for entry in history:
                    export_data['login_history'].append({
                        'date': entry.date.isoformat() if entry.date else None,
                        'ip_address': entry.ip_address,
                        'user_agent': entry.user_agent,
                        'success': entry.success,
                    })
            except Exception as e:
                # Logger l'erreur détaillée côté serveur
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Erreur lors de l'export de l'historique de connexion: {str(e)}", exc_info=True)
                # Ne pas exposer les détails dans l'export
                export_data['login_history_error'] = 'Erreur lors de l\'export de l\'historique de connexion'
            
            # Retourner la réponse JSON
            response = JsonResponse(export_data, json_dumps_params={'indent': 2, 'ensure_ascii': False})
            filename = f'trading_journal_export_{user.email}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
            
        except Exception as e:
            # Logger l'erreur détaillée côté serveur
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors de l'export des données: {str(e)}", exc_info=True)
            
            # Retourner une erreur générique (ne jamais exposer les détails)
            return Response({
                'error': 'Une erreur est survenue lors de l\'export des données. Veuillez réessayer plus tard.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ContactView(APIView):
    """
    Vue pour envoyer un email de contact depuis la page d'accueil
    """
    permission_classes = [permissions.AllowAny]  # Accessible sans authentification
    
    def post(self, request):
        """
        Envoie un email de contact
        """
        email = request.data.get('email', '').strip()
        subject = request.data.get('subject', '').strip()
        message = request.data.get('message', '').strip()
        
        # Validation
        if not email:
            return Response(
                {'error': 'L\'adresse email est requise.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not subject:
            return Response(
                {'error': 'Le motif est requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not message:
            return Response(
                {'error': 'Le message est requis.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validation basique de l'email
        from django.core.validators import validate_email
        from django.core.exceptions import ValidationError
        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {'error': 'L\'adresse email n\'est pas valide.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Récupérer l'email de destination depuis les settings
            # Par défaut, utiliser DEFAULT_FROM_EMAIL ou une variable d'environnement
            contact_email = getattr(settings, 'CONTACT_EMAIL', settings.DEFAULT_FROM_EMAIL)
            
            # Construire le message
            email_subject = f'[Contact] {subject}'
            email_body = f"""
Nouveau message de contact depuis le site K&C Trading Journal

Email du demandeur: {email}
Motif: {subject}

Message:
{message}

---
Cet email a été envoyé depuis le formulaire de contact du site.
"""
            
            # Envoyer l'email
            send_mail(
                subject=email_subject,
                message=email_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[contact_email],
                fail_silently=False,
            )
            
            logger.info(f"Email de contact envoyé depuis {email} vers {contact_email}")
            
            return Response({
                'message': 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Erreur lors de l'envoi de l'email de contact: {str(e)}", exc_info=True)
            return Response({
                'error': 'Une erreur est survenue lors de l\'envoi de votre message. Veuillez réessayer plus tard.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
