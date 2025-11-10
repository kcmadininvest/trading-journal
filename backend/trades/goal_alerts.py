"""
Service pour envoyer des alertes par email concernant les objectifs de trading.
"""
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from django.utils import timezone
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


def send_goal_achieved_email(goal, language: str = None) -> bool:
    """
    Envoie un email à l'utilisateur quand un objectif est atteint.
    
    Args:
        goal: L'objectif TradingGoal qui a été atteint
        language: Langue pour l'email (optionnel, sera détectée depuis les préférences si non fournie)
    
    Returns:
        bool: True si l'email a été envoyé avec succès, False sinon
    """
    try:
        # Vérifier si l'utilisateur a activé les alertes email
        if hasattr(goal.user, 'preferences') and goal.user.preferences:
            if not goal.user.preferences.email_goal_alerts:
                logger.info(f"Alertes email désactivées pour {goal.user.email}, email non envoyé")
                return False
        
        # Récupérer la langue de l'utilisateur
        if not language:
            try:
                if hasattr(goal.user, 'preferences') and goal.user.preferences.language:
                    language = goal.user.preferences.language
                else:
                    language = 'fr'  # Par défaut
            except Exception:
                language = 'fr'  # Par défaut si erreur
        
        # Construire l'URL vers les objectifs
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        goals_url = f"{frontend_url}/goals"
        
        # Préparer le contexte pour les templates
        goal_type_labels = {
            'pnl_total': 'PnL Total',
            'win_rate': 'Taux de Réussite',
            'trades_count': 'Nombre de Trades',
            'profit_factor': 'Profit Factor',
            'max_drawdown': 'Drawdown Maximum',
            'strategy_respect': 'Respect de la Stratégie',
            'winning_days': 'Jours Gagnants',
        }
        
        period_type_labels = {
            'monthly': 'Mensuel',
            'quarterly': 'Trimestriel',
            'yearly': 'Annuel',
            'custom': 'Personnalisé',
        }
        
        context = {
            'user': goal.user,
            'goal': goal,
            'goal_type_label': goal_type_labels.get(goal.goal_type, goal.goal_type),
            'period_type_label': period_type_labels.get(goal.period_type, goal.period_type),
            'goals_url': goals_url,
            'progress_percentage': goal.progress_percentage,
        }
        
        # Sélectionner le template selon la langue
        template_path = 'emails/goal_achieved.html'  # Par défaut (français)
        subject = f'🎉 Objectif atteint : {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        
        if language == 'en':
            template_path = 'emails/en/goal_achieved.html'
            subject = f'🎉 Goal Achieved: {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        elif language == 'es':
            template_path = 'emails/es/goal_achieved.html'
            subject = f'🎉 Objetivo Alcanzado: {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        elif language == 'de':
            template_path = 'emails/de/goal_achieved.html'
            subject = f'🎉 Ziel Erreicht: {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        
        # Rendre les templates HTML et texte
        try:
            html_content = render_to_string(template_path, context)
        except Exception:
            # Si le template n'existe pas, utiliser un template simple
            html_content = f"""
            <html>
            <body>
                <h2>Objectif Atteint !</h2>
                <p>Bonjour {goal.user.get_full_name() or goal.user.email},</p>
                <p>Félicitations ! Vous avez atteint votre objectif : <strong>{goal_type_labels.get(goal.goal_type, goal.goal_type)}</strong></p>
                <p>Progression : {goal.progress_percentage:.1f}%</p>
                <p><a href="{goals_url}">Voir vos objectifs</a></p>
            </body>
            </html>
            """
        
        text_content = strip_tags(html_content)
        
        from_email = settings.DEFAULT_FROM_EMAIL
        to_email = [goal.user.email]
        
        # Envoyer l'email
        msg = EmailMultiAlternatives(subject, text_content, from_email, to_email)
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        
        logger.info(f"Email d'alerte 'objectif atteint' envoyé avec succès à {goal.user.email} (langue: {language})")
        return True
        
    except Exception as e:
        logger.error(f"Erreur lors de l'envoi de l'email d'alerte 'objectif atteint' à {goal.user.email}: {str(e)}")
        return False


def send_goal_danger_email(goal, language: str = None) -> bool:
    """
    Envoie un email à l'utilisateur quand un objectif est en danger.
    
    Args:
        goal: L'objectif TradingGoal qui est en danger
        language: Langue pour l'email (optionnel, sera détectée depuis les préférences si non fournie)
    
    Returns:
        bool: True si l'email a été envoyé avec succès, False sinon
    """
    try:
        # Vérifier si l'utilisateur a activé les alertes email
        if hasattr(goal.user, 'preferences') and goal.user.preferences:
            if not goal.user.preferences.email_goal_alerts:
                logger.info(f"Alertes email désactivées pour {goal.user.email}, email non envoyé")
                return False
        
        # Récupérer la langue de l'utilisateur
        if not language:
            try:
                if hasattr(goal.user, 'preferences') and goal.user.preferences.language:
                    language = goal.user.preferences.language
                else:
                    language = 'fr'  # Par défaut
            except Exception:
                language = 'fr'  # Par défaut si erreur
        
        # Construire l'URL vers les objectifs
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')
        goals_url = f"{frontend_url}/goals"
        
        # Préparer le contexte pour les templates
        goal_type_labels = {
            'pnl_total': 'PnL Total',
            'win_rate': 'Taux de Réussite',
            'trades_count': 'Nombre de Trades',
            'profit_factor': 'Profit Factor',
            'max_drawdown': 'Drawdown Maximum',
            'strategy_respect': 'Respect de la Stratégie',
            'winning_days': 'Jours Gagnants',
        }
        
        period_type_labels = {
            'monthly': 'Mensuel',
            'quarterly': 'Trimestriel',
            'yearly': 'Annuel',
            'custom': 'Personnalisé',
        }
        
        progress_percentage = goal.progress_percentage
        remaining_days = goal.remaining_days
        
        context = {
            'user': goal.user,
            'goal': goal,
            'goal_type_label': goal_type_labels.get(goal.goal_type, goal.goal_type),
            'period_type_label': period_type_labels.get(goal.period_type, goal.period_type),
            'goals_url': goals_url,
            'progress_percentage': progress_percentage,
            'remaining_days': remaining_days,
        }
        
        # Sélectionner le template selon la langue
        template_path = 'emails/goal_danger.html'  # Par défaut (français)
        subject = f'⚠️ Objectif en danger : {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        
        if language == 'en':
            template_path = 'emails/en/goal_danger.html'
            subject = f'⚠️ Goal in Danger: {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        elif language == 'es':
            template_path = 'emails/es/goal_danger.html'
            subject = f'⚠️ Objetivo en Peligro: {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        elif language == 'de':
            template_path = 'emails/de/goal_danger.html'
            subject = f'⚠️ Ziel in Gefahr: {goal_type_labels.get(goal.goal_type, goal.goal_type)}'
        
        # Rendre les templates HTML et texte
        try:
            html_content = render_to_string(template_path, context)
        except Exception:
            # Si le template n'existe pas, utiliser un template simple
            html_content = f"""
            <html>
            <body>
                <h2>Objectif en Danger</h2>
                <p>Bonjour {goal.user.get_full_name() or goal.user.email},</p>
                <p>Votre objectif <strong>{goal_type_labels.get(goal.goal_type, goal.goal_type)}</strong> est en danger.</p>
                <p>Progression actuelle : {progress_percentage:.1f}%</p>
                <p>Jours restants : {remaining_days}</p>
                <p><a href="{goals_url}">Voir vos objectifs</a></p>
            </body>
            </html>
            """
        
        text_content = strip_tags(html_content)
        
        from_email = settings.DEFAULT_FROM_EMAIL
        to_email = [goal.user.email]
        
        # Envoyer l'email
        msg = EmailMultiAlternatives(subject, text_content, from_email, to_email)
        msg.attach_alternative(html_content, "text/html")
        msg.send()
        
        logger.info(f"Email d'alerte 'objectif en danger' envoyé avec succès à {goal.user.email} (langue: {language})")
        return True
        
    except Exception as e:
        logger.error(f"Erreur lors de l'envoi de l'email d'alerte 'objectif en danger' à {goal.user.email}: {str(e)}")
        return False

