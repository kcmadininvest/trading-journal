"""Tests de persistance de la description et du titre de famille d'une PositionStrategy."""
from datetime import date, timedelta
from decimal import Decimal
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from billing.models import CustomerSubscription
from trades.models import ImportedTrade, PositionStrategy, TradingAccount
from trades.strategy_family_title import (
    align_family_titles,
    canonical_family_title,
    propagate_current_title,
)

User = get_user_model()


class PositionStrategyDescriptionUpdateTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='description_update_user',
            email='description_update@example.com',
            password='testpass123',
        )
        self.strategy = PositionStrategy.objects.create(
            user=self.user,
            title='Stratégie initiale',
            description='Description initiale',
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'S1', 'rules': ['r1']}]},
        )
        CustomerSubscription.objects.create(
            user=self.user,
            stripe_customer_id='cus_ps_desc_test',
            stripe_subscription_id='sub_ps_desc_test',
            stripe_price_id='price_test',
            status=CustomerSubscription.STATUS_ACTIVE,
            is_current=True,
            current_period_end=timezone.now() + timedelta(days=30),
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_update_description_creates_new_version_with_updated_description(self):
        """
        Modifier la description d'une stratégie active doit créer une nouvelle version
        qui porte la nouvelle description.
        """
        new_description = 'Nouvelle description saisie par le trader'
        new_title = 'Nouveau titre de stratégie'
        url = reverse('trades:position-strategy-detail', kwargs={'pk': self.strategy.pk})

        response = self.client.patch(
            url,
            {
                'title': new_title,
                'description': new_description,
                'strategy_content': {
                    'sections': [{'title': 'S1 modifiée', 'rules': ['r1 modifié']}]
                },
                'version_notes': 'Mise à jour description et titre',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['description'], new_description)
        self.assertEqual(response.data['title'], new_title)

        # Vérifier que la nouvelle version en base a bien la nouvelle description
        new_version_id = response.data['id']
        new_version = PositionStrategy.objects.get(pk=new_version_id)
        self.assertEqual(new_version.description, new_description)
        self.assertEqual(new_version.title, new_title)
        self.assertTrue(new_version.is_current)

        # Vérifier que l'ancienne version est archivée et porte le même titre
        self.strategy.refresh_from_db()
        self.assertFalse(self.strategy.is_current)
        self.assertEqual(self.strategy.status, 'archived')
        self.assertEqual(self.strategy.title, new_title)
        self.assertEqual(self.strategy.description, 'Description initiale')

    def _create_family(self, old_title='Ancien titre', current_title='Titre courant'):
        parent = PositionStrategy.objects.create(
            user=self.user,
            title=old_title,
            description='Description ancienne',
            status='archived',
            is_current=False,
            strategy_content={'sections': [{'title': 'S1', 'rules': ['r1']}]},
        )
        current = PositionStrategy.objects.create(
            user=self.user,
            parent_strategy=parent,
            title=current_title,
            description='Description courante',
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'S2', 'rules': ['r2']}]},
        )
        frozen = timezone.now() - timedelta(days=30)
        PositionStrategy.objects.filter(pk=parent.pk).update(updated_at=frozen)
        parent.refresh_from_db()
        return parent, current

    def _create_trade(self, strategy):
        account = TradingAccount.objects.create(
            user=self.user,
            name='Compte titre',
            account_type='other',
        )
        return ImportedTrade.objects.create(
            user=self.user,
            trading_account=account,
            external_trade_id='trade-titre-famille',
            contract_name='NQ',
            trade_type='Long',
            entered_at=timezone.now(),
            trade_day=date(2026, 1, 10),
            size=Decimal('1'),
            entry_price=Decimal('15000'),
            exit_price=Decimal('15010'),
            position_strategy=strategy,
        )

    def test_rename_updates_family_title_without_moving_trade(self):
        parent, current = self._create_family()
        trade = self._create_trade(parent)
        previous_updated_at = parent.updated_at
        other = PositionStrategy.objects.create(
            user=self.user,
            title='Autre stratégie',
            description='Inchangée',
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'S', 'rules': ['r']}]},
        )
        new_title = 'Titre renommé'
        url = reverse('trades:position-strategy-detail', kwargs={'pk': current.pk})

        response = self.client.patch(
            url,
            {
                'title': new_title,
                'description': 'Description renommée',
                'strategy_content': {
                    'sections': [{'title': 'S2', 'rules': ['r2 modifié']}]
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotEqual(response.data['id'], current.pk)
        parent.refresh_from_db()
        trade.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(parent.title, new_title)
        self.assertEqual(parent.description, 'Description ancienne')
        self.assertEqual(parent.updated_at, previous_updated_at)
        self.assertEqual(trade.position_strategy_id, parent.pk)
        self.assertEqual(trade.position_strategy.title, new_title)
        self.assertEqual(other.title, 'Autre stratégie')

    def test_direct_update_propagates_title_to_siblings(self):
        parent, current = self._create_family()
        url = reverse('trades:position-strategy-detail', kwargs={'pk': current.pk})

        response = self.client.patch(
            url,
            {'title': 'Titre direct', 'create_new_version': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], current.pk)
        parent.refresh_from_db()
        current.refresh_from_db()
        self.assertEqual(current.title, 'Titre direct')
        self.assertEqual(parent.title, 'Titre direct')
        self.assertEqual(parent.versions.count(), 1)

    def test_patch_on_non_current_does_not_rename_current_version(self):
        parent, current = self._create_family()
        url = reverse('trades:position-strategy-detail', kwargs={'pk': parent.pk})

        response = self.client.patch(
            url,
            {'title': 'Titre piraté', 'create_new_version': False},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        parent.refresh_from_db()
        current.refresh_from_db()
        self.assertEqual(parent.title, 'Titre piraté')
        self.assertEqual(current.title, 'Titre courant')

    def test_blank_or_whitespace_title_is_not_propagated(self):
        parent, current = self._create_family()
        url = reverse('trades:position-strategy-detail', kwargs={'pk': current.pk})

        blank = self.client.patch(
            url,
            {'title': '', 'create_new_version': False},
            format='json',
        )
        self.assertEqual(blank.status_code, status.HTTP_400_BAD_REQUEST)
        parent.refresh_from_db()
        self.assertEqual(parent.title, 'Ancien titre')

        current.title = '   '
        current.save(update_fields=['title'])
        self.assertEqual(propagate_current_title(current), 0)
        parent.refresh_from_db()
        self.assertEqual(parent.title, 'Ancien titre')

    def test_align_family_titles_uses_single_current_title(self):
        parent, current = self._create_family(old_title='Ancien', current_title='Actuel')
        other = PositionStrategy.objects.create(
            user=self.user,
            title='Indépendante',
            status='active',
            is_current=True,
            strategy_content={'sections': [{'title': 'S', 'rules': ['r']}]},
        )
        frozen = parent.updated_at

        updated = align_family_titles(PositionStrategy)

        parent.refresh_from_db()
        other.refresh_from_db()
        self.assertEqual(updated, 1)
        self.assertEqual(parent.title, 'Actuel')
        self.assertEqual(current.title, 'Actuel')
        self.assertEqual(parent.updated_at, frozen)
        self.assertEqual(other.title, 'Indépendante')

    def test_align_family_titles_skips_ambiguous_or_missing_current(self):
        parent, current = self._create_family(old_title='Ancien', current_title='Actuel')
        PositionStrategy.objects.filter(pk__in=[parent.pk, current.pk]).update(is_current=True)
        current.title = 'Autre courant'
        current.save(update_fields=['title'])

        self.assertEqual(align_family_titles(PositionStrategy), 0)
        parent.refresh_from_db()
        current.refresh_from_db()
        self.assertEqual(parent.title, 'Ancien')
        self.assertEqual(current.title, 'Autre courant')

        PositionStrategy.objects.filter(pk__in=[parent.pk, current.pk]).update(is_current=False)
        self.assertEqual(align_family_titles(PositionStrategy), 0)
        parent.refresh_from_db()
        current.refresh_from_db()
        self.assertEqual(parent.title, 'Ancien')
        self.assertEqual(current.title, 'Autre courant')

    def test_canonical_family_title_rules(self):
        def version(title, is_current):
            return SimpleNamespace(title=title, is_current=is_current)

        self.assertEqual(
            canonical_family_title([
                version('Ancien', False),
                version('Actuel', True),
            ]),
            'Actuel',
        )
        self.assertIsNone(canonical_family_title([
            version('Ancien', False),
            version('Récent', False),
        ]))
        self.assertIsNone(canonical_family_title([
            version('Un', True),
            version('Deux', True),
        ]))
        self.assertEqual(
            canonical_family_title([
                version('Identique', True),
                version('Identique', True),
                version('Ancien', False),
            ]),
            'Identique',
        )
        self.assertIsNone(canonical_family_title([
            version('', True),
            version('Ancien', False),
        ]))
        self.assertIsNone(canonical_family_title([
            version('   ', True),
        ]))
