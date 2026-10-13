from django.contrib.auth import get_user_model
from django.core.management.base import CommandError
from django.test import TestCase

from accounts.clone_dataset import (
    TARGET_USERNAME,
    assert_models_classified,
    clone_user_dataset,
)
from accounts.e2e_guard import evaluate_clone_guard
from accounts.models import LoginHistory, UserPreferences
from trades.models import TradingAccount

User = get_user_model()


class CloneGuardTests(TestCase):
    def test_models_are_classified(self):
        assert_models_classified()

    def test_refuses_when_debug_is_off(self):
        with self.assertRaises(CommandError):
            evaluate_clone_guard(
                debug=False,
                stripe_key='',
                db_name='portfolio',
                schema_options='-c search_path=trading_journal',
                expected_name='portfolio',
                expected_schema='trading_journal',
            )

    def test_refuses_live_stripe_key(self):
        with self.assertRaises(CommandError):
            evaluate_clone_guard(
                debug=True,
                stripe_key='sk_live_test',
                db_name='portfolio',
                schema_options='-c search_path=trading_journal',
                expected_name=None,
                expected_schema=None,
            )

    def test_refuses_production_database_name(self):
        with self.assertRaises(CommandError):
            evaluate_clone_guard(
                debug=True,
                stripe_key='',
                db_name='trading_journal_prod',
                schema_options='-c search_path=trading_journal',
                expected_name=None,
                expected_schema=None,
            )


class CloneDatasetTests(TestCase):
    def setUp(self):
        self.source = User.objects.create_user(
            username='source-clone',
            email='source-clone@example.com',
            password='source-pass-123',
        )
        self.source.is_active = True
        self.source.is_verified = True
        self.source.save(update_fields=['is_active', 'is_verified'])
        UserPreferences.objects.create(user=self.source, language='fr', number_format='comma')
        TradingAccount.objects.create(
            user=self.source,
            name='Compte source',
            account_type='other',
        )
        LoginHistory.objects.create(user=self.source, success=True)

    def test_copies_business_rows_and_skips_login_history(self):
        target = clone_user_dataset(
            source_username='source-clone',
            password='e2e-qualif-pass',
            reset=True,
        )
        self.assertEqual(target.username, TARGET_USERNAME)
        self.assertEqual(target.role, 'user')
        self.assertTrue(target.check_password('e2e-qualif-pass'))
        self.assertEqual(target.trading_accounts.count(), 1)
        self.assertEqual(target.trading_accounts.get().name, 'Compte source')
        self.assertEqual(target.preferences.language, 'fr')
        self.assertEqual(target.login_history.count(), 0)
        self.assertEqual(self.source.trading_accounts.count(), 1)
        self.assertEqual(self.source.login_history.count(), 1)

        again = clone_user_dataset(source_username='source-clone', reset=False)
        self.assertEqual(again.pk, target.pk)
        self.assertEqual(again.trading_accounts.count(), 1)
