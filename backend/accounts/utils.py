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


def send_activation_email(user: User, activation_token: EmailActivationToken) -> bool:
    """
    Envoie un email d'activation à l'utilisateur
    
    Args:
        user: L'utilisateur à qui envoyer l'email
        activation_token: Le token d'activation
    
    Returns:
        bool: True si l'email a été envoyé avec succès, False sinon
    """
    try:
        # Construire l'URL d'activation
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        activation_url = f"{frontend_url}/activate-account/{activation_token.token}/"
        
        # Préparer le contexte pour les templates
        context = {
            'user': user,
            'activation_url': activation_url,
        }
        
        # Rendre les templates HTML et texte
        html_content = render_to_string('emails/activation_email.html', context)
        text_content = strip_tags(html_content)
        
        # Créer le message email
        subject = 'Activez votre compte Trading Journal'
        from_email = settings.DEFAULT_FROM_EMAIL
        to_email = [user.email]
        
        # Envoyer l'email
        msg = EmailMultiAlternatives(subject, text_content, from_email, to_email)
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        
        logger.info(f"Email d'activation envoyé avec succès à {user.email}")
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
