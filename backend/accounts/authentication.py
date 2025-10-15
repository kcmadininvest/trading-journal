"""
Authentification personnalisée avec vérification de blacklist
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import AccessToken


class BlacklistJWTAuthentication(JWTAuthentication):
    """
    Authentification JWT avec vérification de blacklist
    """
    
    def get_validated_token(self, raw_token):
        """
        Valide le token et vérifie s'il est blacklisté
        """
        # Valider le token d'abord
        validated_token = super().get_validated_token(raw_token)
        
        # Vérifier si le token est blacklisté
        jti = validated_token.get('jti')
        if jti:
            try:
                # Vérifier si le token est dans la blacklist
                blacklisted = BlacklistedToken.objects.filter(token__jti=jti).exists()
                if blacklisted:
                    raise InvalidToken('Token has been blacklisted')
            except Exception as e:
                raise InvalidToken(f'Token validation failed: {str(e)}')
        
        return validated_token
