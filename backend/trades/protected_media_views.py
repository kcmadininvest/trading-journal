"""Vues pour servir des fichiers media protégés (screenshots) via jeton signé."""
import mimetypes

from django.core import signing
from django.http import FileResponse
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .protected_screenshot_urls import (
    _relative_under_media_from_url,
    rel_is_user_screenshot,
    resolve_screenshot_file_or_none,
    transform_screenshot_url_for_response,
    verify_screenshot_media_token,
)


@api_view(['GET'])
@permission_classes([AllowAny])
def serve_protected_screenshot_media(request):
    """Sert un fichier sous media/screenshots/ après vérification du jeton."""
    raw = (request.GET.get('s') or '').strip()
    if not raw:
        return Response(status=status.HTTP_403_FORBIDDEN)
    try:
        payload = verify_screenshot_media_token(raw)
    except (signing.BadSignature, signing.SignatureExpired):
        return Response(status=status.HTTP_403_FORBIDDEN)

    rel = payload.get('r')
    uid = payload.get('u')
    if not rel or uid is None:
        return Response(status=status.HTTP_403_FORBIDDEN)

    path = resolve_screenshot_file_or_none(str(rel), int(uid))
    if path is None:
        return Response(status=status.HTTP_404_NOT_FOUND)

    content_type, _ = mimetypes.guess_type(path.name)
    fh = path.open('rb')
    response = FileResponse(fh, content_type=content_type or 'application/octet-stream')
    response['Cache-Control'] = 'private, max-age=3600'
    return response


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sign_screenshot_display_url(request):
    """
    Retourne une URL signée (GET protected-screenshot) pour afficher une image
    sous media/screenshots/ lorsque l’accès direct /media/ est refusé (ex. Apache).
    """
    url = (request.data.get('url') or '').strip()
    if not url:
        return Response(
            {'detail': 'Le paramètre url est requis.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    uid = request.user.id
    rel = _relative_under_media_from_url(url)
    if rel is not None:
        rel_norm = rel.replace('\\', '/')
        parts = rel_norm.split('/')
        if parts and parts[0] == 'screenshots' and not rel_is_user_screenshot(rel_norm, uid):
            return Response(status=status.HTTP_403_FORBIDDEN)
    signed = transform_screenshot_url_for_response(url, uid, request)
    return Response({'signed_url': signed})
