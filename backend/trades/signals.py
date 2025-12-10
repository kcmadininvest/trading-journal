"""
Signals pour mettre à jour automatiquement les objectifs de trading
et migrer les compliances de jours sans trades vers des stratégies de trades.
"""
from django.db.models.signals import post_save, post_delete
from django.db import models, transaction
from django.dispatch import receiver
from .models import TopStepTrade, TradingGoal, DayStrategyCompliance, TradeStrategy


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


@receiver(post_save, sender=TopStepTrade)
def migrate_day_compliance_to_trade_strategy(sender, instance, created, **kwargs):
    """
    Migre automatiquement un DayStrategyCompliance vers un TradeStrategy
    quand un trade est créé pour une date qui avait déjà une compliance.
    
    Note: La compliance n'est PAS supprimée pour permettre de garder l'historique
    de la stratégie même après l'ajout de trades. Cela permet aussi de créer une
    compliance avant d'ajouter des trades.
    """
    # Ne traiter que les créations (pas les mises à jour)
    if not created:
        return
    
    # Déterminer la date du trade
    trade_date = instance.trade_day
    if trade_date is None and instance.entered_at:
        trade_date = instance.entered_at.date()
    
    if trade_date is None:
        return
    
    # Utiliser on_commit pour différer l'exécution après la fin de la transaction
    # Cela évite les erreurs "You can't execute queries until the end of the 'atomic' block"
    def create_strategy_from_compliance():
        # Chercher s'il existe une compliance pour cette date et cet utilisateur
        # Filtrer aussi par compte de trading si la compliance en a un
        compliance = DayStrategyCompliance.objects.filter(  # type: ignore
            user=instance.user,
            date=trade_date
        ).first()
        
        # Si une compliance existe et qu'elle correspond au compte de trading (ou n'a pas de compte)
        if compliance:
            # Vérifier que la compliance correspond au compte de trading du trade
            # (ou que la compliance n'a pas de compte spécifique)
            if compliance.trading_account is None or compliance.trading_account == instance.trading_account:
                # Vérifier qu'il n'existe pas déjà une TradeStrategy pour ce trade
                existing_strategy = TradeStrategy.objects.filter(  # type: ignore
                    user=instance.user,
                    trade=instance
                ).first()
                
                if not existing_strategy:
                    # Créer un TradeStrategy en copiant les données de la compliance
                    # Note: tp1_reached et tp2_plus_reached sont obligatoires (BooleanField sans null=True)
                    # On utilise False comme valeur par défaut car ces champs sont spécifiques aux trades
                    TradeStrategy.objects.create(  # type: ignore
                        user=instance.user,
                        trade=instance,
                        strategy_respected=compliance.strategy_respected,
                        dominant_emotions=compliance.dominant_emotions,
                        session_rating=compliance.session_rating,
                        emotion_details=compliance.emotion_details,
                        possible_improvements=compliance.possible_improvements,
                        screenshot_url=compliance.screenshot_url,
                        video_url=compliance.video_url,
                        # Champs obligatoires spécifiques aux trades (valeurs par défaut)
                        tp1_reached=False,
                        tp2_plus_reached=False,
                        # gain_if_strategy_respected peut rester null (il a null=True)
                    )
                
                # NE PAS supprimer la compliance pour permettre :
                # 1. De garder l'historique de la stratégie même après l'ajout de trades
                # 2. De créer une compliance avant d'ajouter des trades
                # 3. D'avoir les deux en même temps (compliance pour la journée, stratégies pour les trades)
    
    # Différer l'exécution après la fin de la transaction
    transaction.on_commit(create_strategy_from_compliance)


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

