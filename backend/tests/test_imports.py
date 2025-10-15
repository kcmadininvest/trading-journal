"""
Tests d'importation pour vérifier que tous les modules sont correctement installés.
"""

import unittest


class TestImports(unittest.TestCase):
    """Tests pour vérifier que tous les imports fonctionnent."""
    
    def test_django_imports(self):
        """Test des imports Django."""
        try:
            import django
            from django.test import TestCase
            from django.contrib.auth.models import User
            print(f"✅ Django {django.get_version()} importé avec succès")
        except ImportError as e:
            self.fail(f"Erreur d'import Django: {e}")
    
    def test_drf_imports(self):
        """Test des imports Django REST Framework."""
        try:
            import rest_framework
            from rest_framework.test import APITestCase
            from rest_framework import status
            print(f"✅ Django REST Framework importé avec succès")
        except ImportError as e:
            self.fail(f"Erreur d'import DRF: {e}")
    
    def test_app_imports(self):
        """Test des imports de l'application."""
        try:
            from trades.models import TopStepTrade
            from trades.serializers import TopStepTradeSerializer
            from accounts.models import User
            print("✅ Modules de l'application importés avec succès")
        except ImportError as e:
            self.fail(f"Erreur d'import des modules de l'application: {e}")


if __name__ == '__main__':
    unittest.main()
