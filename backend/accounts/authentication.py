"""
Authentification personnalisée avec vérification de blacklist
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .jwt_blacklist_cache import is_jti_blacklisted


class BlacklistJWTAuthentication(JWTAuthentication):
    """
    Authentification JWT avec vérification de blacklist (cache Redis + DB).
    """

    def get_validated_token(self, raw_token):
        validated_token = super().get_validated_token(raw_token)

        try:
            jti = validated_token['jti']
        except (KeyError, TypeError):
            jti = None

        if jti:
            try:
                if is_jti_blacklisted(str(jti)):
                    raise InvalidToken('Token has been blacklisted')
            except InvalidToken:
                raise
            except Exception:
                raise InvalidToken('Token validation failed')

        return validated_token
