from io import BytesIO
from datetime import datetime
from typing import Dict, Any, Optional
from django.template.loader import render_to_string
from django.conf import settings
from weasyprint import HTML, CSS
import base64
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.figure import Figure
import io


class PDFGenerator:
    """
    Générateur de rapports PDF pour les statistiques de portefeuille.
    Utilise WeasyPrint pour convertir HTML en PDF.
    """
    
    def __init__(
        self,
        trading_account,
        stats: Dict[str, Any],
        config: Dict[str, Any],
        translations: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialise le générateur PDF.
        
        Args:
            trading_account: Instance de TradingAccount
            stats: Dictionnaire des statistiques calculées
            config: Configuration de l'export (sections à inclure)
        """
        self.trading_account = trading_account
        self.stats = stats
        self.config = config
        self.translations = translations or {}
        self.charts = {}
        
    def generate(self) -> BytesIO:
        """
        Génère le PDF et retourne un BytesIO.
        
        Returns:
            BytesIO contenant le PDF généré
        """
        self._generate_charts()
        
        html_content = self._render_html()
        
        pdf_file = BytesIO()
        HTML(string=html_content).write_pdf(
            pdf_file,
            stylesheets=[CSS(string=self._get_css())]
        )
        pdf_file.seek(0)
        
        return pdf_file
    
    def _generate_charts(self):
        """Génère tous les graphiques nécessaires."""
        sections = self.config.get('sections', {})
        charts = sections.get('charts', [])
        
        if 'equity_curve' in charts:
            self.charts['equity_curve'] = self._generate_equity_curve()
        
        if 'monthly_performance' in charts:
            self.charts['monthly_performance'] = self._generate_monthly_performance()
        
        if 'win_loss_distribution' in charts:
            self.charts['win_loss_distribution'] = self._generate_win_loss_pie()
        
        if 'pnl_distribution' in charts:
            self.charts['pnl_distribution'] = self._generate_pnl_distribution()
        
        if 'drawdown_curve' in charts:
            self.charts['drawdown_curve'] = self._generate_drawdown_curve()
    
    def _generate_equity_curve(self) -> str:
        """Génère le graphique de la courbe d'équité."""
        equity_data = self.stats.get('equity_curve', [])
        
        if not equity_data:
            return ''
        
        fig, ax = plt.subplots(figsize=(10, 5))
        
        dates = [point['date'] for point in equity_data]
        balances = [point['balance'] for point in equity_data]
        
        ax.plot(dates, balances, linewidth=2, color='#2563eb')
        ax.fill_between(range(len(balances)), balances, alpha=0.3, color='#2563eb')

        labels = self.translations.get('charts', {})
        ax.set_xlabel(labels.get('equity_x', 'Date'), fontsize=10)
        ax.set_ylabel(labels.get('equity_y', 'Capital (€)'), fontsize=10)
        ax.set_title(labels.get('equity_curve', "Courbe d'Équité"), fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3)
        
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def _generate_monthly_performance(self) -> str:
        """Génère le graphique de performance mensuelle."""
        monthly_data = self.stats.get('monthly_performance', [])
        
        if not monthly_data:
            return ''
        
        fig, ax = plt.subplots(figsize=(10, 5))
        
        months = [m['month'] for m in monthly_data]
        pnls = [m['total_pnl'] for m in monthly_data]
        
        colors = ['#22c55e' if pnl >= 0 else '#ef4444' for pnl in pnls]
        
        ax.bar(months, pnls, color=colors, alpha=0.8)
        ax.axhline(y=0, color='black', linestyle='-', linewidth=0.5)

        labels = self.translations.get('charts', {})
        ax.set_xlabel(labels.get('monthly_x', 'Mois'), fontsize=10)
        ax.set_ylabel(labels.get('monthly_y', 'P&L (€)'), fontsize=10)
        ax.set_title(labels.get('monthly_performance', 'Performance Mensuelle'), fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='y')
        
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def _generate_win_loss_pie(self) -> str:
        """Génère le graphique circulaire win/loss."""
        general = self.stats.get('general', {})
        
        winning = general.get('winning_trades', 0)
        losing = general.get('losing_trades', 0)
        breakeven = general.get('breakeven_trades', 0)
        
        if winning + losing + breakeven == 0:
            return ''
        
        fig, ax = plt.subplots(figsize=(7, 7))
        
        labels = []
        sizes = []
        colors = []

        t = self.translations.get('charts', {})
        
        if winning > 0:
            labels.append(f"{t.get('pie_winning', 'Gagnants')} ({winning})")
            sizes.append(winning)
            colors.append('#22c55e')
        
        if losing > 0:
            labels.append(f"{t.get('pie_losing', 'Perdants')} ({losing})")
            sizes.append(losing)
            colors.append('#ef4444')
        
        if breakeven > 0:
            labels.append(f"{t.get('pie_breakeven', 'Breakeven')} ({breakeven})")
            sizes.append(breakeven)
            colors.append('#94a3b8')
        
        ax.pie(sizes, labels=labels, colors=colors, autopct='%1.1f%%', startangle=90)
        ax.set_title(t.get('win_loss_distribution', 'Répartition des Trades'), fontsize=12, fontweight='bold')
        
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def _generate_pnl_distribution(self) -> str:
        """Génère l'histogramme de distribution des P&L."""
        equity_data = self.stats.get('equity_curve', [])
        
        if not equity_data or len(equity_data) < 2:
            return ''
        
        pnls = [point['pnl'] for point in equity_data if 'pnl' in point and point['pnl'] != 0]
        
        if not pnls:
            return ''
        
        fig, ax = plt.subplots(figsize=(10, 5))
        
        ax.hist(pnls, bins=30, color='#2563eb', alpha=0.7, edgecolor='black')
        ax.axvline(x=0, color='red', linestyle='--', linewidth=1)

        labels = self.translations.get('charts', {})
        ax.set_xlabel(labels.get('pnl_x', 'P&L (€)'), fontsize=10)
        ax.set_ylabel(labels.get('pnl_y', 'Fréquence'), fontsize=10)
        ax.set_title(labels.get('pnl_distribution', 'Distribution des P&L'), fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3, axis='y')
        
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def _generate_drawdown_curve(self) -> str:
        """Génère la courbe de drawdown."""
        equity_data = self.stats.get('equity_curve', [])
        
        if not equity_data:
            return ''
        
        balances = [point['balance'] for point in equity_data]
        
        peak = balances[0]
        drawdowns = []
        
        for balance in balances:
            if balance > peak:
                peak = balance
            dd_pct = ((peak - balance) / peak * 100) if peak > 0 else 0
            drawdowns.append(-dd_pct)
        
        fig, ax = plt.subplots(figsize=(10, 5))
        
        ax.plot(range(len(drawdowns)), drawdowns, linewidth=2, color='#ef4444')
        ax.fill_between(range(len(drawdowns)), drawdowns, 0, alpha=0.3, color='#ef4444')

        labels = self.translations.get('charts', {})
        ax.set_xlabel(labels.get('drawdown_x', 'Trades'), fontsize=10)
        ax.set_ylabel(labels.get('drawdown_y', 'Drawdown (%)'), fontsize=10)
        ax.set_title(labels.get('drawdown_curve', 'Courbe de Drawdown'), fontsize=12, fontweight='bold')
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def _fig_to_base64(self, fig: Figure) -> str:
        """Convertit une figure matplotlib en base64."""
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=150, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        return f"data:image/png;base64,{img_base64}"
    
    def _render_html(self) -> str:
        """Rend le template HTML avec les données."""
        generated_at = datetime.now()
        generated_str = generated_at.strftime('%d/%m/%Y %H:%M')

        watermark_template = self.translations.get('watermark')
        watermark_text = None
        if watermark_template:
            try:
                watermark_text = watermark_template.format(
                    generated=generated_str,
                    account=getattr(self.trading_account, 'name', ''),
                )
            except Exception:
                watermark_text = None

        context = {
            'trading_account': self.trading_account,
            'stats': self.stats,
            'config': self.config,
            'charts': self.charts,
            'generated_at': generated_at,
            'watermark_text': watermark_text,
            'i18n': self.translations,
        }
        
        return render_to_string('trades/exports/portfolio_report.html', context)
    
    def _get_css(self) -> str:
        """Retourne le CSS pour le PDF."""
        return """
        @page {
            size: A4;
            margin: 2cm;
            @bottom-right {
                content: "Page " counter(page) " / " counter(pages);
                font-size: 9pt;
                color: #64748b;
            }
        }
        
        body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 10pt;
            line-height: 1.5;
            color: #1e293b;
        }

        .generated-on {
            font-size: 12pt;
            font-weight: 500;
            color: #334155;
            margin-top: 0;
            margin-bottom: 10pt;
        }

        .metadata-table {
            width: 100%;
            border-collapse: collapse;
        }

        .metadata-table th,
        .metadata-table td {
            text-align: left;
            padding: 4pt 6pt;
        }

        .metadata-table th {
            font-weight: 600;
            color: #475569;
            text-transform: uppercase;
            font-size: 10pt;
        }

        .metadata-table td {
            font-size: 10pt;
            color: #1e293b;
        }

        .metadata-table thead {
            background: transparent;
        }

        .metadata-table th {
            background: transparent;
        }
        
        h1 {
            color: #0f172a;
            font-size: 24pt;
            margin-bottom: 10pt;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 10pt;
        }
        
        h2 {
            color: #1e293b;
            font-size: 16pt;
            margin-top: 20pt;
            margin-bottom: 10pt;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 5pt;
        }
        
        h3 {
            color: #334155;
            font-size: 12pt;
            margin-top: 15pt;
            margin-bottom: 8pt;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30pt;
        }
        
        .header h1 {
            border: none;
        }
        
        .metadata {
            background-color: #f1f5f9;
            padding: 10pt;
            border-radius: 5pt;
            margin-bottom: 20pt;
        }
        
        .metadata table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .metadata td {
            padding: 5pt;
        }
        
        .metadata .label {
            font-weight: bold;
            color: #475569;
            width: 40%;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10pt;
            margin-bottom: 20pt;
        }
        
        .stat-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 5pt;
            padding: 10pt;
            text-align: center;
        }
        
        .stat-card .label {
            font-size: 9pt;
            color: #64748b;
            margin-bottom: 5pt;
        }
        
        .stat-card .value {
            font-size: 16pt;
            font-weight: bold;
            color: #0f172a;
        }
        
        .stat-card.positive .value {
            color: #22c55e;
        }
        
        .stat-card.negative .value {
            color: #ef4444;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20pt;
        }
        
        table thead {
            background-color: #2563eb;
            color: white;
        }
        
        table th {
            padding: 8pt;
            text-align: left;
            font-weight: bold;
        }
        
        table td {
            padding: 8pt;
            border-bottom: 1px solid #e2e8f0;
        }
        
        table tbody tr:nth-child(even) {
            background-color: #f8fafc;
        }
        
        .chart {
            margin: 20pt 0;
            text-align: center;
        }
        
        .chart img {
            max-width: 100%;
            height: auto;
        }
        
        .positive {
            color: #22c55e;
        }
        
        .negative {
            color: #ef4444;
        }
        
        .watermark {
            position: fixed;
            bottom: 1cm;
            right: 1cm;
            font-size: 8pt;
            color: #94a3b8;
        }
        
        .page-break {
            page-break-after: always;
        }
        """
