from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from trades.models import TradingAccount, ImportedTrade
from .validators import validate_journal_image


ANSWER_TYPE_CHOICES = [
    ('boolean', 'Booléen'),
    ('text', 'Texte'),
    ('number', 'Nombre'),
    ('single_choice', 'Choix unique'),
    ('multiple_choice', 'Choix multiple'),
    ('scale', 'Échelle'),
    ('date', 'Date'),
]

QUESTIONNAIRE_SCOPE_CHOICES = [
    ('day', 'Journée'),
    ('position', 'Position'),
]

CHOICE_ANSWER_TYPES = frozenset({'single_choice', 'multiple_choice'})
BRANCHABLE_ANSWER_TYPES = frozenset({'boolean', 'single_choice', 'multiple_choice'})
SHOW_IF_MAX_CONDITIONS = 10


def daily_journal_image_path(instance, filename: str) -> str:
    entry_date = instance.entry.date
    return f"daily_journal/{entry_date.strftime('%Y/%m')}/{filename}"


class DailyJournalEntry(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_journal_entries',
        verbose_name='Utilisateur',
    )
    trading_account = models.ForeignKey(
        TradingAccount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='daily_journal_entries',
        verbose_name='Compte de trading',
    )
    date = models.DateField(verbose_name='Date')
    content = models.TextField(blank=True, verbose_name='Contenu')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['-date', '-updated_at']
        unique_together = ('user', 'trading_account', 'date')
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['trading_account', 'date']),
        ]
        verbose_name = 'Entrée de journal quotidienne'
        verbose_name_plural = 'Entrées de journal quotidiennes'

    def __str__(self) -> str:
        return f"Journal {self.user} - {self.date}"


class DailyJournalImage(models.Model):
    entry = models.ForeignKey(
        DailyJournalEntry,
        on_delete=models.CASCADE,
        related_name='images',
        verbose_name='Entrée',
    )
    image = models.ImageField(
        upload_to=daily_journal_image_path,
        validators=[validate_journal_image],
        verbose_name='Image',
    )
    caption = models.CharField(
        max_length=255,
        blank=True,
        verbose_name='Légende',
    )
    order = models.PositiveIntegerField(default=0, verbose_name='Ordre')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')

    class Meta:
        ordering = ['order', 'created_at']
        indexes = [
            models.Index(fields=['entry', 'order']),
        ]
        verbose_name = 'Image du journal'
        verbose_name_plural = 'Images du journal'

    def __str__(self) -> str:
        return f"Image {self.entry_id} ({self.order})"


class QuestionTemplate(models.Model):
    """Question réutilisable (bibliothèque Settings)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='question_templates',
        verbose_name='Utilisateur',
    )
    label = models.CharField(max_length=500, verbose_name='Libellé')
    help_text = models.CharField(max_length=1000, blank=True, verbose_name='Aide')
    answer_type = models.CharField(
        max_length=32,
        choices=ANSWER_TYPE_CHOICES,
        verbose_name='Type de réponse',
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Configuration',
        help_text='Ex. min/max/step pour scale/number, max_length pour text',
    )
    is_active = models.BooleanField(default=True, verbose_name='Actif')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['label', 'id']
        indexes = [
            models.Index(fields=['user', 'is_active']),
        ]
        verbose_name = 'Modèle de question'
        verbose_name_plural = 'Modèles de questions'

    def __str__(self) -> str:
        return f"{self.label} ({self.answer_type})"


class QuestionTemplateChoice(models.Model):
    template = models.ForeignKey(
        QuestionTemplate,
        on_delete=models.CASCADE,
        related_name='choices',
        verbose_name='Modèle',
    )
    label = models.CharField(max_length=255, verbose_name='Libellé')
    order = models.PositiveIntegerField(default=0, verbose_name='Ordre')

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'Choix de modèle'
        verbose_name_plural = 'Choix de modèles'

    def __str__(self) -> str:
        return self.label


class Questionnaire(models.Model):
    """Un questionnaire actif par (user, scope) au MVP."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='questionnaires',
        verbose_name='Utilisateur',
    )
    scope = models.CharField(
        max_length=16,
        choices=QUESTIONNAIRE_SCOPE_CHOICES,
        verbose_name='Portée',
    )
    name = models.CharField(max_length=255, blank=True, verbose_name='Nom')
    is_active = models.BooleanField(default=True, verbose_name='Actif')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['scope', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'scope'],
                condition=models.Q(is_active=True),
                name='uniq_active_questionnaire_per_user_scope',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'scope', 'is_active']),
        ]
        verbose_name = 'Questionnaire'
        verbose_name_plural = 'Questionnaires'

    def __str__(self) -> str:
        return f"{self.get_scope_display()} — {self.name or self.pk}"

    @classmethod
    def get_or_create_for_scope(cls, user, scope: str):
        if scope not in dict(QUESTIONNAIRE_SCOPE_CHOICES):
            raise ValidationError({'scope': 'Portée invalide.'})
        defaults = {
            'name': 'Questionnaire du jour' if scope == 'day' else 'Questionnaire positions',
            'is_active': True,
        }
        obj, _created = cls.objects.get_or_create(
            user=user,
            scope=scope,
            is_active=True,
            defaults=defaults,
        )
        return obj


class QuestionnaireQuestion(models.Model):
    """Instance de question dans un questionnaire (vie propre après clone)."""

    questionnaire = models.ForeignKey(
        Questionnaire,
        on_delete=models.CASCADE,
        related_name='questions',
        verbose_name='Questionnaire',
    )
    source_template = models.ForeignKey(
        QuestionTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cloned_questions',
        verbose_name='Modèle source',
    )
    label = models.CharField(max_length=500, verbose_name='Libellé')
    help_text = models.CharField(max_length=1000, blank=True, verbose_name='Aide')
    answer_type = models.CharField(
        max_length=32,
        choices=ANSWER_TYPE_CHOICES,
        verbose_name='Type de réponse',
    )
    config = models.JSONField(default=dict, blank=True, verbose_name='Configuration')
    required = models.BooleanField(default=False, verbose_name='Obligatoire')
    order = models.PositiveIntegerField(default=0, verbose_name='Ordre')
    is_active = models.BooleanField(default=True, verbose_name='Actif')
    show_if = models.JSONField(
        null=True,
        blank=True,
        default=None,
        verbose_name='Condition d\'affichage',
        help_text='{"logic":"and|or","conditions":[{"question_id":…,"operator":"eq|neq","value":…}]}',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['order', 'id']
        indexes = [
            models.Index(fields=['questionnaire', 'is_active', 'order']),
        ]
        verbose_name = 'Question de questionnaire'
        verbose_name_plural = 'Questions de questionnaire'

    def __str__(self) -> str:
        return self.label

    def clean(self):
        from .conditional_visibility import django_validate_show_if

        super().clean()
        if self.questionnaire_id:
            django_validate_show_if(self)


class QuestionnaireQuestionChoice(models.Model):
    question = models.ForeignKey(
        QuestionnaireQuestion,
        on_delete=models.CASCADE,
        related_name='choices',
        verbose_name='Question',
    )
    label = models.CharField(max_length=255, verbose_name='Libellé')
    order = models.PositiveIntegerField(default=0, verbose_name='Ordre')

    class Meta:
        ordering = ['order', 'id']
        verbose_name = 'Choix de question'
        verbose_name_plural = 'Choix de questions'

    def __str__(self) -> str:
        return self.label


class QuestionnaireAnswer(models.Model):
    """Réponse à une instance, jour (account+date) ou position (trade)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='questionnaire_answers',
        verbose_name='Utilisateur',
    )
    question = models.ForeignKey(
        QuestionnaireQuestion,
        on_delete=models.CASCADE,
        related_name='answers',
        verbose_name='Question',
    )
    trading_account = models.ForeignKey(
        TradingAccount,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='questionnaire_answers',
        verbose_name='Compte de trading',
    )
    date = models.DateField(null=True, blank=True, verbose_name='Date')
    trade = models.ForeignKey(
        ImportedTrade,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='questionnaire_answers',
        verbose_name='Trade',
    )
    value = models.JSONField(verbose_name='Valeur')
    question_label_snapshot = models.CharField(
        max_length=500,
        verbose_name='Libellé (snapshot)',
    )
    answer_type_snapshot = models.CharField(
        max_length=32,
        verbose_name='Type (snapshot)',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Créé le')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Modifié le')

    class Meta:
        ordering = ['question__order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['question', 'trading_account', 'date'],
                condition=models.Q(trade__isnull=True, date__isnull=False),
                name='uniq_answer_day_question_account_date',
            ),
            models.UniqueConstraint(
                fields=['question', 'trade'],
                condition=models.Q(trade__isnull=False),
                name='uniq_answer_position_question_trade',
            ),
        ]
        indexes = [
            models.Index(fields=['user', 'date', 'trading_account']),
            models.Index(fields=['user', 'trade']),
        ]
        verbose_name = 'Réponse de questionnaire'
        verbose_name_plural = 'Réponses de questionnaire'

    def __str__(self) -> str:
        return f"Answer {self.question_id} ({self.pk})"

    def clean(self):
        scope = self.question.questionnaire.scope if self.question_id else None
        if scope == 'day':
            if self.trade_id is not None or self.date is None:
                raise ValidationError('Réponse jour : date requise, trade doit être vide.')
        elif scope == 'position':
            if self.trade_id is None or self.date is not None:
                raise ValidationError('Réponse position : trade requis, date doit être vide.')
