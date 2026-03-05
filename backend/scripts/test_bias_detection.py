"""
Script pour tester la détection des biais comportementaux pour l'utilisateur csylvanie.
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

def test_bias_detection():
    """Teste la détection des biais pour l'utilisateur csylvanie."""
    
    print("🔍 Test de la détection des biais comportementaux\n")
    
    # Récupérer l'utilisateur
    try:
        user = User.objects.get(username='csylvanie')
        print(f"✅ Utilisateur trouvé: {user.username}")
    except User.DoesNotExist:
        print("❌ Utilisateur 'csylvanie' non trouvé")
        return
    
    # Créer le service de reconnaissance de patterns
    pattern_service = PatternRecognitionService(user)
    
    # Détecter les biais
    print("\n📊 Détection des biais comportementaux...\n")
    biases = pattern_service.detect_behavioral_biases()
    
    if not biases:
        print("ℹ️  Aucun biais détecté (peut-être pas assez de données)")
        return
    
    print(f"✅ {len(biases)} biais détectés:\n")
    
    # Afficher chaque biais détecté
    for i, bias in enumerate(biases, 1):
        print(f"{i}. {bias['bias']}")
        print(f"   Sévérité: {bias['severity'].upper()}")
        print(f"   Description: {bias['description']}")
        print(f"   Recommandation: {bias['recommendation']}")
        
        if 'metrics' in bias:
            print(f"   Métriques:")
            for key, value in bias['metrics'].items():
                if isinstance(value, float):
                    print(f"     - {key}: {value:.2f}")
                else:
                    print(f"     - {key}: {value}")
        print()
    
    # Résumé des biais par sévérité
    severity_counts = {}
    for bias in biases:
        severity = bias['severity']
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
    
    print("📈 Résumé par sévérité:")
    for severity, count in sorted(severity_counts.items()):
        print(f"   - {severity.upper()}: {count}")
    
    # Vérifications attendues
    print("\n✅ Vérifications:")
    
    bias_types = [b['bias'] for b in biases]
    
    expected_biases = {
        'Revenge Trading': '~12 trades de vengeance injectés',
        'FOMO': '~8 trades FOMO injectés',
        'Loss Aversion': '~6 trades avec loss aversion',
        'Premature Exit': '~8 trades avec sortie prématurée',
    }
    
    for expected_bias, description in expected_biases.items():
        if expected_bias in bias_types:
            print(f"   ✓ {expected_bias} détecté ({description})")
        else:
            print(f"   ✗ {expected_bias} NON détecté (attendu: {description})")
    
    print("\n" + "="*60)
    print("Test terminé!")
    print("="*60)

if __name__ == '__main__':
    test_bias_detection()
