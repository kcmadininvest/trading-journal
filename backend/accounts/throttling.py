"""
Classes de throttling personnalisées pour la protection contre les attaques par force brute
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
import hashlib


class LoginThrottle(AnonRateThrottle):
    """
    Throttling pour l'endpoint de login
    Limite à 5 tentatives par minute par IP
    """
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    """
    Throttling pour l'endpoint d'inscription
    Limite à 3 inscriptions par heure par IP
    """
    scope = 'register'


class EmailBasedRegisterThrottle(AnonRateThrottle):
    """
    Throttling pour l'endpoint d'inscription basé sur l'email au lieu de l'IP
    Limite à 5 inscriptions par heure par email
    Permet à plusieurs utilisateurs derrière la même IP de s'inscrire
    """
    scope = 'register'
    
    def get_cache_key(self, request, view):
        """
        Génère une clé de cache basée sur l'email au lieu de l'IP
        """
        # Récupérer l'email depuis les données de la requête
        email = None
        if hasattr(request, 'data') and request.data:
            email = request.data.get('email', '').strip().lower()
        
        # Si pas d'email, fallback sur l'IP (pour les requêtes invalides)
        if not email:
            return super().get_cache_key(request, view)
        
        # Hasher l'email pour la clé de cache (sécurité et longueur)
        email_hash = hashlib.md5(email.encode('utf-8')).hexdigest()
        
        # Retourner une clé basée sur l'email hashé
        ident = email_hash
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class ActivationThrottle(AnonRateThrottle):
    """
    Throttling pour l'endpoint d'activation de compte
    Limite à 10 tentatives par heure par IP
    """
    scope = 'activate'


class PasswordResetThrottle(AnonRateThrottle):
    """
    Throttling pour l'endpoint de réinitialisation de mot de passe
    Limite à 3 tentatives par heure par IP
    """
    scope = 'password_reset'

