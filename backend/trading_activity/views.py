from __future__ import annotations

from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from billing.permissions import IsPremiumBundleSubscriberOrAdmin
from trades.models import AccountTransaction
from trades.pagination import CustomPageNumberPagination

from .constants import ordered_common_currency_codes
from .models import (
    TradingActivityCredit,
    TradingActivityExpense,
    TradingActivityExpenseCategory,
)
from .serializers import (
    TradingActivityCreditSerializer,
    TradingActivityExpenseCategorySerializer,
    TradingActivityExpenseSerializer,
)


def _parse_iso_date_param(value: str | None, *, param: str) -> date | None:
    if value is None:
        return None
    raw = str(value).strip()
    if raw == '':
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError as exc:
        raise ValidationError({param: 'Format invalide. Utilisez YYYY-MM-DD.'}) from exc


def _parse_int_param(value: str | None, *, param: str) -> int | None:
    if value is None:
        return None
    raw = str(value).strip()
    if raw == '':
        return None
    try:
        return int(raw)
    except ValueError as exc:
        raise ValidationError({param: 'Valeur invalide. Entier requis.'}) from exc


class TradingActivityExpenseCategoryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    serializer_class = TradingActivityExpenseCategorySerializer
    pagination_class = None

    def get_queryset(self):
        return TradingActivityExpenseCategory.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        # SET_NULL on expenses already — categories can be deleted
        super().perform_destroy(instance)


class TradingActivityExpenseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    serializer_class = TradingActivityExpenseSerializer
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        qs = (
            TradingActivityExpense.objects.filter(user=self.request.user)
            .select_related('category')
            .order_by('-date', '-created_at')
        )
        qp = self.request.query_params

        date_from = _parse_iso_date_param(qp.get('date_from'), param='date_from')
        date_to = _parse_iso_date_param(qp.get('date_to'), param='date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        category_id = _parse_int_param(qp.get('category'), param='category')
        if category_id is not None:
            qs = qs.filter(category_id=category_id)

        q = (qp.get('q') or '').strip()
        if q:
            qs = qs.filter(
                Q(invoice_reference__icontains=q) | Q(label__icontains=q) | Q(notes__icontains=q)
            )

        return qs


class TradingActivityCreditViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]
    serializer_class = TradingActivityCreditSerializer
    pagination_class = CustomPageNumberPagination

    def get_queryset(self):
        qs = (
            TradingActivityCredit.objects.filter(user=self.request.user)
            .prefetch_related(
                'linked_account_transactions',
                'linked_account_transactions__trading_account',
            )
            .order_by('-date', '-created_at')
        )
        qp = self.request.query_params

        date_from = _parse_iso_date_param(qp.get('date_from'), param='date_from')
        date_to = _parse_iso_date_param(qp.get('date_to'), param='date_to')
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        q = (qp.get('q') or '').strip()
        if q:
            qs = qs.filter(Q(notes__icontains=q))

        return qs


class CurrencySuggestionsView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]

    def get(self, request):
        return Response({'currencies': ordered_common_currency_codes()})


class TradingActivitySummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]

    def get(self, request):
        user = request.user
        exp_qs = TradingActivityExpense.objects.filter(user=user)
        cred_qs = TradingActivityCredit.objects.filter(user=user)

        primary_currencies = set(exp_qs.values_list('primary_currency', flat=True)) | set(
            cred_qs.values_list('primary_currency', flat=True)
        )
        primary_by_currency = {}
        for cur in sorted(primary_currencies):
            e = exp_qs.filter(primary_currency=cur).aggregate(s=Sum('total'))['s'] or Decimal('0')
            cr = cred_qs.filter(primary_currency=cur).aggregate(s=Sum('amount'))['s'] or Decimal('0')
            primary_by_currency[cur] = {
                'expenses': str(e),
                'credits': str(cr),
                'balance': str(cr - e),
            }

        secondary_currencies = set(
            exp_qs.exclude(secondary_currency='').values_list('secondary_currency', flat=True)
        ) | set(cred_qs.exclude(secondary_currency='').values_list('secondary_currency', flat=True))
        secondary_by_currency = {}
        for cur in sorted(secondary_currencies):
            if not cur:
                continue
            e = (
                exp_qs.filter(secondary_currency=cur).aggregate(s=Sum('secondary_amount'))['s']
                or Decimal('0')
            )
            cr = (
                cred_qs.filter(secondary_currency=cur).aggregate(s=Sum('secondary_amount'))['s']
                or Decimal('0')
            )
            secondary_by_currency[cur] = {
                'expenses': str(e),
                'credits': str(cr),
                'balance': str(cr - e),
            }

        cat_rows = (
            exp_qs.filter(category__isnull=False)
            .values('category_id', 'category__name', 'primary_currency')
            .annotate(total_sum=Sum('total'))
            .order_by('category__name', 'primary_currency')
        )
        expenses_by_category = [
            {
                'category_id': r['category_id'],
                'category_name': r['category__name'],
                'primary_currency': r['primary_currency'],
                'total': str(r['total_sum'] or Decimal('0')),
            }
            for r in cat_rows
        ]

        exp_primary_totals = (
            exp_qs.values('primary_currency')
            .annotate(
                subtotal_sum=Sum('subtotal'),
                vat_sum=Sum('vat_amount'),
                total_sum=Sum('total'),
            )
            .order_by('primary_currency')
        )
        expense_totals_primary = [
            {
                'primary_currency': r['primary_currency'],
                'subtotal': str(r['subtotal_sum'] or Decimal('0')),
                'vat_amount': str(r['vat_sum'] or Decimal('0')),
                'total': str(r['total_sum'] or Decimal('0')),
            }
            for r in exp_primary_totals
        ]
        exp_secondary_totals = (
            exp_qs.exclude(secondary_currency='')
            .values('secondary_currency')
            .annotate(secondary_sum=Sum('secondary_amount'))
            .order_by('secondary_currency')
        )
        expense_totals_secondary = [
            {
                'secondary_currency': r['secondary_currency'],
                'secondary_amount': str(r['secondary_sum'] or Decimal('0')),
            }
            for r in exp_secondary_totals
        ]

        cred_primary_totals = (
            cred_qs.values('primary_currency')
            .annotate(amount_sum=Sum('amount'))
            .order_by('primary_currency')
        )
        credit_totals_primary = [
            {
                'primary_currency': r['primary_currency'],
                'amount': str(r['amount_sum'] or Decimal('0')),
            }
            for r in cred_primary_totals
        ]
        cred_secondary_totals = (
            cred_qs.exclude(secondary_currency='')
            .values('secondary_currency')
            .annotate(secondary_sum=Sum('secondary_amount'))
            .order_by('secondary_currency')
        )
        credit_totals_secondary = [
            {
                'secondary_currency': r['secondary_currency'],
                'secondary_amount': str(r['secondary_sum'] or Decimal('0')),
            }
            for r in cred_secondary_totals
        ]
        # Totaux frais : même devise que l’affichage colonne (saisie), pas seulement la devise secondaire du crédit.
        new_style_fee_q = (
            Q(transfer_fee_amount_input__isnull=False)
            & Q(transfer_fee_amount_input__gt=0)
            & ~Q(transfer_fee_currency='')
        )
        fee_by_currency: dict[str, Decimal] = defaultdict(lambda: Decimal('0'))
        for r in cred_qs.filter(new_style_fee_q).values('transfer_fee_currency').annotate(
            fee_sum=Sum('transfer_fee_amount_input')
        ):
            ccy = (r['transfer_fee_currency'] or '').strip()
            if ccy:
                fee_by_currency[ccy] += r['fee_sum'] or Decimal('0')
        for r in (
            cred_qs.filter(transfer_fee_amount__gt=0)
            .exclude(secondary_currency='')
            .exclude(new_style_fee_q)
            .values('secondary_currency')
            .annotate(fee_sum=Sum('transfer_fee_amount'))
        ):
            ccy = (r['secondary_currency'] or '').strip()
            if ccy:
                fee_by_currency[ccy] += r['fee_sum'] or Decimal('0')
        credit_totals_fees = [
            {
                'currency': ccy,
                'transfer_fee_amount': str(amt),
            }
            for ccy, amt in sorted(fee_by_currency.items(), key=lambda x: x[0])
        ]

        return Response(
            {
                'primary_by_currency': primary_by_currency,
                'secondary_by_currency': secondary_by_currency,
                'expenses_by_category': expenses_by_category,
                'expense_totals': {
                    'primary': expense_totals_primary,
                    'secondary': expense_totals_secondary,
                },
                'credit_totals': {
                    'primary': credit_totals_primary,
                    'secondary': credit_totals_secondary,
                    'fees': credit_totals_fees,
                },
            }
        )


class WithdrawalSuggestionsView(APIView):
    """Retraits (AccountTransaction) du user pour lier un crédit."""

    permission_classes = [permissions.IsAuthenticated, IsPremiumBundleSubscriberOrAdmin]

    def get(self, request):
        # Même périmètre que les retraits « Transactions » : lignes de l’utilisateur
        # ou retraits sur un compte qui lui appartient (tolère d’éventuelles incohérences user_id).
        editing_credit_id = request.query_params.get('editing_credit_id')
        editing_pk: int | None = None
        if editing_credit_id is not None and str(editing_credit_id).strip() != '':
            try:
                cand = int(editing_credit_id)
            except ValueError:
                cand = None
            else:
                if TradingActivityCredit.objects.filter(pk=cand, user=request.user).exists():
                    editing_pk = cand

        used_tx_qs = AccountTransaction.objects.filter(
            trading_activity_credits__user=request.user,
        )
        if editing_pk is not None:
            used_tx_qs = used_tx_qs.exclude(trading_activity_credits__pk=editing_pk)
        used_tx_ids = list(used_tx_qs.values_list('pk', flat=True).distinct())

        qs = AccountTransaction.objects.filter(
            transaction_type='withdrawal',
        ).filter(Q(user_id=request.user.id) | Q(trading_account__user_id=request.user.id))
        if used_tx_ids:
            qs = qs.exclude(pk__in=used_tx_ids)
        qs = qs.distinct().select_related('trading_account').order_by('-transaction_date')[:200]
        data = [
            {
                'id': tx.id,
                'amount': str(tx.amount),
                'transaction_date': tx.transaction_date.isoformat(),
                'trading_account_id': tx.trading_account_id,
                'trading_account_name': tx.trading_account.name,
                'currency': tx.trading_account.currency,
            }
            for tx in qs
        ]
        return Response({'withdrawals': data})
