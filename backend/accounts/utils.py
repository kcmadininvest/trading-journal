"""
Utilitaires pour l'application accounts
"""
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from .models import EmailActivationToken, PasswordResetToken, User
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

_GENERIC_PASSWORD_RESET_MESSAGE = (
    'Si un compte existe pour cette adresse, un email de réinitialisation a été envoyé.'
)


def get_password_reset_generic_message() -> str:
    return _GENERIC_PASSWORD_RESET_MESSAGE


def send_activation_email(user: User, activation_token: EmailActivationToken, language: str = None) -> bool:
    """
    Envoie un email d'activation à l'utilisateur
    
    Args:
        user: L'utilisateur à qui envoyer l'email
        activation_token: Le token d'activation
        language: Langue pour l'email (optionnel, sera détectée depuis les préférences si non fournie)
    
    Returns:
        bool: True si l'email a été envoyé avec succès, False sinon
    """
    try:
        # Récupérer la langue de l'utilisateur
        if language is None:
            # Essayer de récupérer depuis les préférences de l'utilisateur
            try:
                if hasattr(user, 'preferences') and user.preferences.language:
                    language = user.preferences.language
                else:
                    language = 'fr'  # Par défaut
            except Exception:
                language = 'fr'  # Par défaut si erreur
        
        # Construire l'URL d'activation
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        activation_url = f"{frontend_url}/activate-account/{activation_token.token}/"
        
        # Préparer le contexte pour les templates
        context = {
            'user': user,
            'activation_url': activation_url,
        }
        
        # Sélectionner le template selon la langue
        template_path = 'emails/activation_email.html'  # Par défaut (français)
        subject = 'Activez votre compte K&C Trading Journal'  # Par défaut (français)
        
        if language == 'es':
            template_path = 'emails/es/activation_email.html'
            subject = 'Activa tu cuenta K&C Trading Journal'
        elif language == 'de':
            template_path = 'emails/de/activation_email.html'
            subject = 'Aktivieren Sie Ihr K&C Trading Journal Konto'
        elif language == 'en':
            # Si on ajoute l'anglais plus tard, on peut créer emails/en/activation_email.html
            template_path = 'emails/activation_email.html'
            subject = 'Activate your K&C Trading Journal account'
        
        # Rendre les templates HTML et texte
        html_content = render_to_string(template_path, context)
        text_content = strip_tags(html_content)
        
        from_email = settings.DEFAULT_FROM_EMAIL
        to_email = [user.email]
        
        # Envoyer l'email
        msg = EmailMultiAlternatives(subject, text_content, from_email, to_email)
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        
        logger.info(f"Email d'activation envoyé avec succès à {user.email} (langue: {language})")
        return True
        
    except Exception as e:
        logger.error(f"Erreur lors de l'envoi de l'email d'activation à {user.email}: {str(e)}")
        return False


def create_activation_token(user: User) -> EmailActivationToken:
    """
    Crée ou récupère un token d'activation pour un utilisateur
    
    Args:
        user: L'utilisateur pour qui créer le token
    
    Returns:
        EmailActivationToken: Le token d'activation créé ou récupéré
    """
    # Supprimer les anciens tokens non utilisés pour cet utilisateur
    EmailActivationToken.objects.filter(user=user, is_used=False).delete()
    
    # Créer un nouveau token
    token = EmailActivationToken.objects.create(user=user)
    return token


def _resolve_email_language(user: User, language: str = None) -> str:
    if language:
        return language
    try:
        if hasattr(user, 'preferences') and user.preferences.language:
            return user.preferences.language
    except Exception:
        pass
    return 'fr'


def create_password_reset_token(user: User) -> PasswordResetToken:
    """Invalide les tokens reset non utilisés puis en crée un nouveau (1 h)."""
    PasswordResetToken.objects.filter(user=user, is_used=False).delete()
    return PasswordResetToken.objects.create(user=user)


def send_password_reset_email(
    user: User,
    reset_token: PasswordResetToken,
    language: str = None,
) -> bool:
    """Envoie l'email de réinitialisation de mot de passe."""
    try:
        language = _resolve_email_language(user, language)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        reset_url = f"{frontend_url}/reset-password/{reset_token.token}/"

        context = {
            'user': user,
            'reset_url': reset_url,
        }

        template_path = 'emails/password_reset_email.html'
        subject = 'Réinitialisation de votre mot de passe K&C Trading Journal'

        if language == 'es':
            template_path = 'emails/es/password_reset_email.html'
            subject = 'Restablece tu contraseña K&C Trading Journal'
        elif language == 'de':
            template_path = 'emails/de/password_reset_email.html'
            subject = 'Passwort zurücksetzen — K&C Trading Journal'
        elif language == 'en':
            template_path = 'emails/password_reset_email.html'
            subject = 'Reset your K&C Trading Journal password'

        html_content = render_to_string(template_path, context)
        text_content = strip_tags(html_content)

        msg = EmailMultiAlternatives(
            subject,
            text_content,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
        )
        msg.attach_alternative(html_content, 'text/html')
        msg.send()

        logger.info(
            'Email de réinitialisation envoyé à %s (langue: %s)',
            user.email,
            language,
        )
        return True
    except Exception as e:
        logger.error(
            "Erreur envoi email réinitialisation à %s: %s",
            user.email,
            str(e),
        )
        return False
