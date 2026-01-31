from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from django.db.models import Max
from collections import defaultdict
from django.shortcuts import get_object_or_404

from .models import DailyJournalEntry, DailyJournalImage
from .serializers import (
    DailyJournalEntrySerializer,
    DailyJournalImageSerializer,
    DailyJournalImageUpdateSerializer,
)


class DailyJournalEntryViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DailyJournalEntrySerializer  # type: ignore

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return DailyJournalEntry.objects.none()  # type: ignore

        queryset = DailyJournalEntry.objects.filter(user=self.request.user).select_related('trading_account').prefetch_related('images')  # type: ignore

        date = self.request.query_params.get('date')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        trading_account = self.request.query_params.get('trading_account')

        if date:
            queryset = queryset.filter(date=date)
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        if trading_account:
            queryset = queryset.filter(trading_account_id=trading_account)

        return queryset.order_by('-date', '-updated_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def grouped(self, request):
        """
        Retourne les entrées groupées par année et mois.
        """
        queryset = DailyJournalEntry.objects.filter(user=request.user).select_related('trading_account').prefetch_related('images')  # type: ignore

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        trading_account = request.query_params.get('trading_account')
        search = request.query_params.get('search')

        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        if trading_account:
            queryset = queryset.filter(trading_account_id=trading_account)
        if search:
            queryset = queryset.filter(content__icontains=search)

        queryset = queryset.order_by('-date', '-updated_at')

        grouped: dict = defaultdict(lambda: defaultdict(list))
        for entry in queryset:
            year = entry.date.year
            month = entry.date.month
            grouped[year][month].append({
                'id': entry.id,
                'date': entry.date.isoformat(),
                'content_preview': (entry.content or '')[:400],
                'images_count': entry.images.count(),
                'updated_at': entry.updated_at.isoformat(),
                'trading_account': entry.trading_account_id,
                'trading_account_name': entry.trading_account.name if entry.trading_account else None,
            })

        years_payload = []
        for year in sorted(grouped.keys(), reverse=True):
            months_payload = []
            for month in sorted(grouped[year].keys(), reverse=True):
                months_payload.append({
                    'month': month,
                    'entries': grouped[year][month],
                })
            years_payload.append({
                'year': year,
                'months': months_payload,
            })

        return Response({'years': years_payload})

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, pk=None):
        entry = self.get_object()
        image = request.FILES.get('image')
        caption = request.data.get('caption', '')

        if not image:
            return Response(
                {'error': 'Aucun fichier image fourni.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_order = entry.images.aggregate(max_order=Max('order')).get('max_order') or 0
        journal_image = DailyJournalImage.objects.create(
            entry=entry,
            image=image,
            caption=caption,
            order=max_order + 1,
        )
        serializer = DailyJournalImageSerializer(journal_image, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=['patch', 'delete'],
        url_path='images/(?P<image_id>[^/.]+)',
    )
    def image_detail(self, request, pk=None, image_id=None):
        entry = self.get_object()
        image = get_object_or_404(DailyJournalImage, pk=image_id, entry=entry)

        if request.method == 'DELETE':
            image.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = DailyJournalImageUpdateSerializer(image, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(DailyJournalImageSerializer(image, context={'request': request}).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
