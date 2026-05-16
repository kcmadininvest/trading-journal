from rest_framework.throttling import UserRateThrottle


class IntegrationTestThrottle(UserRateThrottle):
    """Limite les tests de connexion API par utilisateur authentifié."""

    scope = 'integration_test'
