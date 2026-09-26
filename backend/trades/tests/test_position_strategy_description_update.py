"""Tests de persistance de la description lors de la mise à jour d'une PositionStrategy."""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from billing.models import CustomerSubscription
from trades.models import PositionStrategy

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

        # Vérifier que l'ancienne version est archivée
        self.strategy.refresh_from_db()
        self.assertFalse(self.strategy.is_current)
        self.assertEqual(self.strategy.status, 'archived')
