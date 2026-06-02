"""Tests API paiements fiscaux et sociaux (trading activity)."""
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from billing.models import CustomerSubscription
from trading_activity.models import (
    TradingActivityCredit,
    TradingActivityExpense,
    TradingActivityTaxPayment,
    TradingActivityTaxPaymentType,
)


class TradingActivityTaxPaymentsApiTests(TestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='tax-payments@example.com',
            username='tax_payments_user',
            password='testpass123',
        )
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_tax_test',
            stripe_subscription_id='sub_tax_test',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            current_period_end=timezone.now(),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_create_list_delete_tax_payment(self) -> None:
        create_url = reverse('trading_activity:trading-activity-tax-payment-list')
        payload = {
            'date': '2026-01-15',
            'amount': '250.00',
            'currency': 'EUR',
            'payment_type': 'social_contributions',
            'label': 'Monthly contribution',
            'reference': 'REF-001',
            'notes': '',
        }
        res = self.client.post(create_url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        pk = res.data['id']

        list_res = self.client.get(create_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data['count'], 1)
        self.assertEqual(list_res.data['results'][0]['payment_type'], 'social_contributions')

        detail_url = reverse('trading_activity:trading-activity-tax-payment-detail', kwargs={'pk': pk})
        patch_res = self.client.patch(
            detail_url,
            {'amount': '300.00', 'payment_type': 'income_tax'},
            format='json',
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data['payment_type'], 'income_tax')

        del_res = self.client.delete(detail_url)
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(TradingActivityTaxPayment.objects.filter(user=self.user).count(), 0)

    def test_summary_includes_tax_payments_and_balance_after(self) -> None:
        TradingActivityExpense.objects.create(
            user=self.user,
            date='2026-01-01',
            primary_currency='EUR',
            subtotal=Decimal('100.00'),
            vat_amount=Decimal('0.00'),
            total=Decimal('100.00'),
        )
        TradingActivityCredit.objects.create(
            user=self.user,
            date='2026-01-02',
            primary_currency='EUR',
            amount=Decimal('500.00'),
        )
        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date='2026-01-10',
            amount=Decimal('50.00'),
            currency='EUR',
            payment_type='income_tax',
        )

        res = self.client.get(reverse('trading_activity:trading-activity-summary'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        block = res.data['primary_by_currency']['EUR']
        self.assertEqual(block['credits'], '500.00')
        self.assertEqual(block['expenses'], '100.00')
        self.assertEqual(block['balance'], '400.00')
        self.assertEqual(block['tax_payments'], '50.00')
        self.assertEqual(block['balance_after_tax_payments'], '350.00')

    def test_summary_matches_manual_aggregation_per_currency(self) -> None:
        """Vérifie crédits − dépenses et solde net pour chaque devise principale."""
        TradingActivityExpense.objects.create(
            user=self.user,
            date='2026-02-01',
            primary_currency='USD',
            subtotal=Decimal('100.00'),
            vat_amount=Decimal('0'),
            total=Decimal('100.00'),
            secondary_amount=Decimal('50.00'),
            secondary_currency='EUR',
        )
        TradingActivityCredit.objects.create(
            user=self.user,
            date='2026-02-02',
            primary_currency='USD',
            amount=Decimal('300.00'),
            secondary_amount=Decimal('80.00'),
            secondary_currency='EUR',
        )
        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date='2026-02-03',
            amount=Decimal('25.00'),
            currency='USD',
            payment_type='income_tax',
        )

        res = self.client.get(reverse('trading_activity:trading-activity-summary'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        usd = res.data['primary_by_currency']['USD']
        self.assertEqual(usd['credits'], '300.00')
        self.assertEqual(usd['expenses'], '100.00')
        self.assertEqual(usd['balance'], '200.00')
        self.assertEqual(usd['tax_payments'], '25.00')
        self.assertEqual(usd['balance_after_tax_payments'], '175.00')

        eur_sec = res.data['secondary_by_currency']['EUR']
        self.assertEqual(eur_sec['credits'], '80.00')
        self.assertEqual(eur_sec['expenses'], '50.00')
        self.assertEqual(eur_sec['balance'], '30.00')

    def test_tax_deducted_on_secondary_when_same_currency_activity(self) -> None:
        """EUR en devise secondaire + paiement fiscal EUR : déduction sur le bloc secondaire."""
        TradingActivityCredit.objects.create(
            user=self.user,
            date='2026-03-01',
            primary_currency='USD',
            amount=Decimal('1000.00'),
            secondary_amount=Decimal('893.06'),
            secondary_currency='EUR',
        )
        TradingActivityExpense.objects.create(
            user=self.user,
            date='2026-03-02',
            primary_currency='USD',
            subtotal=Decimal('404.06'),
            vat_amount=Decimal('0'),
            total=Decimal('404.06'),
            secondary_amount=Decimal('404.06'),
            secondary_currency='EUR',
        )
        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date='2026-03-10',
            amount=Decimal('200.00'),
            currency='EUR',
            payment_type='income_tax',
        )

        res = self.client.get(reverse('trading_activity:trading-activity-summary'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertNotIn('EUR', res.data['primary_by_currency'])
        eur_sec = res.data['secondary_by_currency']['EUR']
        self.assertEqual(eur_sec['balance'], '489.00')
        self.assertEqual(eur_sec['tax_payments'], '200.00')
        self.assertEqual(eur_sec['balance_after_tax_payments'], '289.00')

    def test_filter_by_payment_type(self) -> None:
        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date='2026-01-01',
            amount=Decimal('10.00'),
            currency='EUR',
            payment_type='income_tax',
        )
        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date='2026-01-02',
            amount=Decimal('20.00'),
            currency='EUR',
            payment_type='local_tax',
        )
        url = reverse('trading_activity:trading-activity-tax-payment-list')
        res = self.client.get(url, {'payment_type': 'local_tax'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['count'], 1)
        self.assertEqual(res.data['results'][0]['payment_type'], 'local_tax')

    def test_rename_custom_payment_type(self) -> None:
        custom = TradingActivityTaxPaymentType.objects.create(user=self.user, name='URSSAF')
        detail_url = reverse(
            'trading_activity:trading-activity-tax-payment-type-detail',
            kwargs={'pk': custom.pk},
        )
        res = self.client.patch(detail_url, {'name': 'URSSAF trimestrielle'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['name'], 'URSSAF trimestrielle')
        self.assertEqual(res.data['code'], f'custom_{custom.pk}')

        list_res = self.client.get(reverse('trading_activity:trading-activity-tax-payment-type-list'))
        self.assertEqual(list_res.data[0]['name'], 'URSSAF trimestrielle')

    def test_create_custom_payment_type_and_use_on_payment(self) -> None:
        types_url = reverse('trading_activity:trading-activity-tax-payment-type-list')
        type_res = self.client.post(types_url, {'name': 'URSSAF trimestre'}, format='json')
        self.assertEqual(type_res.status_code, status.HTTP_201_CREATED)
        custom_code = type_res.data['code']
        self.assertTrue(custom_code.startswith('custom_'))

        pay_url = reverse('trading_activity:trading-activity-tax-payment-list')
        pay_res = self.client.post(
            pay_url,
            {
                'date': '2026-04-01',
                'amount': '150.00',
                'currency': 'EUR',
                'payment_type': custom_code,
                'label': '',
                'reference': '',
                'notes': '',
            },
            format='json',
        )
        self.assertEqual(pay_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(pay_res.data['payment_type'], custom_code)

        filter_res = self.client.get(pay_url, {'payment_type': custom_code})
        self.assertEqual(filter_res.status_code, status.HTTP_200_OK)
        self.assertEqual(filter_res.data['count'], 1)

    def test_reject_unknown_custom_payment_type(self) -> None:
        pay_url = reverse('trading_activity:trading-activity-tax-payment-list')
        res = self.client.post(
            pay_url,
            {
                'date': '2026-04-01',
                'amount': '10.00',
                'currency': 'EUR',
                'payment_type': 'custom_99999',
                'label': '',
                'reference': '',
                'notes': '',
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_delete_custom_type_in_use(self) -> None:
        custom = TradingActivityTaxPaymentType.objects.create(user=self.user, name='CFE')
        code = f'custom_{custom.pk}'
        TradingActivityTaxPayment.objects.create(
            user=self.user,
            date='2026-01-01',
            amount=Decimal('50.00'),
            currency='EUR',
            payment_type=code,
        )
        detail_url = reverse(
            'trading_activity:trading-activity-tax-payment-type-detail',
            kwargs={'pk': custom.pk},
        )
        res = self.client.delete(detail_url)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(TradingActivityTaxPaymentType.objects.filter(pk=custom.pk).exists())

    def test_upsert_builtin_payment_type_label(self) -> None:
        detail_url = reverse(
            'trading_activity:trading-activity-tax-payment-builtin-label-detail',
            kwargs={'code': 'income_tax'},
        )
        res = self.client.put(detail_url, {'label': 'Impôts sur le revenu (perso)'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['code'], 'income_tax')
        self.assertEqual(res.data['label'], 'Impôts sur le revenu (perso)')

        list_url = reverse('trading_activity:trading-activity-tax-payment-builtin-label-list')
        list_res = self.client.get(list_url)
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        self.assertEqual(list_res.data['income_tax'], 'Impôts sur le revenu (perso)')

        pay_url = reverse('trading_activity:trading-activity-tax-payment-list')
        pay_res = self.client.post(
            pay_url,
            {
                'date': '2026-05-01',
                'amount': '100.00',
                'currency': 'EUR',
                'payment_type': 'income_tax',
                'label': '',
                'reference': '',
                'notes': '',
            },
            format='json',
        )
        self.assertEqual(pay_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(pay_res.data['payment_type'], 'income_tax')

    def test_reject_builtin_label_for_custom_code(self) -> None:
        custom = TradingActivityTaxPaymentType.objects.create(user=self.user, name='Test')
        detail_url = reverse(
            'trading_activity:trading-activity-tax-payment-builtin-label-detail',
            kwargs={'code': f'custom_{custom.pk}'},
        )
        res = self.client.put(detail_url, {'label': 'Invalid'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
