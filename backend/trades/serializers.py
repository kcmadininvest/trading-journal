from rest_framework import serializers
from .models import TopStepTrade, TopStepImportLog, TradeStrategy, PositionStrategy, TradingAccount


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
            'currency',
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
            'is_profitable',
            'formatted_entry_date',
            'formatted_exit_date',
            'imported_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'topstep_id', 'trading_account', 'imported_at', 'updated_at']


class TopStepTradeListSerializer(serializers.ModelSerializer):
    """
    Serializer simplifié pour la liste des trades (performance).
    """
    net_pnl = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    pnl_percentage = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_profitable = serializers.BooleanField(read_only=True)
    duration_str = serializers.CharField(read_only=True)
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True)
    
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
            'fees',
            'commissions',
            'pnl',
            'net_pnl',
            'pnl_percentage',
            'is_profitable',
            'trade_duration',
            'duration_str',
            'trade_day'
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
    Serializer pour l'upload de fichiers CSV.
    """
    file = serializers.FileField()
    
    def validate_file(self, value):
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Le fichier doit être au format CSV")
        if value.size > 10 * 1024 * 1024:  # 10MB max
            raise serializers.ValidationError("Le fichier ne doit pas dépasser 10MB")
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
        if obj.parent_strategy:
            return obj.parent_strategy.versions.count()
        return obj.versions.count()
    
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
