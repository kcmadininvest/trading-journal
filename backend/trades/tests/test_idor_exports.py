"""IDOR exports : portfolio-export, templates, export-data, campaign export."""
from decimal import Decimal

from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import AppSettings, User
from trades.models import ExportTemplate, ImportedTrade, PositionStrategy, TradingAccount


class IdorExportsTests(APITestCase):
    def setUp(self) -> None:
        app = AppSettings.get_solo()
        app.premium_restrictions_enabled = False
        app.save(update_fields=['premium_restrictions_enabled'])

        self.user_a = User.objects.create_user(
            email='idor-exp-a@example.com',
            username='idor_exp_a',
            password='testpass123',
            first_name='A',
            last_name='Export',
            role='user',
        )
        self.user_b = User.objects.create_user(
            email='idor-exp-b@example.com',
            username='idor_exp_b',
            password='testpass123',
            first_name='B',
            last_name='Export',
            role='user',
        )
        self.account_a = TradingAccount.objects.create(
            user=self.user_a,
            name='Export Account A',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
            is_default=True,
        )
        self.marker_account_name = 'IDOR_MARKER_ACCT_B_UNIQUE_ZZ9'
        self.account_b = TradingAccount.objects.create(
            user=self.user_b,
            name=self.marker_account_name,
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
            is_default=True,
        )
        now = timezone.now()
        self.marker_trade_id = 'IDOR_MARKER_TRADE_B_UNIQUE_ZZ9'
        ImportedTrade.objects.create(
            user=self.user_b,
            trading_account=self.account_b,
            external_trade_id=self.marker_trade_id,
            contract_name='MNQ',
            entered_at=now,
            exited_at=now,
            entry_price=Decimal('100'),
            exit_price=Decimal('110'),
            size=Decimal('1'),
            trade_type='Long',
            trade_day=now.date(),
            pnl=Decimal('10'),
        )
        self.template_b = ExportTemplate.objects.create(
            user=self.user_b,
            name='Template B',
            format='pdf',
            configuration={
                'sections': {'header': True, 'metrics': [], 'charts': [], 'analysis': []},
                'options': {},
            },
        )
        self.template_a = ExportTemplate.objects.create(
            user=self.user_a,
            name='Template A',
            format='pdf',
            configuration={
                'sections': {'header': True, 'metrics': [], 'charts': [], 'analysis': []},
                'options': {},
            },
        )

    def test_portfolio_export_alien_account_404(self) -> None:
        """Serializer ownership → 400 (avant get_object_or_404)."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(
            '/api/trades/portfolio-export/generate/',
            {
                'trading_account_id': self.account_b.id,
                'format': 'pdf',
                'template_id': self.template_a.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('trading_account_id', response.data)

    def test_portfolio_export_alien_template_404(self) -> None:
        """Serializer ownership → 400 (avant get_object_or_404)."""
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(
            '/api/trades/portfolio-export/generate/',
            {
                'trading_account_id': self.account_a.id,
                'format': 'pdf',
                'template_id': self.template_b.id,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('template_id', response.data)

    def test_export_template_alien_crud_404(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        pk = self.template_b.id
        get_res = self.client.get(f'/api/trades/export-templates/{pk}/')
        self.assertEqual(get_res.status_code, 404, get_res.data)
        patch_res = self.client.patch(
            f'/api/trades/export-templates/{pk}/',
            {'name': 'Hacked'},
            format='json',
        )
        self.assertEqual(patch_res.status_code, 404, patch_res.data)
        delete_res = self.client.delete(f'/api/trades/export-templates/{pk}/')
        self.assertEqual(delete_res.status_code, 404, delete_res.data)
        self.assertTrue(ExportTemplate.objects.filter(id=pk, user=self.user_b).exists())

    def test_export_data_excludes_other_user_markers(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get('/api/accounts/export-data/')
        self.assertEqual(response.status_code, 200, response.content[:200])
        body = response.content.decode('utf-8')
        self.assertNotIn(self.marker_account_name, body)
        self.assertNotIn(self.marker_trade_id, body)
        self.assertNotIn(self.user_b.email, body)

    def test_backtest_campaign_export_alien_404(self) -> None:
        position = PositionStrategy.objects.create(
            user=self.user_b,
            title='IDOR Export Strategy B',
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'Setup', 'rules': ['OR']}]},
        )
        self.client.force_authenticate(user=self.user_b)
        strategy_res = self.client.post(
            '/api/backtest-journal/strategies/',
            {'position_strategy': position.id, 'default_instrument': 'NQ'},
            format='json',
        )
        self.assertEqual(strategy_res.status_code, 201, strategy_res.data)
        version_id = strategy_res.data['versions'][0]['id']
        campaign_res = self.client.post(
            '/api/backtest-journal/campaigns/',
            {
                'strategy_version': version_id,
                'name': 'IDOR Campaign B',
                'instrument': 'NQ',
                'period_start': '2026-03-01',
                'period_end': '2026-03-31',
                'timezone': 'America/New_York',
            },
            format='json',
        )
        self.assertEqual(campaign_res.status_code, 201, campaign_res.data)
        campaign_id = campaign_res.data['id']

        self.client.force_authenticate(user=self.user_a)
        export_res = self.client.get(f'/api/backtest-journal/campaigns/{campaign_id}/export/')
        self.assertEqual(export_res.status_code, 404, getattr(export_res, 'data', export_res.content))
