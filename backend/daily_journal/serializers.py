from rest_framework import serializers

from .models import DailyJournalEntry, DailyJournalImage


class DailyJournalImageSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = DailyJournalImage
        fields = ['id', 'image', 'image_url', 'caption', 'order', 'created_at']
        read_only_fields = ['id', 'created_at', 'image_url']

    def get_image_url(self, obj) -> str:
        request = self.context.get('request')
        if not obj.image:
            return ''
        if request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url


class DailyJournalEntrySerializer(serializers.ModelSerializer):
    images = DailyJournalImageSerializer(many=True, read_only=True)
    trading_account_name = serializers.CharField(source='trading_account.name', read_only=True)

    class Meta:
        model = DailyJournalEntry
        fields = [
            'id',
            'user',
            'trading_account',
            'trading_account_name',
            'date',
            'content',
            'images',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']

    def validate(self, attrs):
        user = self.context['request'].user
        trading_account = attrs.get('trading_account')
        date = attrs.get('date') or getattr(self.instance, 'date', None)

        if not date:
            return attrs

        qs = DailyJournalEntry.objects.filter(user=user, date=date)
        if trading_account:
            qs = qs.filter(trading_account=trading_account)
        else:
            qs = qs.filter(trading_account__isnull=True)

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                {'date': "Une entrée existe déjà pour ce jour et ce compte."}
            )

        return attrs


class DailyJournalImageUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyJournalImage
        fields = ['caption', 'order']
