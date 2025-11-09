# Generated manually to restore Guardian tables that were incorrectly removed

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0008_remove_unused_tables'),
    ]

    operations = [
        # Restaurer les tables Guardian qui ont été incorrectement supprimées
        # Ces tables sont nécessaires car django-guardian est configuré dans settings.py
        migrations.RunSQL(
            sql="""
            -- Restaurer les tables Guardian nécessaires pour les permissions d'objets
            CREATE TABLE IF NOT EXISTS guardian_userobjectpermission (
                id SERIAL PRIMARY KEY,
                object_pk VARCHAR(255) NOT NULL,
                content_type_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                UNIQUE (user_id, permission_id, object_pk, content_type_id)
            );
            
            CREATE TABLE IF NOT EXISTS guardian_groupobjectpermission (
                id SERIAL PRIMARY KEY,
                object_pk VARCHAR(255) NOT NULL,
                content_type_id INTEGER NOT NULL,
                permission_id INTEGER NOT NULL,
                group_id INTEGER NOT NULL,
                UNIQUE (group_id, permission_id, object_pk, content_type_id)
            );
            """,
            reverse_sql="""
            -- Ne pas supprimer les tables Guardian car elles sont nécessaires
            -- pour le bon fonctionnement de django-guardian configuré dans settings.py
            """,
        ),
    ]
