"""Endpoints passkeys WebAuthn, 2FA TOTP et récupération."""
from __future__ import annotations

import logging
from typing import Optional

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .account_security import (
    GENERIC_RECOVERY_MESSAGE,
    AccountSecurityError,
    begin_totp_setup,
    cancel_pending_recovery_for_user,
    cancel_pending_totp,
    cancel_recovery_by_token,
    complete_recovery,
    confirm_totp_setup,
    create_recovery_request,
    disable_totp,
    record_login,
    regenerate_backup_codes,
    security_status,
    totp_enabled,
    verify_2fa_challenge,
    verify_user_second_factor,
)
from .account_webauthn import (
    GENERIC_AUTH_ERROR,
    begin_authentication,
    begin_registration,
    delete_passkey,
    finish_authentication,
    finish_registration,
)
from .jwt_cookies import (
    REFRESH_COOKIE_NAME,
    set_jwt_cookies,
    strip_tokens_from_response_data,
)
from .models import LoginHistory, User
from .serializers import CustomTokenObtainPairSerializer
from .throttling import LoginThrottle, PasswordResetThrottle
from .utils import send_two_factor_recovery_email

logger = logging.getLogger(__name__)
security_logger = logging.getLogger('security')


def _client_ip(request) -> Optional[str]:
    from .utils import client_ip_from_request

    return client_ip_from_request(request)


def _user_agent(request) -> str:
    return request.META.get('HTTP_USER_AGENT', '') or ''


def _exclude_jti_from_request(request) -> Optional[str]:
    refresh_cookie = request.COOKIES.get(REFRESH_COOKIE_NAME)
    if not refresh_cookie:
        return None
    try:
        return str(RefreshToken(refresh_cookie).get('jti') or '') or None
    except Exception:
        return None


def _require_current_password(user: User, password: str) -> None:
    if not password or not user.check_password(password):
        raise AccountSecurityError('Mot de passe incorrect.', status_code=400, code='bad_password')


def _issue_login_response(user: User, *, method: str, request) -> Response:
    refresh = CustomTokenObtainPairSerializer.get_token(user)
    access = refresh.access_token
    from datetime import datetime, timedelta

    now = datetime.now()
    access_expiry = now + timedelta(hours=1)
    refresh_expiry = now + timedelta(hours=4)
    data = {
        'refresh': str(refresh),
        'access': str(access),
        'user': {
            'id': user.id,
            'email': user.email,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'full_name': user.get_full_name(),
            'role': user.role,
            'is_verified': user.is_verified,
            'is_active': user.is_active,
            'is_admin': user.is_admin,
            'is_regular_user': user.is_regular_user,
            'created_at': user.created_at.isoformat(),
            'updated_at': user.updated_at.isoformat(),
        },
        'session_info': {
            'access_token_expires_at': access_expiry.isoformat(),
            'refresh_token_expires_at': refresh_expiry.isoformat(),
            'session_expires_at': refresh_expiry.isoformat(),
            'auto_logout_warning_at': (refresh_expiry - timedelta(minutes=5)).isoformat(),
        },
    }
    record_login(
        user,
        success=True,
        method=method,
        ip_address=_client_ip(request),
        user_agent=_user_agent(request),
    )
    try:
        from trades.tasks import schedule_warm_stats_cache

        schedule_warm_stats_cache(user.id)
    except Exception as exc:
        logger.debug('warm stats skip: %s', exc)

    response = Response(data, status=status.HTTP_200_OK)
    set_jwt_cookies(response, access=str(access), refresh=str(refresh))
    response.data = strip_tokens_from_response_data(response.data)
    return response


class AccountSecurityStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(security_status(request.user))


class PasskeyRegisterBeginView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            return Response(begin_registration(request.user, request=request))
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class PasskeyRegisterFinishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            cred = request.data.get('credential')
            if not isinstance(cred, dict):
                raise AccountSecurityError('Credential WebAuthn manquant.')
            obj = finish_registration(
                request.user,
                challenge_id=request.data.get('challenge_id', ''),
                credential=cred,
                label=request.data.get('label', ''),
                exclude_jti=_exclude_jti_from_request(request),
            )
            return Response(
                {
                    'message': 'Passkey enregistrée.',
                    'passkey': {
                        'id': obj.pk,
                        'label': obj.label,
                        'created_at': obj.created_at.isoformat(),
                    },
                    'status': security_status(request.user),
                },
                status=status.HTTP_201_CREATED,
            )
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class PasskeyDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            pk = request.data.get('passkey_id')
            try:
                pk_int = int(pk)
            except (TypeError, ValueError) as exc:
                raise AccountSecurityError('Passkey invalide.') from exc
            if not delete_passkey(request.user, pk_int):
                raise AccountSecurityError('Passkey introuvable.')
            return Response(
                {
                    'message': 'Passkey supprimée.',
                    'status': security_status(request.user),
                }
            )
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class PasskeyLoginBeginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        email = request.data.get('email')
        return Response(
            begin_authentication(
                email=email if isinstance(email, str) else None,
                request=request,
            )
        )


class PasskeyLoginFinishView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        try:
            cred = request.data.get('credential')
            if not isinstance(cred, dict):
                raise AccountSecurityError(GENERIC_AUTH_ERROR, status_code=401)
            user = finish_authentication(
                challenge_id=request.data.get('challenge_id', ''),
                credential=cred,
            )
            return _issue_login_response(
                user,
                method=LoginHistory.METHOD_PASSKEY,
                request=request,
            )
        except AccountSecurityError as exc:
            security_logger.warning(
                'Échec login passkey — IP: %s',
                _client_ip(request),
            )
            return Response(
                {'detail': GENERIC_AUTH_ERROR},
                status=status.HTTP_401_UNAUTHORIZED if exc.status_code < 500 else exc.status_code,
            )


class TotpBeginView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            payload = begin_totp_setup(
                request.user,
                exclude_jti=_exclude_jti_from_request(request),
            )
            return Response(payload)
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class TotpConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            codes = confirm_totp_setup(
                request.user,
                request.data.get('code', ''),
                exclude_jti=_exclude_jti_from_request(request),
            )
            return Response(
                {
                    'message': '2FA activé.',
                    'backup_codes': codes,
                    'status': security_status(request.user),
                }
            )
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class TotpDisableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            if totp_enabled(request.user):
                code = (request.data.get('code') or '').strip()
                if not code:
                    raise AccountSecurityError('Code 2FA requis.')
                verify_user_second_factor(request.user, code)
            disable_totp(
                request.user,
                exclude_jti=_exclude_jti_from_request(request),
            )
            return Response(
                {
                    'message': '2FA désactivé.',
                    'status': security_status(request.user),
                }
            )
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class TotpCancelPendingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            cancel_pending_totp(request.user)
            return Response(
                {
                    'message': 'Configuration 2FA annulée.',
                    'status': security_status(request.user),
                }
            )
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class BackupCodesRegenerateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            _require_current_password(request.user, request.data.get('password', ''))
            code = (request.data.get('code') or '').strip()
            if not code:
                raise AccountSecurityError('Code 2FA requis.')
            verify_user_second_factor(request.user, code)
            codes = regenerate_backup_codes(
                request.user,
                exclude_jti=_exclude_jti_from_request(request),
            )
            return Response(
                {
                    'backup_codes': codes,
                    'message': 'Nouveaux codes de secours générés.',
                    'status': security_status(request.user),
                }
            )
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class TwoFactorVerifyView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        challenge = request.data.get('challenge', '')
        code = request.data.get('code', '')
        try:
            user, method = verify_2fa_challenge(challenge, code)
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)
        return _issue_login_response(user, method=method, request=request)


class TwoFactorRecoveryRequestView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        email = (request.data.get('email') or '').strip()
        generic = {'message': GENERIC_RECOVERY_MESSAGE}
        if not email:
            return Response(generic)

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user and totp_enabled(user):
            try:
                recovery = create_recovery_request(user)
                language = request.data.get('language')
                send_two_factor_recovery_email(user, recovery, language=language)
            except Exception as exc:
                logger.error('Erreur récupération 2FA: %s', exc, exc_info=True)
        return Response(generic)


class TwoFactorRecoveryConfirmView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        token = request.data.get('token')
        try:
            user = complete_recovery(token)
            record_login(
                user,
                success=True,
                method=LoginHistory.METHOD_TOTP,
                ip_address=_client_ip(request),
                user_agent=_user_agent(request),
            )
            return Response(
                {
                    'message': (
                        'Le 2FA a été désactivé. Connectez-vous avec votre mot de passe.'
                    ),
                }
            )
        except AccountSecurityError as exc:
            return Response({'detail': exc.message}, status=exc.status_code)


class TwoFactorRecoveryCancelView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        cancel_token = request.data.get('cancel_token')
        ok = cancel_recovery_by_token(cancel_token)
        return Response(
            {
                'message': (
                    'Si une récupération était en cours, elle a été annulée.'
                    if ok
                    else 'Si une récupération était en cours, elle a été annulée.'
                ),
            }
        )


class TwoFactorRecoveryCancelAuthenticatedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        cancel_pending_recovery_for_user(request.user)
        return Response(
            {
                'message': 'Récupération 2FA annulée.',
                'status': security_status(request.user),
            }
        )
