"""
Signaux Django pour la gestion automatique des fichiers media.
"""

from django.db.models.signals import pre_delete, pre_save
from django.dispatch import receiver
from .models import TradeStrategy, DayStrategyCompliance
from .image_processor import image_processor
import logging

logger = logging.getLogger(__name__)


@receiver(pre_delete, sender=TradeStrategy)
def delete_trade_strategy_screenshot(sender, instance, **kwargs):
    """
    Supprime automatiquement le screenshot quand une TradeStrategy est supprimée.
    """
    if instance.screenshot_url and instance.screenshot_url.startswith('/media/'):
        try:
            success = image_processor.delete_screenshot(instance.screenshot_url)
            if success:
                logger.info(f"Screenshot supprimé automatiquement lors de la suppression de TradeStrategy {instance.id}")
            else:
                logger.warning(f"Screenshot non trouvé lors de la suppression de TradeStrategy {instance.id}: {instance.screenshot_url}")
        except Exception as e:
            logger.error(f"Erreur lors de la suppression automatique du screenshot de TradeStrategy {instance.id}: {e}")


@receiver(pre_save, sender=TradeStrategy)
def delete_old_trade_strategy_screenshot(sender, instance, **kwargs):
    """
    Supprime l'ancien screenshot quand l'URL est modifiée.
    """
    if not instance.pk:
        # Nouvelle instance, pas d'ancien screenshot à supprimer
        return
    
    try:
        old_instance = TradeStrategy.objects.get(pk=instance.pk)
        old_url = old_instance.screenshot_url
        new_url = instance.screenshot_url
        
        # Si l'URL a changé et que l'ancienne URL était un fichier uploadé
        if old_url and old_url != new_url and old_url.startswith('/media/'):
            success = image_processor.delete_screenshot(old_url)
            if success:
                logger.info(f"Ancien screenshot supprimé automatiquement lors de la modification de TradeStrategy {instance.id}")
            else:
                logger.warning(f"Ancien screenshot non trouvé lors de la modification de TradeStrategy {instance.id}: {old_url}")
    except TradeStrategy.DoesNotExist:
        pass
    except Exception as e:
        logger.error(f"Erreur lors de la suppression automatique de l'ancien screenshot de TradeStrategy {instance.id}: {e}")


@receiver(pre_delete, sender=DayStrategyCompliance)
def delete_day_compliance_screenshot(sender, instance, **kwargs):
    """
    Supprime automatiquement le screenshot quand une DayStrategyCompliance est supprimée.
    """
    if instance.screenshot_url and instance.screenshot_url.startswith('/media/'):
        try:
            success = image_processor.delete_screenshot(instance.screenshot_url)
            if success:
                logger.info(f"Screenshot supprimé automatiquement lors de la suppression de DayStrategyCompliance {instance.id}")
            else:
                logger.warning(f"Screenshot non trouvé lors de la suppression de DayStrategyCompliance {instance.id}: {instance.screenshot_url}")
        except Exception as e:
            logger.error(f"Erreur lors de la suppression automatique du screenshot de DayStrategyCompliance {instance.id}: {e}")


@receiver(pre_save, sender=DayStrategyCompliance)
def delete_old_day_compliance_screenshot(sender, instance, **kwargs):
    """
    Supprime l'ancien screenshot quand l'URL est modifiée.
    """
    if not instance.pk:
        # Nouvelle instance, pas d'ancien screenshot à supprimer
        return
    
    try:
        old_instance = DayStrategyCompliance.objects.get(pk=instance.pk)
        old_url = old_instance.screenshot_url
        new_url = instance.screenshot_url
        
        # Si l'URL a changé et que l'ancienne URL était un fichier uploadé
        if old_url and old_url != new_url and old_url.startswith('/media/'):
            success = image_processor.delete_screenshot(old_url)
            if success:
                logger.info(f"Ancien screenshot supprimé automatiquement lors de la modification de DayStrategyCompliance {instance.id}")
            else:
                logger.warning(f"Ancien screenshot non trouvé lors de la modification de DayStrategyCompliance {instance.id}: {old_url}")
    except DayStrategyCompliance.DoesNotExist:
        pass
    except Exception as e:
        logger.error(f"Erreur lors de la suppression automatique de l'ancien screenshot de DayStrategyCompliance {instance.id}: {e}")
