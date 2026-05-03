# Generated manually to restore Guardian tables that were incorrectly removed
#
# Historique : une ancienne version de 0008 supprimait les tables Guardian ;
# ce fichier recréait des tables minimales (CREATE IF NOT EXISTS), ce qui
# entrait en conflit avec guardian.0001_initial sur les bases neuves (tests).
# La suppression Guardian est désormais commentée dans 0008 ; l’app guardian
# est la seule source de vérité pour le schéma. Cette migration reste vide
# pour conserver le graphe (merge 0010).

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('trades', '0008_remove_unused_tables'),
    ]

    operations = []
