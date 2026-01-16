from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import DailyJournalImage


@receiver(post_delete, sender=DailyJournalImage)
def delete_journal_image_file(sender, instance: DailyJournalImage, **kwargs) -> None:
    if instance.image:
        instance.image.delete(save=False)
