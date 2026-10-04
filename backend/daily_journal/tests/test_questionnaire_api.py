"""Tests API questionnaires (templates, clone, answers day/position)."""
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import User
from daily_journal.models import (
    QuestionTemplate,
    Questionnaire,
    QuestionnaireAnswer,
    QuestionnaireQuestion,
)
from trades.models import ImportedTrade, TradingAccount


class QuestionnaireApiTests(APITestCase):
    def setUp(self) -> None:
        self.user = User.objects.create_user(
            email='qnaire@example.com',
            username='qnaire_user',
            password='testpass123',
        )
        self.other = User.objects.create_user(
            email='other-q@example.com',
            username='other_q',
            password='testpass123',
        )
        self.account = TradingAccount.objects.create(
            user=self.user,
            name='Q Account',
            initial_capital=Decimal('10000'),
            account_type='other',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def _create_trade(self, external_trade_id: str = 'Q-T1') -> ImportedTrade:
        entered = timezone.make_aware(datetime(2026, 7, 10, 10, 0, 0))
        return ImportedTrade.objects.create(
            user=self.user,
            trading_account=self.account,
            external_trade_id=external_trade_id,
            contract_name='ES',
            trade_type='Long',
            entered_at=entered,
            exited_at=entered + timedelta(hours=1),
            entry_price=Decimal('100.000000000'),
            exit_price=Decimal('101.000000000'),
            size=Decimal('1.0000'),
            trade_day=date(2026, 7, 10),
            net_pnl=Decimal('50'),
        )

    def test_create_template_and_clone_to_day_questionnaire(self):
        tpl_url = reverse('daily_journal:question-template-list')
        res = self.client.post(
            tpl_url,
            {
                'label': 'Plan respecté ?',
                'help_text': 'Oui/Non',
                'answer_type': 'boolean',
                'config': {},
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        template_id = res.data['id']

        q_url = reverse('daily_journal:questionnaire-list')
        q_res = self.client.post(q_url, {'scope': 'day'}, format='json')
        self.assertEqual(q_res.status_code, status.HTTP_200_OK)
        questionnaire_id = q_res.data['id']

        clone_url = reverse(
            'daily_journal:questionnaire-from-template',
            kwargs={'pk': questionnaire_id},
        )
        # Custom action url_path questions/from-template
        clone_url = f'/api/daily-journal/questionnaires/{questionnaire_id}/questions/from-template/'
        clone_res = self.client.post(
            clone_url,
            {'template_id': template_id},
            format='json',
        )
        self.assertEqual(clone_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(clone_res.data['label'], 'Plan respecté ?')
        self.assertEqual(clone_res.data['source_template'], template_id)
        instance_id = clone_res.data['id']

        # Éditer le modèle ne change pas l'instance
        self.client.patch(
            reverse('daily_journal:question-template-detail', kwargs={'pk': template_id}),
            {'label': 'Modèle renommé'},
            format='json',
        )
        detail = self.client.get(
            reverse('daily_journal:questionnaire-question-detail', kwargs={'pk': instance_id})
        )
        self.assertEqual(detail.data['label'], 'Plan respecté ?')

    def test_bulk_day_answers_with_snapshot(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        question = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Mood',
            answer_type='scale',
            config={'min': 1, 'max': 5},
            order=0,
        )
        bulk_url = '/api/daily-journal/answers/bulk/'
        res = self.client.put(
            bulk_url,
            {
                'scope': 'day',
                'date': '2026-07-10',
                'trading_account': self.account.id,
                'answers': [{'question_id': question.id, 'value': 4}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data['answers']), 1)
        self.assertEqual(res.data['answers'][0]['question_label_snapshot'], 'Mood')
        self.assertEqual(res.data['answers'][0]['value'], 4)

        question.label = 'Humeur'
        question.save(update_fields=['label', 'updated_at'])

        get_res = self.client.get(
            '/api/daily-journal/answers/',
            {
                'scope': 'day',
                'date': '2026-07-10',
                'trading_account': self.account.id,
            },
        )
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)
        self.assertEqual(get_res.data['answers'][0]['question_label_snapshot'], 'Mood')
        self.assertEqual(get_res.data['questions'][0]['label'], 'Humeur')

    def test_bulk_position_answers(self):
        trade = self._create_trade()
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'position')
        question = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Setup clair ?',
            answer_type='boolean',
            order=0,
        )
        res = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'position',
                'trade': trade.id,
                'answers': [{'question_id': question.id, 'value': True}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        answer = QuestionnaireAnswer.objects.get(question=question, trade=trade)
        self.assertEqual(answer.value, True)
        self.assertIsNone(answer.date)

    def test_delete_question_with_answers_deactivates(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        question = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Note',
            answer_type='text',
            order=0,
        )
        QuestionnaireAnswer.objects.create(
            user=self.user,
            question=question,
            trading_account=self.account,
            date=date(2026, 7, 10),
            value='ok',
            question_label_snapshot='Note',
            answer_type_snapshot='text',
        )
        res = self.client.delete(
            reverse('daily_journal:questionnaire-question-detail', kwargs={'pk': question.id})
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        question.refresh_from_db()
        self.assertFalse(question.is_active)

    def test_choice_validation(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        create_url = f'/api/daily-journal/questionnaires/{questionnaire.id}/questions/'
        res = self.client.post(
            create_url,
            {
                'label': 'Émotion',
                'answer_type': 'single_choice',
                'choices': [
                    {'label': 'Calme', 'order': 0},
                    {'label': 'Stress', 'order': 1},
                ],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        qid = res.data['id']
        choice_id = res.data['choices'][0]['id']

        bad = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-11',
                'trading_account': self.account.id,
                'answers': [{'question_id': qid, 'value': 99999}],
            },
            format='json',
        )
        self.assertEqual(bad.status_code, status.HTTP_400_BAD_REQUEST)

        good = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-11',
                'trading_account': self.account.id,
                'answers': [{'question_id': qid, 'value': choice_id}],
            },
            format='json',
        )
        self.assertEqual(good.status_code, status.HTTP_200_OK)

    def test_bulk_null_clears_existing_optional_answer(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        choice_q = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Session?',
            answer_type='single_choice',
            required=False,
            order=0,
        )
        from daily_journal.models import QuestionnaireQuestionChoice

        choice = QuestionnaireQuestionChoice.objects.create(
            question=choice_q, label='Bien', order=0
        )
        date_q = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Date note',
            answer_type='date',
            required=False,
            order=1,
        )
        QuestionnaireAnswer.objects.create(
            user=self.user,
            question=choice_q,
            trading_account=self.account,
            date=date(2026, 7, 18),
            value=choice.id,
            question_label_snapshot=choice_q.label,
            answer_type_snapshot=choice_q.answer_type,
        )

        res = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-18',
                'trading_account': self.account.id,
                'answers': [
                    {'question_id': choice_q.id, 'value': None},
                    {'question_id': date_q.id, 'value': '2026-07-02'},
                ],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(len(res.data['answers']), 1)
        self.assertEqual(res.data['answers'][0]['value'], '2026-07-02')
        self.assertFalse(
            QuestionnaireAnswer.objects.filter(
                question=choice_q, date=date(2026, 7, 18), trading_account=self.account
            ).exists()
        )

    def test_bulk_omitted_question_preserves_answer(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        kept = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Gardée',
            answer_type='text',
            required=False,
            order=0,
        )
        updated = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Mise à jour',
            answer_type='text',
            required=False,
            order=1,
        )
        QuestionnaireAnswer.objects.create(
            user=self.user,
            question=kept,
            trading_account=self.account,
            date=date(2026, 7, 19),
            value='intact',
            question_label_snapshot=kept.label,
            answer_type_snapshot=kept.answer_type,
        )
        res = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-19',
                'trading_account': self.account.id,
                'answers': [{'question_id': updated.id, 'value': 'nouveau'}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertEqual(
            QuestionnaireAnswer.objects.get(question=kept, date=date(2026, 7, 19)).value,
            'intact',
        )

    def test_bulk_null_on_required_question_is_rejected(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        question = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Obligatoire',
            answer_type='text',
            required=True,
            order=0,
        )
        QuestionnaireAnswer.objects.create(
            user=self.user,
            question=question,
            trading_account=self.account,
            date=date(2026, 7, 21),
            value='déjà là',
            question_label_snapshot=question.label,
            answer_type_snapshot=question.answer_type,
        )
        res = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-21',
                'trading_account': self.account.id,
                'answers': [{'question_id': question.id, 'value': None}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            QuestionnaireAnswer.objects.get(question=question, date=date(2026, 7, 21)).value,
            'déjà là',
        )

    def test_bulk_clear_parent_deletes_conditional_child(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        parent = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Plan suivi ?',
            answer_type='boolean',
            required=False,
            order=0,
        )
        child = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Détail',
            answer_type='text',
            required=False,
            order=1,
            show_if={
                'logic': 'and',
                'conditions': [
                    {'question_id': parent.id, 'operator': 'eq', 'value': True},
                ],
            },
        )
        QuestionnaireAnswer.objects.create(
            user=self.user,
            question=parent,
            trading_account=self.account,
            date=date(2026, 7, 22),
            value=True,
            question_label_snapshot=parent.label,
            answer_type_snapshot=parent.answer_type,
        )
        QuestionnaireAnswer.objects.create(
            user=self.user,
            question=child,
            trading_account=self.account,
            date=date(2026, 7, 22),
            value='parce que',
            question_label_snapshot=child.label,
            answer_type_snapshot=child.answer_type,
        )
        res = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-22',
                'trading_account': self.account.id,
                'answers': [{'question_id': parent.id, 'value': None}],
            },
            format='json',
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.assertFalse(
            QuestionnaireAnswer.objects.filter(
                question__in=[parent, child], date=date(2026, 7, 22)
            ).exists()
        )

    def test_show_if_create_and_visibility_bulk(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        parent = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Plan OK?',
            answer_type='boolean',
            order=0,
        )
        create_url = f'/api/daily-journal/questionnaires/{questionnaire.id}/questions/'
        child_res = self.client.post(
            create_url,
            {
                'label': 'Pourquoi?',
                'answer_type': 'text',
                'required': True,
                'show_if': {
                    'logic': 'and',
                    'conditions': [
                        {'question_id': parent.id, 'operator': 'eq', 'value': True},
                    ],
                },
            },
            format='json',
        )
        self.assertEqual(child_res.status_code, status.HTTP_201_CREATED, child_res.data)
        child_id = child_res.data['id']
        self.assertEqual(child_res.data['show_if']['conditions'][0]['value'], True)

        # Parent = Non → enfant masqué : required ignoré, pas de réponse enfant
        bulk = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-20',
                'trading_account': self.account.id,
                'answers': [
                    {'question_id': parent.id, 'value': False},
                    {'question_id': child_id, 'value': None},
                ],
            },
            format='json',
        )
        self.assertEqual(bulk.status_code, status.HTTP_200_OK, bulk.data)
        self.assertFalse(
            QuestionnaireAnswer.objects.filter(question_id=child_id, date=date(2026, 7, 20)).exists()
        )

        # Parent = Oui → enfant requis
        missing = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-20',
                'trading_account': self.account.id,
                'answers': [
                    {'question_id': parent.id, 'value': True},
                    {'question_id': child_id, 'value': None},
                ],
            },
            format='json',
        )
        self.assertEqual(missing.status_code, status.HTTP_400_BAD_REQUEST)

        ok = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-20',
                'trading_account': self.account.id,
                'answers': [
                    {'question_id': parent.id, 'value': True},
                    {'question_id': child_id, 'value': 'Parce que'},
                ],
            },
            format='json',
        )
        self.assertEqual(ok.status_code, status.HTTP_200_OK, ok.data)
        self.assertTrue(
            QuestionnaireAnswer.objects.filter(question_id=child_id, date=date(2026, 7, 20)).exists()
        )

        # Repasser parent à Non efface la réponse enfant
        cleared = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-20',
                'trading_account': self.account.id,
                'answers': [
                    {'question_id': parent.id, 'value': False},
                    {'question_id': child_id, 'value': None},
                ],
            },
            format='json',
        )
        self.assertEqual(cleared.status_code, status.HTTP_200_OK)
        self.assertFalse(
            QuestionnaireAnswer.objects.filter(question_id=child_id, date=date(2026, 7, 20)).exists()
        )

    def test_show_if_neq_and_or_and_cycle(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        from daily_journal.models import QuestionnaireQuestionChoice

        parent = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Émotion',
            answer_type='single_choice',
            order=0,
        )
        calm = QuestionnaireQuestionChoice.objects.create(question=parent, label='Calme', order=0)
        stress = QuestionnaireQuestionChoice.objects.create(question=parent, label='Stress', order=1)

        create_url = f'/api/daily-journal/questionnaires/{questionnaire.id}/questions/'
        child = self.client.post(
            create_url,
            {
                'label': 'Détails stress',
                'answer_type': 'text',
                'show_if': {
                    'logic': 'or',
                    'conditions': [
                        {'question_id': parent.id, 'operator': 'neq', 'value': calm.id},
                    ],
                },
            },
            format='json',
        )
        self.assertEqual(child.status_code, status.HTTP_201_CREATED, child.data)
        child_id = child.data['id']

        # Auto-référence
        bad_self = self.client.patch(
            reverse('daily_journal:questionnaire-question-detail', kwargs={'pk': child_id}),
            {
                'show_if': {
                    'logic': 'and',
                    'conditions': [
                        {'question_id': child_id, 'operator': 'eq', 'value': True},
                    ],
                }
            },
            format='json',
        )
        self.assertEqual(bad_self.status_code, status.HTTP_400_BAD_REQUEST)

        # Cycle A→B→A : B dépend de parent, parent ne peut pas dépendre de B
        b = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='B',
            answer_type='boolean',
            order=10,
            show_if={
                'logic': 'and',
                'conditions': [{'question_id': parent.id, 'operator': 'eq', 'value': True}],
            },
        )
        cycle = self.client.patch(
            reverse('daily_journal:questionnaire-question-detail', kwargs={'pk': parent.id}),
            {
                'show_if': {
                    'logic': 'and',
                    'conditions': [
                        {'question_id': b.id, 'operator': 'eq', 'value': True},
                    ],
                }
            },
            format='json',
        )
        self.assertEqual(cycle.status_code, status.HTTP_400_BAD_REQUEST)

        # neq : Calme → enfant masqué ; Stress → visible
        hide = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-21',
                'trading_account': self.account.id,
                'answers': [
                    {'question_id': parent.id, 'value': calm.id},
                    {'question_id': child_id, 'value': None},
                ],
            },
            format='json',
        )
        self.assertEqual(hide.status_code, status.HTTP_200_OK)
        show = self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': '2026-07-21',
                'trading_account': self.account.id,
                'answers': [
                    {'question_id': parent.id, 'value': stress.id},
                    {'question_id': child_id, 'value': 'détail'},
                ],
            },
            format='json',
        )
        self.assertEqual(show.status_code, status.HTTP_200_OK, show.data)

    def test_soft_delete_deactivates_dependents(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        parent = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Parent',
            answer_type='boolean',
            order=0,
        )
        child = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Child',
            answer_type='text',
            order=1,
            show_if={
                'logic': 'and',
                'conditions': [{'question_id': parent.id, 'operator': 'eq', 'value': True}],
            },
        )
        QuestionnaireAnswer.objects.create(
            user=self.user,
            question=parent,
            trading_account=self.account,
            date=date(2026, 7, 22),
            value=True,
            question_label_snapshot='Parent',
            answer_type_snapshot='boolean',
        )
        res = self.client.delete(
            reverse('daily_journal:questionnaire-question-detail', kwargs={'pk': parent.id})
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        parent.refresh_from_db()
        child.refresh_from_db()
        self.assertFalse(parent.is_active)
        self.assertFalse(child.is_active)

    def test_cannot_access_other_user_template(self):
        tpl = QuestionTemplate.objects.create(
            user=self.other,
            label='Secret',
            answer_type='text',
        )
        res = self.client.get(
            reverse('daily_journal:question-template-detail', kwargs={'pk': tpl.id})
        )
        self.assertEqual(res.status_code, status.HTTP_404_NOT_FOUND)

    def test_template_list_is_not_paginated(self):
        for index in range(11):
            QuestionTemplate.objects.create(
                user=self.user,
                label=f'Question {index:02d}',
                answer_type='text',
            )
        res = self.client.get(reverse('daily_journal:question-template-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIsInstance(res.data, list)
        self.assertEqual(len(res.data), 11)

    def test_reject_duplicate_template_label(self):
        payload = {
            'label': 'Sens du trade ?',
            'answer_type': 'single_choice',
            'choices': [{'label': 'Achat.', 'order': 0}, {'label': 'Vente.', 'order': 1}],
        }
        first = self.client.post(
            reverse('daily_journal:question-template-list'),
            payload,
            format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        duplicate = self.client.post(
            reverse('daily_journal:question-template-list'),
            {**payload, 'label': '  sens du trade ?  '},
            format='json',
        )
        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('duplicate_label', str(duplicate.data))

        other_client = APIClient()
        other_client.force_authenticate(user=self.other)
        other = other_client.post(
            reverse('daily_journal:question-template-list'),
            payload,
            format='json',
        )
        self.assertEqual(other.status_code, status.HTTP_201_CREATED)

    def test_rename_template_label_uniqueness(self):
        keep = QuestionTemplate.objects.create(
            user=self.user,
            label='Contexte',
            answer_type='text',
        )
        other = QuestionTemplate.objects.create(
            user=self.user,
            label='Sens du trade ?',
            answer_type='text',
        )
        taken = self.client.patch(
            reverse('daily_journal:question-template-detail', kwargs={'pk': other.id}),
            {'label': 'contexte'},
            format='json',
        )
        self.assertEqual(taken.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('duplicate_label', str(taken.data))

        same = self.client.patch(
            reverse('daily_journal:question-template-detail', kwargs={'pk': keep.id}),
            {'label': 'Contexte', 'help_text': 'Précision'},
            format='json',
        )
        self.assertEqual(same.status_code, status.HTTP_200_OK)
        self.assertEqual(same.data['help_text'], 'Précision')
        self.assertEqual(same.data['label'], 'Contexte')

    def test_template_label_dedupe_suffix_collision(self):
        import importlib

        migration = importlib.import_module(
            'daily_journal.migrations.0006_unique_question_template_label'
        )
        plan_template_label_updates = migration.plan_template_label_updates

        updates = dict(plan_template_label_updates([
            {'id': 1, 'user_id': 3, 'label': 'Sens du trade ?'},
            {'id': 2, 'user_id': 3, 'label': 'Sens du trade ? (2)'},
            {'id': 3, 'user_id': 3, 'label': 'sens du trade ?'},
            {'id': 4, 'user_id': 9, 'label': 'Sens du trade ?'},
        ]))
        self.assertNotIn(1, updates)
        self.assertNotIn(2, updates)
        self.assertEqual(updates[3], 'sens du trade ? (3)')
        self.assertNotIn(4, updates)

        long_label = 'A' * 500
        truncated = dict(plan_template_label_updates([
            {'id': 1, 'user_id': 1, 'label': long_label},
            {'id': 2, 'user_id': 1, 'label': long_label},
        ]))
        self.assertEqual(len(truncated[2]), 500)
        self.assertTrue(truncated[2].endswith(' (2)'))

        trimmed = dict(plan_template_label_updates([
            {'id': 1, 'user_id': 1, 'label': '  Foo  '},
            {'id': 2, 'user_id': 1, 'label': 'foo'},
        ]))
        self.assertEqual(trimmed[1], 'Foo')
        self.assertEqual(trimmed[2], 'foo (2)')

    def _put_day_number(self, question_id: int, value, day: str = '2026-07-12'):
        return self.client.put(
            '/api/daily-journal/answers/bulk/',
            {
                'scope': 'day',
                'date': day,
                'trading_account': self.account.id,
                'answers': [{'question_id': question_id, 'value': value}],
            },
            format='json',
        )

    def test_number_integer_decimal_and_legacy(self):
        questionnaire = Questionnaire.get_or_create_for_scope(self.user, 'day')
        integer_q = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Contrats',
            answer_type='number',
            config={'decimal': False},
            order=0,
        )
        decimal_q = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Ratio',
            answer_type='number',
            config={'decimal': True},
            order=1,
        )
        legacy_q = QuestionnaireQuestion.objects.create(
            questionnaire=questionnaire,
            label='Ancien nombre',
            answer_type='number',
            config={'min': 0, 'max': 1, 'step': 1},
            order=2,
        )

        whole = self._put_day_number(integer_q.id, 2.0, '2026-07-12')
        self.assertEqual(whole.status_code, status.HTTP_200_OK)
        self.assertEqual(whole.data['answers'][0]['value'], 2)

        rejected = self._put_day_number(integer_q.id, 1.5, '2026-07-13')
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)

        decimal = self._put_day_number(decimal_q.id, 1.5, '2026-07-12')
        self.assertEqual(decimal.status_code, status.HTTP_200_OK)
        self.assertEqual(decimal.data['answers'][0]['value'], 1.5)

        whole_in_decimal = self._put_day_number(decimal_q.id, 3, '2026-07-16')
        self.assertEqual(whole_in_decimal.status_code, status.HTTP_200_OK)
        self.assertIsInstance(whole_in_decimal.data['answers'][0]['value'], int)

        big = 2 ** 60 + 1
        big_res = self._put_day_number(integer_q.id, big, '2026-07-16')
        self.assertEqual(big_res.status_code, status.HTTP_200_OK)
        self.assertEqual(big_res.data['answers'][0]['value'], big)

        legacy = self._put_day_number(legacy_q.id, 1.5, '2026-07-14')
        self.assertEqual(legacy.status_code, status.HTTP_200_OK)
        self.assertEqual(legacy.data['answers'][0]['value'], 1.5)

        kept = self._put_day_number(legacy_q.id, 2.5, '2026-07-15')
        self.assertEqual(kept.status_code, status.HTTP_200_OK)
        legacy_q.config = {'decimal': False}
        legacy_q.save(update_fields=['config', 'updated_at'])

        same = self._put_day_number(legacy_q.id, 2.5, '2026-07-15')
        self.assertEqual(same.status_code, status.HTTP_200_OK)
        self.assertEqual(same.data['answers'][0]['value'], 2.5)

        changed = self._put_day_number(legacy_q.id, 3.5, '2026-07-15')
        self.assertEqual(changed.status_code, status.HTTP_400_BAD_REQUEST)

        replaced = self._put_day_number(legacy_q.id, 3, '2026-07-15')
        self.assertEqual(replaced.status_code, status.HTTP_200_OK)
        self.assertEqual(replaced.data['answers'][0]['value'], 3)
