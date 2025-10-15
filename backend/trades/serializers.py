from rest_framework import serializers
from .models import TopStepTrade, TopStepImportLog, TradeStrategy


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
    
    class Meta:
        model = TopStepTrade
        fields = [
            'id',
            'topstep_id',
            'user',
            'user_username',
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
        read_only_fields = ['user', 'topstep_id', 'imported_at', 'updated_at']


class TopStepTradeListSerializer(serializers.ModelSerializer):
    """
    Serializer simplifié pour la liste des trades (performance).
    """
    net_pnl = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    pnl_percentage = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    is_profitable = serializers.BooleanField(read_only=True)
    duration_str = serializers.CharField(read_only=True)
    
    class Meta:
        model = TopStepTrade
        fields = [
            'id',
            'topstep_id',
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
