"""
ViewSets pour les endpoints d'analyse statistique des trades.
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import transaction

from .models import TopStepTrade
from .models_analytics import (
    TradeContext,
    TradeSetup,
    SessionContext,
    TradeExecution,
)
from .models_statistics import (
    TradeProbabilityFactor,
    TradeTag,
    TradeTagAssignment,
    TradeStatistics,
    ConditionalProbability,
)
from .serializers_analytics import (
    TradeContextSerializer,
    TradeSetupSerializer,
    SessionContextSerializer,
    TradeExecutionSerializer,
    TradeProbabilityFactorSerializer,
    TradeTagSerializer,
    TradeTagAssignmentSerializer,
    TradeStatisticsSerializer,
    ConditionalProbabilitySerializer,
    BulkTradeAnalyticsSerializer,
)
from .services.analytics_service import (
    TradeAnalysisService,
    PatternRecognitionService,
)


class TradeContextViewSet(viewsets.ModelViewSet):
    """ViewSet pour les contextes de marché."""
    
    serializer_class = TradeContextSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TradeContext.objects.filter(trade__user=self.request.user)
    
    def perform_create(self, serializer):
        # Vérifier que le trade appartient à l'utilisateur
        trade_id = self.request.data.get('trade')
        if not TopStepTrade.objects.filter(id=trade_id, user=self.request.user).exists():
            raise PermissionError("Ce trade ne vous appartient pas")
        serializer.save()


class TradeSetupViewSet(viewsets.ModelViewSet):
    """ViewSet pour les setups de trading."""
    
    serializer_class = TradeSetupSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TradeSetup.objects.filter(trade__user=self.request.user)
    
    def perform_create(self, serializer):
        trade_id = self.request.data.get('trade')
        if not TopStepTrade.objects.filter(id=trade_id, user=self.request.user).exists():
            raise PermissionError("Ce trade ne vous appartient pas")
        serializer.save()


class SessionContextViewSet(viewsets.ModelViewSet):
    """ViewSet pour les contextes de session."""
    
    serializer_class = SessionContextSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return SessionContext.objects.filter(trade__user=self.request.user)
    
    def perform_create(self, serializer):
        trade_id = self.request.data.get('trade')
        if not TopStepTrade.objects.filter(id=trade_id, user=self.request.user).exists():
            raise PermissionError("Ce trade ne vous appartient pas")
        serializer.save()


class TradeExecutionViewSet(viewsets.ModelViewSet):
    """ViewSet pour les exécutions de trades."""
    
    serializer_class = TradeExecutionSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TradeExecution.objects.filter(trade__user=self.request.user)
    
    def perform_create(self, serializer):
        trade_id = self.request.data.get('trade')
        if not TopStepTrade.objects.filter(id=trade_id, user=self.request.user).exists():
            raise PermissionError("Ce trade ne vous appartient pas")
        serializer.save()


class TradeProbabilityFactorViewSet(viewsets.ModelViewSet):
    """ViewSet pour les facteurs de probabilité."""
    
    serializer_class = TradeProbabilityFactorSerializer
    permission_classes = [IsAuthenticated]
    queryset = TradeProbabilityFactor.objects.filter(is_active=True)


class TradeTagViewSet(viewsets.ModelViewSet):
    """ViewSet pour les tags de trades."""
    
    serializer_class = TradeTagSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TradeTag.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TradeTagAssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet pour l'attribution de tags aux trades."""
    
    serializer_class = TradeTagAssignmentSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TradeTagAssignment.objects.filter(trade__user=self.request.user)
    
    def perform_create(self, serializer):
        trade_id = self.request.data.get('trade')
        tag_id = self.request.data.get('tag')
        
        # Vérifier que le trade appartient à l'utilisateur
        if not TopStepTrade.objects.filter(id=trade_id, user=self.request.user).exists():
            raise PermissionError("Ce trade ne vous appartient pas")
        
        # Vérifier que le tag appartient à l'utilisateur
        if not TradeTag.objects.filter(id=tag_id, user=self.request.user).exists():
            raise PermissionError("Ce tag ne vous appartient pas")
        
        serializer.save()


class TradeAnalyticsViewSet(viewsets.ViewSet):
    """
    ViewSet pour les analyses statistiques avancées.
    Fournit des endpoints pour calculer des probabilités et identifier des patterns.
    """
    
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'])
    def calculate_statistics(self, request):
        """
        Calcule les statistiques pour un ensemble de trades.
        
        Body:
            - filters: Dict de filtres (optionnel)
            - trading_account_id: ID du compte (optionnel)
        """
        filters = request.data.get('filters', {})
        trading_account_id = request.data.get('trading_account_id')
        
        service = TradeAnalysisService(request.user)
        stats = service.calculate_statistics(filters, trading_account_id)
        
        serializer = TradeStatisticsSerializer(stats)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def conditional_probability(self, request):
        """
        Calcule la probabilité conditionnelle selon des conditions.
        
        Body:
            - conditions: Dict de conditions (ex: {'context__trend_m15': 'bullish'})
            - min_sample_size: Taille minimale de l'échantillon (défaut: 30)
        """
        conditions = request.data.get('conditions', {})
        min_sample_size = request.data.get('min_sample_size', 30)
        
        if not conditions:
            return Response(
                {'error': 'Les conditions sont requises'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = TradeAnalysisService(request.user)
        prob = service.calculate_conditional_probability(conditions, min_sample_size)
        
        serializer = ConditionalProbabilitySerializer(prob)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def best_setups(self, request):
        """
        Retourne les meilleurs setups par expectancy.
        
        Query params:
            - min_sample_size: Taille minimale de l'échantillon (défaut: 30)
        """
        min_sample_size = int(request.query_params.get('min_sample_size', 30))
        
        service = TradeAnalysisService(request.user)
        best_setups = service.find_best_setups(min_sample_size)
        
        return Response({'best_setups': best_setups})
    
    @action(detail=False, methods=['get'])
    def worst_patterns(self, request):
        """Retourne les patterns perdants récurrents."""
        service = TradeAnalysisService(request.user)
        worst_patterns = service.find_worst_patterns()
        
        return Response({'worst_patterns': worst_patterns})
    
    @action(detail=False, methods=['post'])
    def compare_conditions(self, request):
        """
        Compare deux ensembles de conditions.
        
        Body:
            - condition_a: Premier ensemble de conditions
            - condition_b: Deuxième ensemble de conditions
        """
        condition_a = request.data.get('condition_a', {})
        condition_b = request.data.get('condition_b', {})
        
        if not condition_a or not condition_b:
            return Response(
                {'error': 'Les deux ensembles de conditions sont requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = TradeAnalysisService(request.user)
        comparison = service.compare_conditions(condition_a, condition_b)
        
        return Response(comparison)
    
    @action(detail=False, methods=['get'])
    def edge_analysis(self, request):
        """Retourne une analyse complète de l'edge statistique."""
        service = TradeAnalysisService(request.user)
        analysis = service.get_edge_analysis()
        
        return Response(analysis)
    
    @action(detail=False, methods=['get'])
    def recurring_patterns(self, request):
        """Identifie les patterns récurrents."""
        service = PatternRecognitionService(request.user)
        patterns = service.identify_recurring_patterns()
        
        return Response({'patterns': patterns})
    
    @action(detail=True, methods=['get'])
    def similar_trades(self, request, pk=None):
        """
        Trouve les trades similaires à un trade donné.
        
        Query params:
            - max_results: Nombre maximum de résultats (défaut: 10)
        """
        if pk is None:
            return Response({'error': 'Trade ID is required'}, status=400)
        
        max_results = int(request.query_params.get('max_results', 10))
        
        service = PatternRecognitionService(request.user)
        similar = service.cluster_similar_trades(int(pk), max_results)
        
        return Response({'similar_trades': similar})
    
    @action(detail=False, methods=['get'])
    def behavioral_biases(self, request):
        """Détecte les biais comportementaux."""
        service = PatternRecognitionService(request.user)
        biases = service.detect_behavioral_biases()
        
        return Response({'biases': biases})
    
    @action(detail=False, methods=['get'])
    def get_trade_analytics(self, request):
        """
        Récupère toutes les données analytiques pour un trade.
        
        Query params:
            - trade_id: ID du trade
        """
        trade_id = request.query_params.get('trade_id')
        if not trade_id:
            return Response(
                {'error': 'trade_id est requis'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Vérifier que le trade appartient à l'utilisateur
        try:
            trade = TopStepTrade.objects.get(id=trade_id, user=request.user)
        except TopStepTrade.DoesNotExist:
            return Response(
                {'error': 'Trade non trouvé'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        analytics_data = {}
        
        # Récupérer le contexte
        try:
            context = TradeContext.objects.get(trade=trade)
            analytics_data['context'] = TradeContextSerializer(context).data
        except TradeContext.DoesNotExist:
            analytics_data['context'] = None
        
        # Récupérer le setup
        try:
            setup = TradeSetup.objects.get(trade=trade)
            analytics_data['setup'] = TradeSetupSerializer(setup).data
        except TradeSetup.DoesNotExist:
            analytics_data['setup'] = None
        
        # Récupérer le contexte de session
        try:
            session = SessionContext.objects.get(trade=trade)
            analytics_data['session_context'] = SessionContextSerializer(session).data
        except SessionContext.DoesNotExist:
            analytics_data['session_context'] = None
        
        # Récupérer l'exécution
        try:
            execution = TradeExecution.objects.get(trade=trade)
            analytics_data['execution'] = TradeExecutionSerializer(execution).data
        except TradeExecution.DoesNotExist:
            analytics_data['execution'] = None
        
        # Récupérer les tags
        tag_assignments = TradeTagAssignment.objects.filter(trade=trade)
        analytics_data['tags'] = TradeTagSerializer(
            [assignment.tag for assignment in tag_assignments],
            many=True
        ).data
        
        return Response(analytics_data)
    
    @action(detail=False, methods=['post'])
    def bulk_create_analytics(self, request):
        """
        Crée en masse les données analytiques pour un trade.
        
        Body:
            - trade_id: ID du trade
            - context: Données de contexte (optionnel)
            - setup: Données de setup (optionnel)
            - session_context: Données de session (optionnel)
            - execution: Données d'exécution (optionnel)
            - tag_ids: Liste d'IDs de tags (optionnel)
        """
        serializer = BulkTradeAnalyticsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        trade_id = serializer.validated_data['trade_id']
        
        # Vérifier que le trade appartient à l'utilisateur
        try:
            trade = TopStepTrade.objects.get(id=trade_id, user=request.user)
        except TopStepTrade.DoesNotExist:
            return Response(
                {'error': 'Trade non trouvé'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        created_objects = {}
        
        with transaction.atomic():
            # Créer ou mettre à jour le contexte
            if 'context' in serializer.validated_data and serializer.validated_data['context']:
                context_data = serializer.validated_data['context']
                try:
                    context = TradeContext.objects.get(trade_id=trade_id)
                    context_serializer = TradeContextSerializer(context, data=context_data, partial=True)
                except TradeContext.DoesNotExist:
                    context_data['trade'] = trade_id
                    context_serializer = TradeContextSerializer(data=context_data)
                
                context_serializer.is_valid(raise_exception=True)
                context = context_serializer.save()
                created_objects['context'] = TradeContextSerializer(context).data
            
            # Créer ou mettre à jour le setup
            if 'setup' in serializer.validated_data and serializer.validated_data['setup']:
                setup_data = serializer.validated_data['setup']
                try:
                    setup = TradeSetup.objects.get(trade_id=trade_id)
                    setup_serializer = TradeSetupSerializer(setup, data=setup_data, partial=True)
                except TradeSetup.DoesNotExist:
                    setup_data['trade'] = trade_id
                    setup_serializer = TradeSetupSerializer(data=setup_data)
                
                setup_serializer.is_valid(raise_exception=True)
                setup = setup_serializer.save()
                created_objects['setup'] = TradeSetupSerializer(setup).data
            
            # Créer ou mettre à jour le contexte de session
            if 'session_context' in serializer.validated_data and serializer.validated_data['session_context']:
                session_data = serializer.validated_data['session_context']
                try:
                    session = SessionContext.objects.get(trade_id=trade_id)
                    session_serializer = SessionContextSerializer(session, data=session_data, partial=True)
                except SessionContext.DoesNotExist:
                    session_data['trade'] = trade_id
                    session_serializer = SessionContextSerializer(data=session_data)
                
                session_serializer.is_valid(raise_exception=True)
                session = session_serializer.save()
                created_objects['session_context'] = SessionContextSerializer(session).data
            
            # Créer ou mettre à jour l'exécution
            if 'execution' in serializer.validated_data and serializer.validated_data['execution']:
                execution_data = serializer.validated_data['execution']
                try:
                    execution = TradeExecution.objects.get(trade_id=trade_id)
                    execution_serializer = TradeExecutionSerializer(execution, data=execution_data, partial=True)
                except TradeExecution.DoesNotExist:
                    execution_data['trade'] = trade_id
                    execution_serializer = TradeExecutionSerializer(data=execution_data)
                
                execution_serializer.is_valid(raise_exception=True)
                execution = execution_serializer.save()
                created_objects['execution'] = TradeExecutionSerializer(execution).data
            
            # Assigner les tags
            if 'tag_ids' in serializer.validated_data and serializer.validated_data['tag_ids']:
                tag_ids = serializer.validated_data['tag_ids']
                tags = TradeTag.objects.filter(id__in=tag_ids, user=request.user)
                
                assignments = []
                for tag in tags:
                    assignment, created = TradeTagAssignment.objects.get_or_create(
                        trade=trade,
                        tag=tag
                    )
                    if created:
                        assignments.append(assignment)
                
                created_objects['tags'] = TradeTagAssignmentSerializer(assignments, many=True).data
        
        return Response({
            'message': 'Données analytiques créées avec succès',
            'created': created_objects
        }, status=status.HTTP_201_CREATED)


class TradeStatisticsViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet en lecture seule pour les statistiques de trades."""
    
    serializer_class = TradeStatisticsSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return TradeStatistics.objects.filter(user=self.request.user).order_by('-calculated_at')


class ConditionalProbabilityViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet en lecture seule pour les probabilités conditionnelles."""
    
    serializer_class = ConditionalProbabilitySerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        return ConditionalProbability.objects.filter(user=self.request.user).order_by('-calculated_at')
