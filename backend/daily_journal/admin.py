from django.contrib import admin

from .models import (
    DailyJournalEntry,
    DailyJournalImage,
    QuestionTemplate,
    QuestionTemplateChoice,
    Questionnaire,
    QuestionnaireQuestion,
    QuestionnaireQuestionChoice,
    QuestionnaireAnswer,
)


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


class QuestionTemplateChoiceInline(admin.TabularInline):
    model = QuestionTemplateChoice
    extra = 0


@admin.register(QuestionTemplate)
class QuestionTemplateAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'label', 'answer_type', 'is_active', 'updated_at')
    list_filter = ('answer_type', 'is_active')
    search_fields = ('label', 'user__email', 'user__username')
    inlines = [QuestionTemplateChoiceInline]


class QuestionnaireQuestionChoiceInline(admin.TabularInline):
    model = QuestionnaireQuestionChoice
    extra = 0


class QuestionnaireQuestionInline(admin.TabularInline):
    model = QuestionnaireQuestion
    extra = 0
    fields = ('label', 'answer_type', 'required', 'order', 'is_active', 'show_if', 'source_template')
    show_change_link = True


@admin.register(Questionnaire)
class QuestionnaireAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'scope', 'name', 'is_active', 'updated_at')
    list_filter = ('scope', 'is_active')
    search_fields = ('name', 'user__email', 'user__username')
    inlines = [QuestionnaireQuestionInline]


@admin.register(QuestionnaireQuestion)
class QuestionnaireQuestionAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'questionnaire',
        'label',
        'answer_type',
        'order',
        'required',
        'is_active',
    )
    list_filter = ('answer_type', 'is_active', 'required')
    search_fields = ('label', 'questionnaire__user__email')
    inlines = [QuestionnaireQuestionChoiceInline]


@admin.register(QuestionnaireAnswer)
class QuestionnaireAnswerAdmin(admin.ModelAdmin):
    list_display = (
        'id',
        'user',
        'question',
        'date',
        'trading_account',
        'trade',
        'updated_at',
    )
    list_filter = ('date',)
    search_fields = ('question_label_snapshot', 'user__email')
    raw_id_fields = ('question', 'trade', 'trading_account')
