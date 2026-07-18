"""Tests copy trading : même external_trade_id sur deux comptes, serializer, importeur."""
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.test import TestCase

from accounts.models import User
from trades.models import ImportedTrade, TradingAccount
from trades.serializers import TradingAccountSerializer
from trades.utils import TopStepCSVImporter


MINIMAL_CSV_HEADER = (
    'Id,ContractName,EnteredAt,ExitedAt,EntryPrice,ExitPrice,Fees,PnL,Size,Type,TradeDay,TradeDuration,Commissions\n'
)


def _csv_line(tid='999888777'):
    return (
        f'{tid},NQZ5,10/08/2025 18:23:28 +02:00,10/08/2025 18:31:03 +02:00,'
        '25261.75,25245.75,8.4,-960,3,Long,10/08/2025 00:00:00 -05:00,00:07:34,0\n'
    )


class CopyImportSameTopstepIdTwoAccountsTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='copy-import@example.com',
            username='copy_import_user',
            password='testpass123',
        )
        self.leader = TradingAccount.objects.create(
            user=self.user,
            name='Leader',
            account_type='topstep',
            currency='USD',
            status='active',
        )
        self.follower = TradingAccount.objects.create(
            user=self.user,
            name='Follower',
            account_type='topstep',
            currency='USD',
            status='active',
            copy_imports_from=self.leader,
        )

    def test_same_external_trade_id_on_two_accounts(self) -> None:
        tid = 'dup-001'
        tz = ZoneInfo('Europe/Paris')
        ent = datetime(2025, 8, 10, 18, 23, 28, tzinfo=tz)
        ext = datetime(2025, 8, 10, 18, 31, 3, tzinfo=tz)
        ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.leader,
            external_trade_id=tid,
            contract_name='NQZ5',
            entered_at=ent,
            exited_at=ext,
            entry_price=Decimal('25261.75'),
            exit_price=Decimal('25245.75'),
            fees=Decimal('8.4'),
            size=Decimal('3'),
            trade_type='Long',
            trade_day=ent.date(),
        )
        t2 = ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.follower,
            external_trade_id=tid,
            contract_name='NQZ5',
            entered_at=ent,
            exited_at=ext,
            entry_price=Decimal('25261.75'),
            exit_price=Decimal('25245.75'),
            fees=Decimal('8.4'),
            size=Decimal('3'),
            trade_type='Long',
            trade_day=ent.date(),
        )
        self.assertEqual(ImportedTrade.objects.filter(external_trade_id=tid).count(), 2)
        self.assertEqual(t2.trading_account_id, self.follower.id)

    def test_importer_duplicates_row_to_two_accounts(self) -> None:
        csv_content = MINIMAL_CSV_HEADER + _csv_line('import-dup-1')
        importer = TopStepCSVImporter(
            self.user,
            target_accounts=[self.leader, self.follower],
        )
        result = importer.import_from_string(csv_content, 't.csv', dry_run=False)
        self.assertTrue(result['success'])
        self.assertEqual(ImportedTrade.objects.filter(external_trade_id='import-dup-1').count(), 2)

    def test_importer_duplicate_to_copy_false_single_account(self) -> None:
        csv_content = MINIMAL_CSV_HEADER + _csv_line('import-dup-2')
        importer = TopStepCSVImporter(self.user, target_accounts=[self.leader])
        result = importer.import_from_string(csv_content, 't.csv', dry_run=False)
        self.assertTrue(result['success'])
        self.assertEqual(ImportedTrade.objects.filter(external_trade_id='import-dup-2').count(), 1)


class TradingAccountCopyImportsValidationTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='copy-val@example.com',
            username='copy_val_user',
            password='testpass123',
        )
        self.a = TradingAccount.objects.create(
            user=self.user, name='A', account_type='topstep', currency='USD', status='active'
        )
        self.b = TradingAccount.objects.create(
            user=self.user, name='B', account_type='topstep', currency='USD', status='active'
        )

    def _ctx(self, user):
        class R:
            pass

        r = R()
        r.user = user
        return {'request': r}

    def test_rejects_simple_cycle(self) -> None:
        self.b.copy_imports_from = self.a
        self.b.save(update_fields=['copy_imports_from'])
        ser = TradingAccountSerializer(
            instance=self.a,
            data={'copy_imports_from': self.b.id},
            partial=True,
            context=self._ctx(self.user),
        )
        self.assertFalse(ser.is_valid())
        self.assertIn('copy_imports_from', ser.errors)

    def test_accounts_copying_read_only_field(self) -> None:
        self.b.copy_imports_from = self.a
        self.b.save(update_fields=['copy_imports_from'])
        ser = TradingAccountSerializer(instance=self.a, context=self._ctx(self.user))
        data = ser.data
        self.assertEqual(len(data.get('accounts_copying_this_one', [])), 1)
        self.assertEqual(data['accounts_copying_this_one'][0]['id'], self.b.id)
