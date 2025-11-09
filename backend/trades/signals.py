"""
Signals pour mettre à jour automatiquement les objectifs de trading.
"""
from django.db.models.signals import post_save, post_delete
from django.db import models
from django.dispatch import receiver
from .models import TopStepTrade, TradingGoal


@receiver(post_save, sender=TopStepTrade)
def update_goals_on_trade_save(sender, instance, **kwargs):
    """
    Met à jour la progression de tous les objectifs actifs
    quand un trade est créé ou modifié.
    """
    # Récupérer tous les objectifs actifs pour cet utilisateur
    # qui concernent ce compte (ou tous les comptes)
    active_goals = TradingGoal.objects.filter(  # type: ignore
        user=instance.user,
        status='active'
    ).filter(
        # Soit l'objectif concerne ce compte spécifique
        # Soit l'objectif concerne tous les comptes (trading_account=None)
        models.Q(trading_account=instance.trading_account) | models.Q(trading_account__isnull=True)
    )
    
    # Mettre à jour chaque objectif
    for goal in active_goals:
        # Vérifier si le trade est dans la période de l'objectif
        if goal.start_date <= instance.trade_day <= goal.end_date:  # type: ignore
            goal.update_progress()


@receiver(post_delete, sender=TopStepTrade)
def update_goals_on_trade_delete(sender, instance, **kwargs):
    """
    Met à jour la progression de tous les objectifs actifs
    quand un trade est supprimé.
    """
    # Même logique que pour post_save
    active_goals = TradingGoal.objects.filter(  # type: ignore
        user=instance.user,
        status='active'
    ).filter(
        models.Q(trading_account=instance.trading_account) | models.Q(trading_account__isnull=True)
    )
    
    for goal in active_goals:
        if goal.start_date <= instance.trade_day <= goal.end_date:  # type: ignore
            goal.update_progress()

