from rest_framework import serializers
from .models import TopStepTrade, TopStepImportLog, TradeStrategy, PositionStrategy, TradingAccount, Currency, TradingGoal, AccountTransaction, AccountDailyMetrics, DayStrategyCompliance


class TradingAccountSerializer(serializers.ModelSerializer):
    """
    Serializer pour les comptes de trading.
    """
    user_username = serializers.CharField(source='user.username', read_only=True)
    trades_count = serializers.SerializerMethodField()
    is_topstep = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = TradingAccount
        fields = [
            'id',
            'user',
            'user_username',
            'name',
            'account_type',
            'broker_account_id',
            'currency',
            'initial_capital',
            'maximum_loss_limit',
            'mll_enabled',
            'status',
            'broker_config',
            'description',
            'is_default',
            'trades_count',
            'is_topstep',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']
    
    def get_trades_count(self, obj):
        """Retourne le nombre de trades associés à ce compte."""
        return obj.topstep_trades.count()
    
    def validate_name(self, value):
        """Valide que le nom du compte est unique pour l'utilisateur."""
        user = self.context['request'].user
        if self.instance:
            # Mise à jour - exclure l'instance actuelle
            if TradingAccount.objects.filter(user=user, name=value).exclude(pk=self.instance.pk).exists():  # type: ignore
                raise serializers.ValidationError("Un compte avec ce nom existe déjà.")
        else:
            # Création
            if TradingAccount.objects.filter(user=user, name=value).exists():  # type: ignore
                raise serializers.ValidationError("Un compte avec ce nom existe déjà.")
        return value
    
    def validate_is_default(self, value):
        """S'assure qu'un seul compte est marqué comme défaut."""
        if value:
            user = self.context['request'].user
            if self.instance:
                # Mise à jour - exclure l'instance actuelle
                TradingAccount.objects.filter(user=user, is_default=True).exclude(pk=self.instance.pk).update(is_default=False)  # type: ignore
            else:
                # Création
                TradingAccount.objects.filter(user=user, is_default=True).update(is_default=False)  # type: ignore
        return value


class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = ['id', 'code', 'name', 'symbol']


class TradingAccountListSerializer(serializers.ModelSerializer):
    """
    Serializer simplifié pour la liste des comptes de trading.
    """
    trades_count = serializers.SerializerMethodField()
    is_topstep = serializers.BooleanField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = TradingAccount
        fields = [
            'id',
            'name',
            'account_type',
            'broker_account_id',
            'currency',
            'initial_capital',
            'maximum_loss_limit',
            'mll_enabled',
            'status',
            'is_default',
            'trades_count',
            'is_topstep',
            'is_active',
            'created_at'
        ]
    
    def get_trades_count(self, obj):
        """Retourne le nombre de trades associés à ce compte."""
        return obj.topstep_trades.count()


class TopStepTradeSerializer(serializers.ModelSerializer):
    """
    Serializer pour les trades TopStep avec les données calculées.
    """
    net_pnl = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    pnl_percentage = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_profitable = serializers.BooleanField(read_only=True)
    duration_str = serializers.CharField(read_only=True)
    formatted_entry_date = serializers.CharField(read_only=True)
    formatted_exit_date = serializers.CharField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True)
    trading_account_type = serializers.CharField(source='trading_account.account_type', read_only=True)
    position_strategy_title = serializers.CharField(source='position_strategy.title', read_only=True)
    
    class Meta:
        model = TopStepTrade
        fields = [
            'id',
            'topstep_id',
            'user',
            'user_username',
            'trading_account',
            'trading_account_name',
            'trading_account_type',
            'contract_name',
            'trade_type',
            'entered_at',
            'exited_at',
            'entry_price',
            'exit_price',
            'size',
            'fees',
            'commissions',
            'pnl',
            'net_pnl',
            'pnl_percentage',
            'trade_day',
            'trade_duration',
            'duration_str',
            'notes',
            'strategy',
            'position_strategy',
            'position_strategy_title',
            'is_profitable',
            'formatted_entry_date',
            'formatted_exit_date',
            'planned_stop_loss',
            'planned_take_profit',
            'planned_risk_reward_ratio',
            'actual_risk_reward_ratio',
            'imported_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'topstep_id', 'imported_at', 'updated_at', 'position_strategy_title', 'net_pnl', 'pnl_percentage', 'is_profitable', 'duration_str', 'formatted_entry_date', 'formatted_exit_date', 'user_username', 'trading_account_name', 'trading_account_type', 'planned_risk_reward_ratio', 'actual_risk_reward_ratio']

    def validate_position_strategy(self, value):
        """Valide que la stratégie appartient à l'utilisateur."""
        if value is None:
            return value
        
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            if value.user != request.user:
                raise serializers.ValidationError("Cette stratégie ne vous appartient pas.")
        return value

    def create(self, validated_data):
        """
        Permet la création manuelle d'un trade:
        - Génère un topstep_id si absent
        - Assigne l'utilisateur courant
        - Assigne le compte de trading par défaut si non fourni
        - Renseigne trade_day si déductible
        """
        from .models import TradingAccount, TopStepTrade
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['user'] = request.user
        else:
            raise serializers.ValidationError('Utilisateur non authentifié')

        # Générer un topstep_id si manquant
        if not validated_data.get('topstep_id'):
            import uuid
            validated_data['topstep_id'] = f"MANUAL-{uuid.uuid4().hex[:20]}"

        # Compte de trading: utiliser celui fourni ou le compte par défaut
        trading_account = validated_data.get('trading_account')
        if trading_account is None:
            default_account = TradingAccount.objects.filter(user=request.user, is_default=True).first()  # type: ignore
            if not default_account:
                raise serializers.ValidationError("Aucun compte de trading par défaut. Veuillez en créer un et le définir par défaut.")
            validated_data['trading_account'] = default_account

        # Valider que la stratégie appartient à l'utilisateur
        position_strategy = validated_data.get('position_strategy')
        if position_strategy and position_strategy.user != request.user:
            raise serializers.ValidationError("Cette stratégie ne vous appartient pas.")

        # Déduire trade_day si possible
        entered_at = validated_data.get('entered_at')
        if entered_at and not validated_data.get('trade_day'):
            validated_data['trade_day'] = entered_at.date()

        instance = TopStepTrade.objects.create(**validated_data)
        return instance


class TopStepTradeListSerializer(serializers.ModelSerializer):
    """
    Serializer simplifié pour la liste des trades (performance).
    """
    net_pnl = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    pnl_percentage = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_profitable = serializers.BooleanField(read_only=True)
    duration_str = serializers.CharField(read_only=True)
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True)
    position_strategy_title = serializers.CharField(source='position_strategy.title', read_only=True)
    
    class Meta:
        model = TopStepTrade
        fields = [
            'id',
            'topstep_id',
            'trading_account',
            'trading_account_name',
            'contract_name',
            'trade_type',
            'entered_at',
            'exited_at',
            'entry_price',
            'exit_price',
            'size',
            'point_value',
            'fees',
            'commissions',
            'pnl',
            'net_pnl',
            'pnl_percentage',
            'is_profitable',
            'trade_duration',
            'duration_str',
            'trade_day',
            'position_strategy',
            'position_strategy_title',
            'planned_stop_loss',
            'planned_take_profit',
            'planned_risk_reward_ratio',
            'actual_risk_reward_ratio'
        ]


class TopStepImportLogSerializer(serializers.ModelSerializer):
    """
    Serializer pour les logs d'import.
    """
    user_username = serializers.CharField(source='user.username', read_only=True)
    success_rate = serializers.SerializerMethodField()
    
    class Meta:
        model = TopStepImportLog
        fields = [
            'id',
            'user',
            'user_username',
            'filename',
            'total_rows',
            'success_count',
            'error_count',
            'skipped_count',
            'success_rate',
            'errors',
            'imported_at'
        ]
        read_only_fields = ['user', 'imported_at']
    
    def get_success_rate(self, obj):
        if obj.total_rows > 0:
            return round((obj.success_count / obj.total_rows) * 100, 2)
        return 0


class TradeStatisticsSerializer(serializers.Serializer):
    """
    Serializer pour les statistiques de trading.
    """
    total_trades = serializers.IntegerField()
    winning_trades = serializers.IntegerField()
    losing_trades = serializers.IntegerField()
    win_rate = serializers.FloatField()
    total_pnl = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_raw_pnl = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_gains = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_losses = serializers.DecimalField(max_digits=18, decimal_places=2)
    average_pnl = serializers.DecimalField(max_digits=18, decimal_places=2)
    best_trade = serializers.DecimalField(max_digits=18, decimal_places=2)
    worst_trade = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_fees = serializers.DecimalField(max_digits=18, decimal_places=2)
    total_volume = serializers.DecimalField(max_digits=18, decimal_places=4)
    average_duration = serializers.CharField()
    most_traded_contract = serializers.CharField()
    # Ratios de Performance
    profit_factor = serializers.FloatField()
    win_loss_ratio = serializers.FloatField()
    consistency_ratio = serializers.FloatField()
    recovery_ratio = serializers.FloatField()
    pnl_per_trade = serializers.FloatField()
    fees_ratio = serializers.FloatField()
    volume_pnl_ratio = serializers.FloatField()
    frequency_ratio = serializers.FloatField()
    duration_ratio = serializers.FloatField()
    recovery_time = serializers.FloatField()
    max_drawdown = serializers.FloatField()
    max_drawdown_pct = serializers.FloatField()
    max_drawdown_global = serializers.FloatField()
    max_drawdown_global_pct = serializers.FloatField()
    max_runup = serializers.FloatField()
    max_runup_pct = serializers.FloatField()
    max_runup_global = serializers.FloatField()
    max_runup_global_pct = serializers.FloatField()
    expectancy = serializers.FloatField()
    break_even_trades = serializers.IntegerField()
    sharpe_ratio = serializers.FloatField()
    sortino_ratio = serializers.FloatField()
    calmar_ratio = serializers.FloatField()
    trade_efficiency = serializers.FloatField()
    current_winning_streak_days = serializers.IntegerField()
    # Statistiques Risk/Reward Ratio
    avg_planned_rr = serializers.FloatField()
    avg_actual_rr = serializers.FloatField()
    trades_with_planned_rr = serializers.IntegerField()
    trades_with_actual_rr = serializers.IntegerField()
    trades_with_both_rr = serializers.IntegerField()
    plan_respect_rate = serializers.FloatField()


class TradingMetricsSerializer(serializers.Serializer):
    """
    Serializer pour les métriques de trading avancées.
    """
    risk_reward_ratio = serializers.FloatField()
    profit_factor = serializers.FloatField()
    max_drawdown = serializers.FloatField()
    win_rate = serializers.FloatField()
    recovery_factor = serializers.FloatField()
    expectancy = serializers.FloatField()
    sharpe_ratio = serializers.FloatField()


class CSVUploadSerializer(serializers.Serializer):
    """
    Serializer pour l'upload de fichiers CSV avec validation stricte.
    """
    file = serializers.FileField()
    
    def validate_file(self, value):
        """
        Valide le fichier uploadé avec des vérifications strictes :
        - Extension de fichier
        - Taille maximale
        - Type MIME réel
        - Magic bytes
        - Contenu du fichier
        - Protection contre les path traversal
        """
        from .file_validators import csv_file_validator
        
        # Utiliser le validateur strict
        try:
            csv_file_validator.validate(value)
        except Exception as e:
            # Convertir les ValidationError Django en ValidationError DRF
            if hasattr(e, 'message'):
                raise serializers.ValidationError(str(e.message))
            else:
                raise serializers.ValidationError(str(e))
        
        return value


class TradeStrategySerializer(serializers.ModelSerializer):
    """
    Serializer pour les données de stratégie liées à un trade.
    """
    emotions_display = serializers.CharField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    trade_info = serializers.SerializerMethodField()
    
    class Meta:
        model = TradeStrategy
        fields = [
            'id',
            'user',
            'user_username',
            'trade',
            'trade_info',
            'strategy_respected',
            'dominant_emotions',
            'gain_if_strategy_respected',
            'tp1_reached',
            'tp2_plus_reached',
            'session_rating',
            'emotion_details',
            'possible_improvements',
            'screenshot_url',
            'video_url',
            'emotions_display',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']
    
    def get_trade_info(self, obj):
        """Retourne les informations du trade associé."""
        return {
            'topstep_id': obj.trade.topstep_id,
            'contract_name': obj.trade.contract_name,
            'trade_type': obj.trade.trade_type,
            'size': str(obj.trade.size),
            'net_pnl': str(obj.trade.net_pnl) if obj.trade.net_pnl else None,
            'entered_at': obj.trade.entered_at,
            'exited_at': obj.trade.exited_at,
        }
    
    def validate_dominant_emotions(self, value):
        """Valide que les émotions sélectionnées sont valides."""
        valid_emotions = [choice[0] for choice in TradeStrategy.EMOTION_CHOICES]
        for emotion in value:
            if emotion not in valid_emotions:
                raise serializers.ValidationError(f"Émotion invalide: {emotion}")
        return value
    
    def validate_session_rating(self, value):
        """Valide que la note est entre 1 et 5."""
        if value is not None and (value < 1 or value > 5):
            raise serializers.ValidationError("La note doit être entre 1 et 5")
        return value


class DayStrategyComplianceSerializer(serializers.ModelSerializer):
    """
    Serializer pour les données de stratégie pour les jours sans trades.
    """
    emotions_display = serializers.CharField(read_only=True)
    user_username = serializers.CharField(source='user.username', read_only=True)
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True, allow_null=True)
    
    class Meta:
        model = DayStrategyCompliance
        fields = [
            'id',
            'user',
            'user_username',
            'date',
            'trading_account',
            'trading_account_name',
            'strategy_respected',
            'dominant_emotions',
            'session_rating',
            'emotion_details',
            'possible_improvements',
            'screenshot_url',
            'video_url',
            'emotions_display',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']
    
    def validate_dominant_emotions(self, value):
        """Valide que les émotions sélectionnées sont valides."""
        valid_emotions = [choice[0] for choice in DayStrategyCompliance.EMOTION_CHOICES]
        for emotion in value:
            if emotion not in valid_emotions:
                raise serializers.ValidationError(f"Émotion invalide: {emotion}")
        return value
    
    def validate_session_rating(self, value):
        """Valide que la note est entre 1 et 5."""
        if value is not None and (value < 1 or value > 5):
            raise serializers.ValidationError("La note doit être entre 1 et 5")
        return value


class PositionStrategySerializer(serializers.ModelSerializer):
    """
    Serializer pour les stratégies de position avec gestion des versions.
    """
    is_latest_version = serializers.BooleanField(read_only=True)
    version_count = serializers.SerializerMethodField()
    user_username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = PositionStrategy
        fields = [
            'id',
            'user',
            'user_username',
            'version',
            'parent_strategy',
            'title',
            'description',
            'status',
            'strategy_content',
            'version_notes',
            'is_current',
            'is_latest_version',
            'version_count',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'version', 'parent_strategy', 'created_at', 'updated_at']
    
    def get_version_count(self, obj):
        """Retourne le nombre total de versions."""
        try:
            if obj.parent_strategy:
                return obj.parent_strategy.versions.count()
            return obj.versions.count()
        except Exception as e:
            # En cas d'erreur (relation cassée, etc.), retourner 1 par défaut
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erreur lors du calcul du nombre de versions pour la stratégie {obj.id}: {str(e)}")
            return 1
    
    def validate_strategy_content(self, value):
        """Valide le contenu de la stratégie."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Le contenu doit être un objet JSON valide")
        
        # Validation de la structure des sections
        if 'sections' not in value:
            raise serializers.ValidationError("Le contenu doit contenir une liste de sections")
        
        sections = value.get('sections', [])
        if not isinstance(sections, list):
            raise serializers.ValidationError("Les sections doivent être une liste")
        
        if len(sections) == 0:
            raise serializers.ValidationError("Au moins une section est requise")
        
        # Validation de chaque section
        for i, section in enumerate(sections):
            if not isinstance(section, dict):
                raise serializers.ValidationError(f"La section {i+1} doit être un objet")
            
            if 'title' not in section:
                raise serializers.ValidationError(f"La section {i+1} doit avoir un titre")
            
            if 'rules' not in section:
                raise serializers.ValidationError(f"La section {i+1} doit avoir des règles")
            
            if not isinstance(section['rules'], list):
                raise serializers.ValidationError(f"Les règles de la section {i+1} doivent être une liste")
        
        return value
    
    def validate_status(self, value):
        """Valide le statut de la stratégie."""
        valid_statuses = [choice[0] for choice in PositionStrategy.STRATEGY_STATUS_CHOICES]
        if value not in valid_statuses:
            raise serializers.ValidationError(f"Statut invalide. Choix possibles: {', '.join(valid_statuses)}")
        return value


class PositionStrategyVersionSerializer(serializers.ModelSerializer):
    """
    Serializer simplifié pour l'historique des versions.
    """
    is_latest_version = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = PositionStrategy
        fields = [
            'id',
            'version',
            'title',
            'status',
            'version_notes',
            'is_current',
            'is_latest_version',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['version', 'created_at', 'updated_at']


class PositionStrategyCreateSerializer(serializers.ModelSerializer):
    """
    Serializer pour la création de nouvelles stratégies.
    """
    class Meta:
        model = PositionStrategy
        fields = [
            'title',
            'description',
            'status',
            'strategy_content',
            'version_notes'
        ]
    
    def validate_strategy_content(self, value):
        """Valide le contenu de la stratégie."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Le contenu doit être un objet JSON valide")
        
        # Validation de la structure des sections
        if 'sections' not in value:
            raise serializers.ValidationError("Le contenu doit contenir une liste de sections")
        
        sections = value.get('sections', [])
        if not isinstance(sections, list):
            raise serializers.ValidationError("Les sections doivent être une liste")
        
        if len(sections) == 0:
            raise serializers.ValidationError("Au moins une section est requise")
        
        # Validation de chaque section
        for i, section in enumerate(sections):
            if not isinstance(section, dict):
                raise serializers.ValidationError(f"La section {i+1} doit être un objet")
            
            if 'title' not in section:
                raise serializers.ValidationError(f"La section {i+1} doit avoir un titre")
            
            if 'rules' not in section:
                raise serializers.ValidationError(f"La section {i+1} doit avoir des règles")
            
            if not isinstance(section['rules'], list):
                raise serializers.ValidationError(f"Les règles de la section {i+1} doivent être une liste")
        
        return value


class PositionStrategyUpdateSerializer(serializers.ModelSerializer):
    """
    Serializer pour la mise à jour des stratégies (crée une nouvelle version).
    """
    create_new_version = serializers.BooleanField(default=True, write_only=True)
    
    class Meta:
        model = PositionStrategy
        fields = [
            'title',
            'description',
            'status',
            'strategy_content',
            'version_notes',
            'create_new_version'
        ]
    
    def validate_strategy_content(self, value):
        """Valide le contenu de la stratégie."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Le contenu doit être un objet JSON valide")
        
        # Validation de la structure des sections
        if 'sections' not in value:
            raise serializers.ValidationError("Le contenu doit contenir une liste de sections")
        
        sections = value.get('sections', [])
        if not isinstance(sections, list):
            raise serializers.ValidationError("Les sections doivent être une liste")
        
        if len(sections) == 0:
            raise serializers.ValidationError("Au moins une section est requise")
        
        # Validation de chaque section
        for i, section in enumerate(sections):
            if not isinstance(section, dict):
                raise serializers.ValidationError(f"La section {i+1} doit être un objet")
            
            if 'title' not in section:
                raise serializers.ValidationError(f"La section {i+1} doit avoir un titre")
            
            if 'rules' not in section:
                raise serializers.ValidationError(f"La section {i+1} doit avoir des règles")
            
            if not isinstance(section['rules'], list):
                raise serializers.ValidationError(f"Les règles de la section {i+1} doivent être une liste")
        
        return value


class TradingGoalSerializer(serializers.ModelSerializer):
    """
    Serializer pour les objectifs de trading.
    """
    user_username = serializers.CharField(source='user.username', read_only=True)
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True, allow_null=True)
    progress_percentage = serializers.FloatField(read_only=True)
    remaining_days = serializers.IntegerField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    zone_status = serializers.CharField(read_only=True)
    
    class Meta:
        model = TradingGoal
        fields = [
            'id',
            'user',
            'user_username',
            'goal_type',
            'direction',
            'period_type',
            'threshold_target',
            'threshold_warning',
            'target_value',  # Gardé pour rétrocompatibilité
            'current_value',
            'start_date',
            'end_date',
            'status',
            'trading_account',
            'trading_account_name',
            'priority',
            'notes',
            'progress_percentage',
            'remaining_days',
            'is_overdue',
            'zone_status',
            'created_at',
            'updated_at',
            'last_achieved_alert_sent',
        ]
        read_only_fields = ['user', 'current_value', 'created_at', 'updated_at', 'last_achieved_alert_sent']
    
    def validate(self, data):
        """Valide les données de l'objectif."""
        # Vérifier que end_date est après start_date
        if 'start_date' in data and 'end_date' in data:
            if data['end_date'] <= data['start_date']:
                raise serializers.ValidationError({
                    'end_date': 'La date de fin doit être après la date de début.'
                })
        
        # Utiliser threshold_target si fourni, sinon target_value pour rétrocompatibilité
        # Utiliser des vérifications explicites avec None pour éviter que 0 soit traité comme falsy
        threshold_target = data.get('threshold_target')
        if threshold_target is None:
            threshold_target = self.instance.threshold_target if self.instance else None
        
        target_value = data.get('target_value')
        if target_value is None:
            target_value = self.instance.target_value if self.instance else None
        
        # Si threshold_target n'est pas fourni mais target_value l'est, copier target_value vers threshold_target
        if threshold_target is None and target_value is not None:
            data['threshold_target'] = target_value
            threshold_target = target_value
        
        # Vérifier qu'au moins une valeur cible est fournie
        final_target = threshold_target if threshold_target is not None else target_value
        if final_target is None or final_target <= 0:
            raise serializers.ValidationError({
                'threshold_target': 'Le seuil cible doit être positif.'
            })
        
        # Vérifier la cohérence des seuils selon la direction
        direction = data.get('direction', self.instance.direction if self.instance else 'minimum')
        threshold_warning = data.get('threshold_warning')
        
        if threshold_warning is not None:
            if direction == 'minimum':
                # Pour minimum : warning < target
                if threshold_warning >= final_target:
                    raise serializers.ValidationError({
                        'threshold_warning': 'Le seuil d\'alerte doit être inférieur au seuil cible pour un objectif à atteindre.'
                    })
            else:
                # Pour maximum : warning > target
                if threshold_warning <= final_target:
                    raise serializers.ValidationError({
                        'threshold_warning': 'Le seuil d\'alerte doit être supérieur au seuil cible pour un objectif à ne pas dépasser.'
                    })
        
        # Vérifier que priority est entre 1 et 5
        if 'priority' in data:
            if data['priority'] < 1 or data['priority'] > 5:
                raise serializers.ValidationError({
                    'priority': 'La priorité doit être entre 1 et 5.'
                })
        
        return data
    
    def validate_target_value(self, value):
        """Valide la valeur cible selon le type d'objectif."""
        # Récupérer le goal_type depuis les données ou l'instance existante
        goal_type = self.initial_data.get('goal_type')
        if not goal_type and self.instance:
            goal_type = self.instance.goal_type
        
        # Pour win_rate et strategy_respect, la valeur doit être entre 0 et 100
        if goal_type in ['win_rate', 'strategy_respect']:
            if value < 0 or value > 100:
                raise serializers.ValidationError(
                    'Pour un objectif de taux (win rate, respect stratégie), '
                    'la valeur cible doit être entre 0 et 100.'
                )
        
        # Pour max_drawdown en pourcentage, la valeur doit être positive
        if goal_type == 'max_drawdown' and value < 0:
            raise serializers.ValidationError(
                'Le drawdown maximum doit être une valeur positive.'
            )
        
        return value


class TradingGoalProgressSerializer(serializers.Serializer):
    """
    Serializer pour les données de progression d'un objectif.
    """
    current_value = serializers.DecimalField(max_digits=18, decimal_places=9)
    percentage = serializers.FloatField()
    status = serializers.CharField()
    remaining_days = serializers.IntegerField()
    remaining_amount = serializers.DecimalField(max_digits=18, decimal_places=9)


class AccountTransactionSerializer(serializers.ModelSerializer):
    """
    Serializer pour les transactions de compte (dépôts et retraits).
    """
    user_username = serializers.CharField(source='user.username', read_only=True)
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True)
    signed_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    
    class Meta:
        model = AccountTransaction
        fields = [
            'id',
            'user',
            'user_username',
            'trading_account',
            'trading_account_name',
            'transaction_type',
            'amount',
            'signed_amount',
            'transaction_date',
            'description',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'created_at', 'updated_at']
    
    def validate_trading_account(self, value):
        """Valide que le compte appartient à l'utilisateur."""
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            if value.user != request.user:
                raise serializers.ValidationError("Ce compte ne vous appartient pas.")
        return value
    
    def validate_amount(self, value):
        """Valide que le montant est positif."""
        if value <= 0:
            raise serializers.ValidationError("Le montant doit être positif.")
        return value
    
    def create(self, validated_data):
        """Assigne automatiquement l'utilisateur lors de la création."""
        request = self.context.get('request')
        if request and request.user and request.user.is_authenticated:
            validated_data['user'] = request.user
        else:
            raise serializers.ValidationError('Utilisateur non authentifié')
        
        instance = AccountTransaction.objects.create(**validated_data)
        return instance


class AccountDailyMetricsSerializer(serializers.ModelSerializer):
    """
    Serializer pour les métriques quotidiennes d'un compte de trading.
    """
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True)
    
    class Meta:
        model = AccountDailyMetrics
        fields = [
            'id',
            'trading_account',
            'trading_account_name',
            'date',
            'account_balance',
            'account_balance_high',
            'maximum_loss_limit',
            'mll_is_locked',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
