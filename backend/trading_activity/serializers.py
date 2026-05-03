from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from .constants import COMMON_CURRENCY_CODES, DEFAULT_PRIMARY_CURRENCY
from .models import (
    TradingActivityCredit,
    TradingActivityExpense,
    TradingActivityExpenseCategory,
)


def _normalize_currency(value: str) -> str:
    if not value:
        return DEFAULT_PRIMARY_CURRENCY
    return str(value).strip().upper()


class TradingActivityExpenseCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TradingActivityExpenseCategory
        fields = ('id', 'name', 'created_at', 'updated_at')
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_name(self, value: str) -> str:
        name = (value or '').strip()
        if not name:
            raise serializers.ValidationError('Le nom est requis.')
        return name

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TradingActivityExpenseSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, allow_null=True)

    class Meta:
        model = TradingActivityExpense
        fields = (
            'id',
            'date',
            'primary_currency',
            'subtotal',
            'vat_amount',
            'total',
            'invoice_reference',
            'secondary_amount',
            'secondary_currency',
            'category',
            'category_name',
            'label',
            'notes',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'category_name', 'created_at', 'updated_at')

    def validate_primary_currency(self, value: str) -> str:
        code = _normalize_currency(value)
        if code not in COMMON_CURRENCY_CODES:
            raise serializers.ValidationError('Devise principale non supportée.')
        return code

    def validate_secondary_currency(self, value: str) -> str:
        if not value:
            return ''
        code = _normalize_currency(value)
        if code not in COMMON_CURRENCY_CODES:
            raise serializers.ValidationError('Devise secondaire non supportée.')
        return code

    def validate(self, attrs):
        subtotal = attrs.get('subtotal', getattr(self.instance, 'subtotal', None))
        vat_amount = attrs.get('vat_amount', getattr(self.instance, 'vat_amount', None))
        total = attrs.get('total', getattr(self.instance, 'total', None))
        if subtotal is not None and vat_amount is not None and total is not None:
            expected = Decimal(str(subtotal)) + Decimal(str(vat_amount))
            if abs(Decimal(str(total)) - expected) > Decimal('0.02'):
                raise serializers.ValidationError({'total': 'Le total doit être égal à sous-total + TVA (tolérance 0,02).'})
        sec_amt = attrs.get('secondary_amount', getattr(self.instance, 'secondary_amount', None))
        sec_cur = attrs.get('secondary_currency', getattr(self.instance, 'secondary_currency', None))
        if sec_amt is not None and sec_amt > 0:
            if not sec_cur:
                raise serializers.ValidationError({'secondary_currency': 'Requis avec un montant secondaire.'})
        if sec_cur and (sec_amt is None or sec_amt <= 0):
            raise serializers.ValidationError({'secondary_amount': 'Requis avec une devise secondaire.'})
        category = attrs.get('category', getattr(self.instance, 'category', None))
        if category and self.context['request'].user.id != category.user_id:
            raise serializers.ValidationError({'category': 'Catégorie invalide.'})
        return attrs

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TradingActivityCreditSerializer(serializers.ModelSerializer):
    linked_account_transaction_detail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = TradingActivityCredit
        fields = (
            'id',
            'date',
            'primary_currency',
            'amount',
            'secondary_amount',
            'secondary_currency',
            'linked_account_transaction',
            'linked_account_transaction_detail',
            'notes',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'linked_account_transaction_detail', 'created_at', 'updated_at')

    def get_linked_account_transaction_detail(self, obj: TradingActivityCredit):
        tx = obj.linked_account_transaction
        if not tx:
            return None
        return {
            'id': tx.id,
            'amount': str(tx.amount),
            'transaction_date': tx.transaction_date.isoformat(),
            'trading_account_id': tx.trading_account_id,
            'trading_account_name': tx.trading_account.name,
            'currency': tx.trading_account.currency,
        }

    def validate_primary_currency(self, value: str) -> str:
        code = _normalize_currency(value)
        if code not in COMMON_CURRENCY_CODES:
            raise serializers.ValidationError('Devise principale non supportée.')
        return code

    def validate_secondary_currency(self, value: str) -> str:
        if not value:
            return ''
        code = _normalize_currency(value)
        if code not in COMMON_CURRENCY_CODES:
            raise serializers.ValidationError('Devise secondaire non supportée.')
        return code

    def validate_linked_account_transaction(self, tx):
        if tx is None:
            return None
        user = self.context['request'].user
        if tx.user_id != user.id and tx.trading_account.user_id != user.id:
            raise serializers.ValidationError('Transaction introuvable ou non autorisée.')
        if tx.transaction_type != 'withdrawal':
            raise serializers.ValidationError('Seuls les retraits peuvent être liés.')
        others = TradingActivityCredit.objects.filter(linked_account_transaction=tx)
        if self.instance is not None:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError('Ce retrait est déjà lié à un autre crédit.')
        return tx

    def validate(self, attrs):
        sec_amt = attrs.get('secondary_amount', getattr(self.instance, 'secondary_amount', None))
        sec_cur = attrs.get('secondary_currency', getattr(self.instance, 'secondary_currency', None))
        if sec_amt is not None and sec_amt > 0:
            if not sec_cur:
                raise serializers.ValidationError({'secondary_currency': 'Requis avec un montant secondaire.'})
        if sec_cur and (sec_amt is None or sec_amt <= 0):
            raise serializers.ValidationError({'secondary_amount': 'Requis avec une devise secondaire.'})
        return attrs

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TradingActivitySummarySerializer(serializers.Serializer):
    """Réponse agrégée — construite dans la vue."""

    primary_by_currency = serializers.DictField()
    secondary_by_currency = serializers.DictField()
    expenses_by_category = serializers.ListField()
