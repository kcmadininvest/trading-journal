"""
Utilitaires pour l'application accounts
"""
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from .models import EmailActivationToken, User
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


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
        subject = 'Activez votre compte Trading Journal'  # Par défaut (français)
        
        if language == 'es':
            template_path = 'emails/es/activation_email.html'
            subject = 'Activa tu cuenta Trading Journal'
        elif language == 'de':
            template_path = 'emails/de/activation_email.html'
            subject = 'Aktivieren Sie Ihr Trading Journal Konto'
        elif language == 'en':
            # Si on ajoute l'anglais plus tard, on peut créer emails/en/activation_email.html
            template_path = 'emails/activation_email.html'
            subject = 'Activate your Trading Journal account'
        
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
