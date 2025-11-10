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
    # Déterminer la date du trade pour la comparaison avec les objectifs
    # Utiliser trade_day si disponible, sinon utiliser la date de entered_at
    trade_date = instance.trade_day
    if trade_date is None and instance.entered_at:
        trade_date = instance.entered_at.date()
    
    # Si on n'a toujours pas de date, on ne peut pas mettre à jour les objectifs
    if trade_date is None:
        return
    
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
        if goal.start_date <= trade_date <= goal.end_date:  # type: ignore
            goal.update_progress()


@receiver(post_delete, sender=TopStepTrade)
def update_goals_on_trade_delete(sender, instance, **kwargs):
    """
    Met à jour la progression de tous les objectifs actifs
    quand un trade est supprimé.
    """
    # Déterminer la date du trade pour la comparaison avec les objectifs
    # Utiliser trade_day si disponible, sinon utiliser la date de entered_at
    trade_date = instance.trade_day
    if trade_date is None and instance.entered_at:
        trade_date = instance.entered_at.date()
    
    # Si on n'a toujours pas de date, on ne peut pas mettre à jour les objectifs
    if trade_date is None:
        return
    
    # Même logique que pour post_save
    active_goals = TradingGoal.objects.filter(  # type: ignore
        user=instance.user,
        status='active'
    ).filter(
        models.Q(trading_account=instance.trading_account) | models.Q(trading_account__isnull=True)
    )
    
    for goal in active_goals:
        if goal.start_date <= trade_date <= goal.end_date:  # type: ignore
            goal.update_progress()

