# Generated migration to transfer old news fields to new JSON format

from django.db import migrations


def migrate_news_to_json(apps, schema_editor):
    """
    Migrer les données des anciens champs news_event, news_impact, news_description
    vers le nouveau champ news_events (JSON).
    """
    SessionContext = apps.get_model('trades', 'SessionContext')
    
    for session in SessionContext.objects.all():
        # Si news_event est True et qu'il y a des données
        if session.news_event and (session.news_impact != 'none' or session.news_description):
            # Créer un événement dans le nouveau format
            news_events = [{
                'impact': session.news_impact if session.news_impact else 'none',
                'description': session.news_description if session.news_description else ''
            }]
            session.news_events = news_events
            session.save(update_fields=['news_events'])


def reverse_migration(apps, schema_editor):
    """
    Migration inverse : restaurer les anciens champs depuis news_events.
    """
    SessionContext = apps.get_model('trades', 'SessionContext')
    
    for session in SessionContext.objects.all():
        if session.news_events and len(session.news_events) > 0:
            first_event = session.news_events[0]
            session.news_event = True
            session.news_impact = first_event.get('impact', 'none')
            session.news_description = first_event.get('description', '')
            session.save(update_fields=['news_event', 'news_impact', 'news_description'])


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0032_add_news_events_json_field'),
    ]

    operations = [
        migrations.RunPython(migrate_news_to_json, reverse_migration),
    ]
