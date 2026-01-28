from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from datetime import datetime
from typing import Dict, Any

from trades.models import ExportTemplate, TradingAccount
from trades.serializers import ExportTemplateSerializer, ExportRequestSerializer
from trades.exports.stats_calculator import PortfolioStatsCalculator
from trades.exports.pdf_generator import PDFGenerator
from trades.exports.excel_generator import ExcelGenerator
from trades.exports.report_translations import get_report_translations


class ExportTemplateViewSet(viewsets.ModelViewSet):
    """
    ViewSet pour gérer les templates d'export personnalisés.
    
    Endpoints:
    - GET /api/export-templates/ : Liste des templates de l'utilisateur
    - POST /api/export-templates/ : Créer un nouveau template
    - GET /api/export-templates/{id}/ : Détails d'un template
    - PUT /api/export-templates/{id}/ : Modifier un template
    - DELETE /api/export-templates/{id}/ : Supprimer un template
    - POST /api/export-templates/{id}/set-default/ : Définir comme template par défaut
    """
    serializer_class = ExportTemplateSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Retourne uniquement les templates de l'utilisateur connecté."""
        qs = ExportTemplate.objects.filter(user=self.request.user)
        template_format = self.request.query_params.get('template_format')
        if template_format in {'pdf', 'excel'}:
            qs = qs.filter(format=template_format)
        return qs
    
    def perform_create(self, serializer):
        """Associe le template à l'utilisateur connecté."""
        serializer.save(user=self.request.user)
    
    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Définit ce template comme template par défaut pour son format."""
        template = self.get_object()
        template.is_default = True
        template.save()
        
        return Response({
            'status': 'success',
            'message': f'Template "{template.name}" défini comme template par défaut pour {template.get_format_display()}.'
        })
    
    @action(detail=False, methods=['get'])
    def defaults(self, request):
        """Retourne les templates par défaut pour chaque format."""
        pdf_default = ExportTemplate.objects.filter(
            user=request.user,
            format='pdf',
            is_default=True
        ).first()
        
        excel_default = ExportTemplate.objects.filter(
            user=request.user,
            format='excel',
            is_default=True
        ).first()
        
        return Response({
            'pdf': ExportTemplateSerializer(pdf_default).data if pdf_default else None,
            'excel': ExportTemplateSerializer(excel_default).data if excel_default else None,
        })


class PortfolioExportViewSet(viewsets.ViewSet):
    """
    ViewSet pour gérer l'export des statistiques de portefeuille.
    
    Endpoints:
    - POST /api/portfolio-export/generate/ : Générer et télécharger un export
    """
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Retourne les permissions pour cette vue."""
        return [permission() for permission in self.permission_classes]
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def generate(self, request):
        """
        Génère un export PDF ou Excel des statistiques de portefeuille.
        
        Body:
        {
            "trading_account_id": 1,
            "format": "pdf",  // ou "excel"
            "template_id": 1,  // optionnel
            "configuration": {...},  // optionnel si template_id fourni
            "start_date": "2024-01-01T00:00:00Z",  // optionnel
            "end_date": "2024-12-31T23:59:59Z"  // optionnel
        }
        """
        serializer = ExportRequestSerializer(data=request.data, context={'request': request})
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        language = data.get('language')
        translations = get_report_translations(language)
        
        trading_account = get_object_or_404(
            TradingAccount,
            id=data['trading_account_id'],
            user=request.user
        )
        
        config = self._get_configuration(data, request.user)
        
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        
        stats_calculator = PortfolioStatsCalculator(
            trading_account,
            start_date=start_date,
            end_date=end_date
        )
        stats = stats_calculator.calculate_all_stats()
        
        if 'options' not in config:
            config['options'] = {}
        config['options']['period_start'] = start_date.strftime('%d/%m/%Y') if start_date else translations['period']['start']
        config['options']['period_end'] = end_date.strftime('%d/%m/%Y') if end_date else translations['period']['end']
        config['options']['language'] = translations['lang']
        
        export_format = data.get('format', 'pdf')
        
        if export_format == 'pdf':
            file_content = self._generate_pdf(trading_account, stats, config, translations)
            filename = f"report_{trading_account.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            content_type = 'application/pdf'
        else:
            file_content = self._generate_excel(trading_account, stats, config)
            filename = f"report_{trading_account.name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
        response = HttpResponse(file_content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
    
    def _get_configuration(self, data: Dict[str, Any], user) -> Dict[str, Any]:
        """Récupère la configuration depuis le template ou les données."""
        if data.get('template_id'):
            template = get_object_or_404(ExportTemplate, id=data['template_id'], user=user)
            config = template.configuration.copy()
            
            if data.get('configuration'):
                config.update(data['configuration'])
            
            return config
        
        return data.get('configuration', self._get_default_configuration())
    
    def _get_default_configuration(self) -> Dict[str, Any]:
        """Retourne une configuration par défaut."""
        return {
            'sections': {
                'header': True,
                'metrics': ['pnl_total', 'win_rate', 'profit_factor', 'max_drawdown'],
                'charts': ['equity_curve', 'monthly_performance'],
                'analysis': ['by_strategy', 'by_instrument'],
                'trades_list': 'top_10_best_worst'
            },
            'options': {
                'watermark': True,
                'page_numbers': True,
            }
        }
    
    def _generate_pdf(self, trading_account, stats: Dict[str, Any], config: Dict[str, Any], translations: Dict[str, Any]):
        """Génère le PDF."""
        generator = PDFGenerator(trading_account, stats, config, translations)
        return generator.generate()
    
    def _generate_excel(self, trading_account, stats: Dict[str, Any], config: Dict[str, Any]):
        """Génère le fichier Excel."""
        generator = ExcelGenerator(trading_account, stats, config)
        return generator.generate()
