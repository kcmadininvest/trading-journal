"""
Script pour tester la détection des biais avec des seuils personnalisés.
"""
import os
import sys
import django

# Setup Django
sys.path.append('/var/www/html/trading_journal/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trading_journal_api.settings')
django.setup()

from django.contrib.auth import get_user_model
from trades.services.analytics_service import PatternRecognitionService

User = get_user_model()

def test_custom_thresholds():
    """Teste la détection avec des seuils personnalisés."""
    
    print("🔍 Test de la détection avec seuils personnalisés\n")
    
    # Récupérer l'utilisateur
    try:
        user = User.objects.get(username='csylvanie')
        print(f"✅ Utilisateur trouvé: {user.username}\n")
    except User.DoesNotExist:
        print("❌ Utilisateur 'csylvanie' non trouvé")
        return
    
    # Créer le service de reconnaissance de patterns
    pattern_service = PatternRecognitionService(user)
    
    # Test 1: Seuils par défaut
    print("=" * 60)
    print("TEST 1: Détection avec seuils par défaut")
    print("=" * 60)
    biases_default = pattern_service.detect_behavioral_biases()
    print(f"✅ {len(biases_default)} biais détectés avec seuils par défaut\n")
    
    # Test 2: Seuils plus stricts (moins de détections attendues)
    print("=" * 60)
    print("TEST 2: Détection avec seuils plus stricts")
    print("=" * 60)
    custom_strict = {
        'overtrading': {
            'min_days': 10,  # Plus strict (défaut: 5)
            'min_trades_per_day': 15,  # Plus strict (défaut: 10)
            'high_severity_threshold': 20  # Plus strict (défaut: 15)
        },
        'revenge_trading': {
            'min_occurrences': 10,  # Plus strict (défaut: 5)
            'quick_trade_minutes': 15  # Plus strict (défaut: 30)
        },
        'fomo': {
            'min_occurrences': 10,  # Plus strict (défaut: 5)
            'entry_range_threshold': 90  # Plus strict (défaut: 80)
        },
        'loss_aversion': {
            'min_occurrences': 10  # Plus strict (défaut: 5)
        },
        'premature_exit': {
            'min_occurrences': 10,  # Plus strict (défaut: 5)
            'rr_threshold': 0.3  # Plus strict (défaut: 0.5)
        },
        'stop_loss_widening': {
            'min_occurrences': 10  # Plus strict (défaut: 5)
        }
    }
    
    biases_strict = pattern_service.detect_behavioral_biases(custom_strict)
    print(f"✅ {len(biases_strict)} biais détectés avec seuils stricts")
    print(f"   (Réduction de {len(biases_default) - len(biases_strict)} biais)\n")
    
    # Test 3: Seuils plus permissifs (plus de détections attendues)
    print("=" * 60)
    print("TEST 3: Détection avec seuils plus permissifs")
    print("=" * 60)
    custom_permissive = {
        'overtrading': {
            'min_days': 3,  # Plus permissif (défaut: 5)
            'min_trades_per_day': 7,  # Plus permissif (défaut: 10)
            'high_severity_threshold': 12  # Plus permissif (défaut: 15)
        },
        'revenge_trading': {
            'min_occurrences': 3,  # Plus permissif (défaut: 5)
            'quick_trade_minutes': 60  # Plus permissif (défaut: 30)
        },
        'fomo': {
            'min_occurrences': 3,  # Plus permissif (défaut: 5)
            'entry_range_threshold': 70  # Plus permissif (défaut: 80)
        },
        'loss_aversion': {
            'min_occurrences': 3  # Plus permissif (défaut: 5)
        },
        'premature_exit': {
            'min_occurrences': 3,  # Plus permissif (défaut: 5)
            'rr_threshold': 0.7  # Plus permissif (défaut: 0.5)
        },
        'stop_loss_widening': {
            'min_occurrences': 3  # Plus permissif (défaut: 5)
        }
    }
    
    biases_permissive = pattern_service.detect_behavioral_biases(custom_permissive)
    print(f"✅ {len(biases_permissive)} biais détectés avec seuils permissifs")
    print(f"   (Augmentation de {len(biases_permissive) - len(biases_default)} biais)\n")
    
    # Résumé
    print("=" * 60)
    print("RÉSUMÉ DES TESTS")
    print("=" * 60)
    print(f"Seuils par défaut:   {len(biases_default)} biais détectés")
    print(f"Seuils stricts:      {len(biases_strict)} biais détectés")
    print(f"Seuils permissifs:   {len(biases_permissive)} biais détectés")
    print()
    
    # Vérifier que les seuils personnalisés ont un effet
    if len(biases_strict) < len(biases_default):
        print("✅ Les seuils stricts réduisent bien le nombre de détections")
    else:
        print("⚠️  Les seuils stricts n'ont pas réduit les détections")
    
    if len(biases_permissive) >= len(biases_default):
        print("✅ Les seuils permissifs augmentent ou maintiennent les détections")
    else:
        print("⚠️  Les seuils permissifs ont réduit les détections")
    
    print("\n" + "=" * 60)
    print("Test terminé!")
    print("=" * 60)

if __name__ == '__main__':
    test_custom_thresholds()
