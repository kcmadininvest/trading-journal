"""
URL configuration for trading_journal_api project.
"""
from django.contrib import admin
from django.contrib.sitemaps.views import sitemap
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from django.http import JsonResponse, FileResponse, HttpResponse
from django.views.decorators.cache import cache_control
from pathlib import Path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from .sitemap import StaticViewSitemap
import os
from xml.etree.ElementTree import Element, SubElement, tostring
from django.utils.encoding import smart_str
from datetime import datetime

# Sitemaps
sitemaps = {
    'static': StaticViewSitemap,
}

# Vue personnalisée pour générer le sitemap XML
def generate_sitemap(request):
    """Génère le sitemap XML manuellement"""
    urlset = Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    
    sitemap_instance = StaticViewSitemap()
    domain = sitemap_instance.get_domain()
    protocol = getattr(sitemap_instance, 'protocol', 'https')
    base_url = f'{protocol}://{domain}'
    
    # Date actuelle au format ISO (YYYY-MM-DD)
    current_date = datetime.now().strftime('%Y-%m-%d')
    
    for item in sitemap_instance.items():
        url_elem = SubElement(urlset, 'url')
        loc = SubElement(url_elem, 'loc')
        loc.text = f'{base_url}{item["url"]}'
        
        # Ajouter lastmod pour indiquer la date de dernière modification
        lastmod = SubElement(url_elem, 'lastmod')
        lastmod.text = current_date
        
        changefreq = SubElement(url_elem, 'changefreq')
        changefreq.text = getattr(sitemap_instance, 'changefreq', 'weekly')
        
        priority = SubElement(url_elem, 'priority')
        priority.text = str(item.get('priority', 0.5))
    
    xml_content = tostring(urlset, encoding='utf-8', method='xml')
    xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
    
    response = HttpResponse(xml_declaration.encode('utf-8') + xml_content, content_type='application/xml')
    response['Content-Type'] = 'application/xml; charset=utf-8'
    return response

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
    
    # Sitemap (vue personnalisée pour éviter les problèmes de template)
    path('sitemap.xml', generate_sitemap, name='sitemap'),
    
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
]

# Servir les fichiers media et static AVANT le catch-all React
# Cela permet d'accéder aux fichiers uploadés directement
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

# Frontend React (catch-all pour SPA - doit être en dernier)
# Toutes les URLs non matchées ci-dessus seront gérées par React
urlpatterns += [
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
]
