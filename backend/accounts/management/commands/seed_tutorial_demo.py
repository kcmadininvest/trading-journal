"""Crée un utilisateur de démo fictif pour captures de tutoriels (Playwright).

Données inventées — aucun lien avec un compte réel / clone_user_dataset.

Usage :
    python manage.py seed_tutorial_demo
    python manage.py seed_tutorial_demo --reset
    TUTORIAL_DEMO_PASSWORD=secret python manage.py seed_tutorial_demo
"""
from __future__ import annotations

import os
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import User, UserPreferences
from daily_journal.models import (
    Questionnaire,
    QuestionnaireQuestion,
    QuestionTemplate,
)
from integrations.credentials_crypto import build_secrets_hint, encrypt_json
from integrations.models import UserApiIntegration
from trades.models import AccountTransaction, ImportedTrade, TradingAccount
from trading_activity.models import (
    TradingActivityCredit,
    TradingActivityExpense,
    TradingActivityExpenseCategory,
)

DEMO_EMAIL = 'tutorial-demo@example.invalid'
DEMO_USERNAME = 'tutorial_demo'
# Clé fictive uniquement pour captures (jamais utilisée contre l’API broker dans Playwright).
DEMO_TOPSTEPX_API_KEY = 'tuto-demo-api-key-xxxx'
DEMO_TOPSTEPX_USERNAME = 'tutorial_demo_topstep'


class Command(BaseCommand):
    help = 'Seed utilisateur fictif pour captures tutoriels (email tutorial-demo@example.invalid).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Supprime et recrée le compte démo.',
        )
        parser.add_argument(
            '--password',
            default='',
            help='Mot de passe (sinon TUTORIAL_DEMO_PASSWORD ou TutorialDemo!234).',
        )

    def handle(self, *args, **options):
        password = (
            options['password']
            or os.environ.get('TUTORIAL_DEMO_PASSWORD')
            or 'TutorialDemo!234'
        )

        if options['reset']:
            User.objects.filter(email=DEMO_EMAIL).delete()
            User.objects.filter(username=DEMO_USERNAME).delete()
            self.stdout.write('Ancien compte démo supprimé.')

        user, created = User.objects.get_or_create(
            email=DEMO_EMAIL,
            defaults={
                'username': DEMO_USERNAME,
                'first_name': 'Tutorial',
                'last_name': 'Demo',
                'is_active': True,
                'is_verified': True,
            },
        )
        if not created and user.username != DEMO_USERNAME:
            user.username = DEMO_USERNAME
        user.set_password(password)
        user.is_active = True
        if hasattr(user, 'is_verified'):
            user.is_verified = True
        user.save()

        prefs, _ = UserPreferences.objects.get_or_create(user=user)
        prefs.language = 'fr'
        prefs.tutorials_progress = {}
        prefs.tutorials_auto_prompt_dismissed = True
        prefs.save(update_fields=[
            'language',
            'tutorials_progress',
            'tutorials_auto_prompt_dismissed',
            'updated_at',
        ])

        account, _ = TradingAccount.objects.get_or_create(
            user=user,
            name='Demo Futures Account',
            defaults={
                'account_type': 'other',
                'currency': 'USD',
                'initial_capital': Decimal('50000.00'),
                'status': 'active',
                'is_default': False,
            },
        )
        if account.is_default:
            account.is_default = False
            account.save(update_fields=['is_default', 'updated_at'])

        topstep_account, _ = TradingAccount.objects.get_or_create(
            user=user,
            name='Demo TopStep Account',
            defaults={
                'account_type': 'topstep',
                'currency': 'USD',
                'initial_capital': Decimal('150000.00'),
                'status': 'active',
                'broker_account_id': '999001',
                'is_default': True,
            },
        )
        changed_fields: list[str] = []
        if topstep_account.account_type != 'topstep':
            topstep_account.account_type = 'topstep'
            changed_fields.append('account_type')
        if topstep_account.status != 'active':
            topstep_account.status = 'active'
            changed_fields.append('status')
        if not topstep_account.broker_account_id:
            topstep_account.broker_account_id = '999001'
            changed_fields.append('broker_account_id')
        if not topstep_account.is_default:
            topstep_account.is_default = True
            changed_fields.append('is_default')
        if changed_fields:
            topstep_account.save(update_fields=[*changed_fields, 'updated_at'])

        secrets = {'api_key': DEMO_TOPSTEPX_API_KEY}
        UserApiIntegration.objects.update_or_create(
            user=user,
            provider='topstepx',
            defaults={
                'external_username': DEMO_TOPSTEPX_USERNAME,
                'secrets_encrypted': encrypt_json(secrets),
                'secrets_hint': build_secrets_hint(secrets),
                'is_connected': True,
                'last_validated_at': timezone.now(),
            },
        )

        # Quelques trades inventés pour dashboard / calendrier non vides
        now = timezone.now()
        samples = [
            ('NQH6', Decimal('21500.25'), Decimal('21540.50'), Decimal('1'), 'Long'),
            ('ESH6', Decimal('5800.00'), Decimal('5788.25'), Decimal('2'), 'Short'),
            ('NQH6', Decimal('21480.00'), Decimal('21495.75'), Decimal('1'), 'Long'),
        ]
        for idx, (contract, entry, exit_p, size, side) in enumerate(samples):
            external_id = f'TUTO-DEMO-{idx + 1}'
            entered = now - timedelta(days=idx + 1, hours=2)
            exited = entered + timedelta(minutes=25)
            # Trades sur le compte TopStep (défaut) pour Sync UI + captures trades/calendrier.
            ImportedTrade.objects.update_or_create(
                user=user,
                trading_account=topstep_account,
                external_trade_id=external_id,
                defaults={
                    'contract_name': contract,
                    'entered_at': entered,
                    'exited_at': exited,
                    'entry_price': entry,
                    'exit_price': exit_p,
                    'size': size,
                    'trade_type': side,
                    'fees': Decimal('4.20'),
                    'commissions': Decimal('1.80'),
                    'point_value': Decimal('20') if contract.startswith('NQ') else Decimal('50'),
                },
            )
            ImportedTrade.objects.filter(
                user=user,
                trading_account=account,
                external_trade_id=external_id,
            ).delete()

        # Questions : modèles → questionnaires jour / positions (enchaînement du tuto Aide)
        day_tpl, _ = QuestionTemplate.objects.update_or_create(
            user=user,
            label='Comment était ton mindset ?',
            defaults={
                'help_text': 'Modèle démo pour le questionnaire du jour.',
                'answer_type': 'text',
                'config': {},
                'is_active': True,
            },
        )
        plan_tpl, _ = QuestionTemplate.objects.update_or_create(
            user=user,
            label='As-tu suivi le plan ?',
            defaults={
                'help_text': 'Modèle démo oui/non.',
                'answer_type': 'boolean',
                'config': {},
                'is_active': True,
            },
        )
        grade_tpl, _ = QuestionTemplate.objects.update_or_create(
            user=user,
            label='Note du trade',
            defaults={
                'help_text': 'Modèle démo pour le questionnaire positions.',
                'answer_type': 'scale',
                'config': {'min': 1, 'max': 5, 'step': 1},
                'is_active': True,
            },
        )

        day_q = Questionnaire.get_or_create_for_scope(user, 'day')
        pos_q = Questionnaire.get_or_create_for_scope(user, 'position')

        def ensure_instance(questionnaire, template, order: int) -> None:
            QuestionnaireQuestion.objects.update_or_create(
                questionnaire=questionnaire,
                source_template=template,
                defaults={
                    'label': template.label,
                    'help_text': template.help_text,
                    'answer_type': template.answer_type,
                    'config': template.config or {},
                    'required': False,
                    'order': order,
                    'is_active': True,
                    'show_if': None,
                },
            )

        ensure_instance(day_q, day_tpl, 0)
        ensure_instance(day_q, plan_tpl, 1)
        ensure_instance(pos_q, grade_tpl, 0)
        ensure_instance(pos_q, plan_tpl, 1)

        # Transactions + rentabilité activité (tuto Aide)
        AccountTransaction.objects.filter(
            user=user,
            description__startswith='TUTO-DEMO',
        ).delete()
        TradingActivityExpense.objects.filter(user=user, label__startswith='TUTO-DEMO').delete()
        TradingActivityCredit.objects.filter(user=user, notes__startswith='TUTO-DEMO').delete()

        deposit_tx = AccountTransaction.objects.create(
            user=user,
            trading_account=topstep_account,
            transaction_type='deposit',
            amount=Decimal('10000.00'),
            transaction_date=now - timedelta(days=5),
            description='TUTO-DEMO dépôt initial',
        )
        withdrawal_tx = AccountTransaction.objects.create(
            user=user,
            trading_account=topstep_account,
            transaction_type='withdrawal',
            amount=Decimal('1500.00'),
            transaction_date=now - timedelta(days=2),
            description='TUTO-DEMO retrait vers banque',
        )
        _ = deposit_tx  # utilisé pour l’historique Transactions

        category, _ = TradingActivityExpenseCategory.objects.get_or_create(
            user=user,
            name='Data / plateforme',
        )
        TradingActivityExpense.objects.create(
            user=user,
            date=(now - timedelta(days=3)).date(),
            primary_currency='USD',
            subtotal=Decimal('80.00'),
            vat_amount=Decimal('0.00'),
            total=Decimal('80.00'),
            category=category,
            label='TUTO-DEMO abonnement data',
            notes='Dépense démo tutoriel',
        )
        credit = TradingActivityCredit.objects.create(
            user=user,
            date=(now - timedelta(days=2)).date(),
            primary_currency='USD',
            amount=Decimal('1500.00'),
            notes='TUTO-DEMO crédit lié au retrait',
        )
        credit.linked_account_transactions.set([withdrawal_tx])

        action = 'créé' if created else 'mis à jour'
        self.stdout.write(self.style.SUCCESS(
            f'Utilisateur démo {DEMO_EMAIL} {action} '
            f'(id={user.pk}, account={account.pk}, topstep={topstep_account.pk}).'
        ))
        self.stdout.write(
            'Mot de passe : valeur fournie / TUTORIAL_DEMO_PASSWORD / TutorialDemo!234'
        )
