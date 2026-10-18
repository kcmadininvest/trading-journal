"""
Authentification JWT avec blacklist + dual-read (cookie puis Bearer).
CSRF forcé uniquement lorsque l'auth provient du cookie.
"""

from rest_framework.authentication import SessionAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken

from .jwt_blacklist_cache import is_jti_blacklisted
from .jwt_cookies import ACCESS_COOKIE_NAME

SAFE_METHODS = ('GET', 'HEAD', 'OPTIONS', 'TRACE')


def _enforce_csrf(request) -> None:
    """Réutilise l'enforcement CSRF de SessionAuthentication (DRF)."""
    SessionAuthentication().enforce_csrf(request)


class BlacklistJWTAuthentication(JWTAuthentication):
    """
    Authentification JWT avec vérification de blacklist (cache Redis + DB).
    Lit d'abord le cookie tj_access, sinon Authorization Bearer.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None
            validated_token = self.get_validated_token(raw_token)
            user = self.get_user(validated_token)
            request.jwt_auth_source = 'bearer'
            return (user, validated_token)

        raw_cookie = request.COOKIES.get(ACCESS_COOKIE_NAME)
        if not raw_cookie:
            return None

        validated_token = self.get_validated_token(raw_cookie)
        user = self.get_user(validated_token)
        request.jwt_auth_source = 'cookie'
        if request.method not in SAFE_METHODS:
            _enforce_csrf(request)
        return (user, validated_token)

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
