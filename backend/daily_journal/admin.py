from django.contrib import admin

from .models import DailyJournalEntry, DailyJournalImage


class DailyJournalImageInline(admin.TabularInline):
    model = DailyJournalImage
    extra = 0


@admin.register(DailyJournalEntry)
class DailyJournalEntryAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'date', 'trading_account', 'updated_at')
    list_filter = ('date', 'trading_account')
    search_fields = ('user__email', 'user__username', 'content')
    inlines = [DailyJournalImageInline]


@admin.register(DailyJournalImage)
class DailyJournalImageAdmin(admin.ModelAdmin):
    list_display = ('id', 'entry', 'order', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('entry__user__email', 'caption')
