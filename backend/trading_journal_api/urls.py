"""
URL configuration for trading_journal_api project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import JsonResponse, FileResponse, HttpResponse
from django.views.decorators.cache import cache_control
from pathlib import Path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
import os

# Vue pour servir les fichiers statiques depuis templates (favicon, manifest, logos)
def serve_template_file(request, filename):
    """Serve les fichiers statiques depuis le répertoire templates"""
    template_dir = Path(settings.BASE_DIR) / 'trading_journal_api' / 'templates'
    file_path = template_dir / filename
    
    if not file_path.exists() or not file_path.is_file():
        return HttpResponse(status=404)
    
    # Déterminer le content-type selon l'extension
    content_type_map = {
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.png': 'image/png',
        '.ico': 'image/x-icon',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
    }
    
    ext = file_path.suffix.lower()
    content_type = content_type_map.get(ext, 'application/octet-stream')
    
    # FileResponse ferme automatiquement le fichier quand la réponse est envoyée
    try:
        file_handle = open(file_path, 'rb')
        response = FileResponse(file_handle, content_type=content_type)
        response['Cache-Control'] = 'public, max-age=31536000'  # Cache 1 an
        return response
    except IOError:
        return HttpResponse(status=404)

urlpatterns = [
    # Test endpoint
    path("api/test/", lambda r: JsonResponse({"status": "ok"}), name="test"),
    path('admin/', admin.site.urls),
    
    # API Documentation
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    # Fichiers statiques depuis templates (favicon, manifest, logos)
    path('favicon.ico', serve_template_file, {'filename': 'favicon.ico'}, name='favicon_ico'),
    path('favicon-16x16.png', serve_template_file, {'filename': 'favicon-16x16.png'}, name='favicon_16'),
    path('favicon-32x32.png', serve_template_file, {'filename': 'favicon-32x32.png'}, name='favicon_32'),
    path('apple-touch-icon.png', serve_template_file, {'filename': 'apple-touch-icon.png'}, name='apple_touch_icon'),
    path('android-chrome-192x192.png', serve_template_file, {'filename': 'android-chrome-192x192.png'}, name='android_chrome_192'),
    path('android-chrome-512x512.png', serve_template_file, {'filename': 'android-chrome-512x512.png'}, name='android_chrome_512'),
    path('manifest.json', serve_template_file, {'filename': 'manifest.json'}, name='manifest'),
    path('site.webmanifest', serve_template_file, {'filename': 'site.webmanifest'}, name='site_webmanifest'),
    
    # App URLs
    path('api/accounts/', include('accounts.urls')),
    path('api/trades/', include('trades.urls')),
    
    # Frontend React (catch-all pour SPA - doit être en dernier)
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    # En production, servir les fichiers statiques
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
