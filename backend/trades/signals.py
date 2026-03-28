"""
Signaux Django pour la gestion automatique des fichiers media et des métriques.
"""

from django.db.models.signals import pre_delete, pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import TradeStrategy, DayStrategyCompliance, TopStepTrade
from .image_processor import image_processor
from .services.metrics_calculator import AccountMetricsCalculator
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


@receiver(post_save, sender=TopStepTrade)
def recalculate_metrics_after_trade_save(sender, instance, created, **kwargs):
    """
    Recalcule automatiquement les métriques MLL après l'ajout ou la modification d'un trade.
    """
    if not instance.trading_account or not instance.trade_day:
        return
    
    # Vérifier si le MLL est activé pour ce compte
    if not instance.trading_account.mll_enabled:
        return
    
    try:
        calculator = AccountMetricsCalculator()
        # Recalculer les métriques à partir de la date du trade modifié
        calculator.recalculate_metrics_from_date(instance.trading_account, instance.trade_day)
        
        action = "créé" if created else "modifié"
        logger.info(f"Métriques MLL recalculées automatiquement après {action} du trade {instance.id} pour le compte {instance.trading_account.name}")
    except Exception as e:
        logger.error(f"Erreur lors du recalcul automatique des métriques après sauvegarde du trade {instance.id}: {e}")


@receiver(post_delete, sender=TopStepTrade)
def recalculate_metrics_after_trade_delete(sender, instance, **kwargs):
    """
    Recalcule automatiquement les métriques MLL après la suppression d'un trade.
    Supprime aussi les métriques des dates qui n'ont plus de trades.
    """
    if not instance.trading_account or not instance.trade_day:
        return
    
    # Vérifier si le MLL est activé pour ce compte
    if not instance.trading_account.mll_enabled:
        return
    
    try:
        from .models import AccountDailyMetrics
        
        # Vérifier s'il reste des trades pour cette date
        remaining_trades = TopStepTrade.objects.filter(
            trading_account=instance.trading_account,
            trade_day=instance.trade_day
        ).exists()
        
        if not remaining_trades:
            # Plus de trades pour cette date, supprimer la métrique
            AccountDailyMetrics.objects.filter(
                trading_account=instance.trading_account,
                date=instance.trade_day
            ).delete()
            logger.info(f"Métrique MLL supprimée pour la date {instance.trade_day} (plus de trades) pour le compte {instance.trading_account.name}")
        else:
            # Il reste des trades, recalculer les métriques
            calculator = AccountMetricsCalculator()
            calculator.recalculate_metrics_from_date(instance.trading_account, instance.trade_day)
            logger.info(f"Métriques MLL recalculées automatiquement après suppression du trade {instance.id} pour le compte {instance.trading_account.name}")
    except Exception as e:
        logger.error(f"Erreur lors du recalcul automatique des métriques après suppression du trade {instance.id}: {e}")
