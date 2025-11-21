"""
Classes de throttling personnalisées pour la protection contre les attaques par force brute
"""
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


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

