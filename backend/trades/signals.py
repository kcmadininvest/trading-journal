"""
Signaux Django pour la gestion automatique des fichiers media et des métriques.
"""

from django.db.models.signals import pre_delete, pre_save, post_save, post_delete
from django.dispatch import receiver
from .models import TradeStrategy, DayStrategyCompliance, PositionStrategy, TopStepTrade, AccountTransaction
from .account_balance import refresh_trading_account_balance_after_mutation
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


@receiver(pre_delete, sender=PositionStrategy)
def delete_position_strategy_screenshot(sender, instance, **kwargs):
    """
    Supprime automatiquement les screenshots quand une PositionStrategy est supprimée.
    Vérifie d'abord que le fichier n'est pas utilisé par d'autres versions.
    """
    if instance.example_screenshot and instance.example_screenshot.startswith('/media/'):
        try:
            # Vérifier si d'autres versions utilisent le même screenshot
            # Exclure l'instance actuelle de la recherche
            other_versions_using_screenshot = PositionStrategy.objects.filter(
                example_screenshot=instance.example_screenshot
            ).exclude(id=instance.id).exists()
            
            if other_versions_using_screenshot:
                logger.info(f"Screenshot non supprimé car utilisé par d'autres versions de PositionStrategy {instance.id}: {instance.example_screenshot}")
                return
            
            # Aucune autre version n'utilise ce screenshot, on peut le supprimer
            success = image_processor.delete_screenshot(instance.example_screenshot)
            if success:
                logger.info(f"Screenshot supprimé automatiquement lors de la suppression de PositionStrategy {instance.id}")
            else:
                logger.warning(f"Screenshot non trouvé lors de la suppression de PositionStrategy {instance.id}: {instance.example_screenshot}")
        except Exception as e:
            logger.error(f"Erreur lors de la suppression automatique du screenshot de PositionStrategy {instance.id}: {e}")


@receiver(pre_save, sender=PositionStrategy)
def delete_old_position_strategy_screenshot(sender, instance, **kwargs):
    """
    Supprime les anciens screenshots quand les URLs sont modifiées.
    Vérifie d'abord que le fichier n'est pas utilisé par d'autres versions.
    """
    if not instance.pk:
        # Nouvelle instance, pas d'ancien screenshot à supprimer
        return
    
    try:
        old_instance = PositionStrategy.objects.get(pk=instance.pk)
        old_screenshot = old_instance.example_screenshot
        new_screenshot = instance.example_screenshot
        
        # Si l'URL a changé et que l'ancienne URL était un fichier uploadé
        if old_screenshot and old_screenshot != new_screenshot and old_screenshot.startswith('/media/'):
            # Vérifier si d'autres versions utilisent le même screenshot
            # Exclure l'instance actuelle de la recherche
            other_versions_using_screenshot = PositionStrategy.objects.filter(
                example_screenshot=old_screenshot
            ).exclude(id=instance.id).exists()
            
            if other_versions_using_screenshot:
                logger.info(f"Ancien screenshot non supprimé car utilisé par d'autres versions de PositionStrategy {instance.id}: {old_screenshot}")
                return
            
            # Aucune autre version n'utilise ce screenshot, on peut le supprimer
            success = image_processor.delete_screenshot(old_screenshot)
            if success:
                logger.info(f"Ancien screenshot supprimé automatiquement lors de la modification de PositionStrategy {instance.id}")
            else:
                logger.warning(f"Ancien screenshot non trouvé lors de la modification de PositionStrategy {instance.id}: {old_screenshot}")
    except PositionStrategy.DoesNotExist:
        pass
    except Exception as e:
        logger.error(f"Erreur lors de la suppression automatique de l'ancien screenshot de PositionStrategy {instance.id}: {e}")


@receiver(pre_save, sender=TopStepTrade)
def capture_old_trade_for_rollup(sender, instance, **kwargs):
    """Conserve l'état précédent pour recalcul rollup si stratégie/compte/jour change."""
    if not instance.pk:
        instance._rollup_old_instance = None  # type: ignore[attr-defined]
        return
    try:
        instance._rollup_old_instance = TopStepTrade.objects.get(pk=instance.pk)  # type: ignore[attr-defined]
    except TopStepTrade.DoesNotExist:
        instance._rollup_old_instance = None  # type: ignore[attr-defined]


def _invalidate_stats_after_trade_mutation(user_id: int) -> None:
    from .tasks import schedule_debounced_stats_invalidation

    schedule_debounced_stats_invalidation(user_id)


@receiver(post_save, sender=TopStepTrade)
def update_rollups_after_trade_save(sender, instance, created, **kwargs):
    if not instance.user_id or not instance.trading_account_id:
        return
    try:
        from .services.rollup_service import buckets_for_trade
        from .tasks import schedule_debounced_rollup_rebuild

        old_instance = getattr(instance, '_rollup_old_instance', None)
        buckets = buckets_for_trade(instance)
        if old_instance:
            buckets.update(buckets_for_trade(old_instance))
        schedule_debounced_rollup_rebuild(instance.user_id, buckets)
        _invalidate_stats_after_trade_mutation(instance.user_id)
    except Exception as e:
        logger.error('Erreur rollup post_save trade %s: %s', instance.id, e)


@receiver(post_delete, sender=TopStepTrade)
def update_rollups_after_trade_delete(sender, instance, **kwargs):
    if not instance.user_id or not instance.trading_account_id:
        return
    try:
        from .services.rollup_service import buckets_for_trade
        from .tasks import schedule_debounced_rollup_rebuild

        buckets = buckets_for_trade(instance)
        schedule_debounced_rollup_rebuild(instance.user_id, buckets)
        _invalidate_stats_after_trade_mutation(instance.user_id)
    except Exception as e:
        logger.error('Erreur rollup post_delete trade %s: %s', instance.id, e)


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


def _refresh_balance_cache_for_account(trading_account_id) -> None:
    if not trading_account_id:
        return
    try:
        refresh_trading_account_balance_after_mutation(trading_account_id)
    except Exception as e:
        logger.error(
            'Erreur lors du rafraîchissement du cache solde pour le compte %s: %s',
            trading_account_id,
            e,
        )


@receiver(post_save, sender=TopStepTrade)
def refresh_balance_cache_after_trade_save(sender, instance, **kwargs):
    if instance.trading_account_id:
        _refresh_balance_cache_for_account(instance.trading_account_id)


@receiver(post_delete, sender=TopStepTrade)
def refresh_balance_cache_after_trade_delete(sender, instance, **kwargs):
    if instance.trading_account_id:
        _refresh_balance_cache_for_account(instance.trading_account_id)


@receiver(post_save, sender=AccountTransaction)
def refresh_balance_cache_after_transaction_save(sender, instance, **kwargs):
    if instance.trading_account_id:
        _refresh_balance_cache_for_account(instance.trading_account_id)


@receiver(post_delete, sender=AccountTransaction)
def refresh_balance_cache_after_transaction_delete(sender, instance, **kwargs):
    if instance.trading_account_id:
        _refresh_balance_cache_for_account(instance.trading_account_id)


def _invalidate_stats_cache_after_compliance_mutation(user_id: int) -> None:
    from .stats_response_cache import invalidate_user_stats_cache

    if user_id:
        invalidate_user_stats_cache(user_id)


@receiver(post_save, sender=TradeStrategy)
@receiver(post_delete, sender=TradeStrategy)
@receiver(post_save, sender=DayStrategyCompliance)
@receiver(post_delete, sender=DayStrategyCompliance)
def invalidate_stats_after_compliance_mutation(sender, instance, **kwargs):
    _invalidate_stats_cache_after_compliance_mutation(instance.user_id)
