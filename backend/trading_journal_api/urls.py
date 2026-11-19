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
from rest_framework.permissions import AllowAny, BasePermission, IsAuthenticated

from .sitemap import StaticViewSitemap
import os
from xml.etree.ElementTree import Element, SubElement, tostring
from django.utils.encoding import smart_str
from datetime import datetime
import time

from django.core.cache import cache

# Sitemaps
sitemaps = {
    'static': StaticViewSitemap,
}

# Vue personnalisée pour générer le sitemap XML
def generate_sitemap(request):
    """Génère le sitemap XML manuellement avec support des images"""
    urlset = Element('urlset')
    urlset.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
    urlset.set('xmlns:image', 'http://www.google.com/schemas/sitemap-image/1.1')
    
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
        changefreq.text = item.get('changefreq', getattr(sitemap_instance, 'changefreq', 'weekly'))
        
        priority = SubElement(url_elem, 'priority')
        priority.text = str(item.get('priority', 0.5))
        
        # Ajouter les images si présentes
        if 'images' in item:
            for img in item['images']:
                image_elem = SubElement(url_elem, 'image:image')
                image_loc = SubElement(image_elem, 'image:loc')
                image_loc.text = f'{base_url}{img["loc"]}'
                
                if 'title' in img:
                    image_title = SubElement(image_elem, 'image:title')
                    image_title.text = img['title']
                
                if 'caption' in img:
                    image_caption = SubElement(image_elem, 'image:caption')
                    image_caption.text = img['caption']
    
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
        '.txt': 'text/plain; charset=utf-8',
        '.xml': 'application/xml',
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

# Vue pour servir les données structurées JSON-LD pour le logo Google
def organization_schema(request):
    """Retourne les données structurées de l'organisation pour Google"""
    domain = getattr(settings, 'SITE_DOMAIN', 'app.kctradingjournal.com')
    base_url = f'https://{domain}'
    
    schema_data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "K&C Trading Journal",
        "url": base_url,
        "logo": {
            "@type": "ImageObject",
            "url": f"{base_url}/android-chrome-512x512.png",
            "width": 512,
            "height": 512
        },
        "image": f"{base_url}/android-chrome-512x512.png",
        "description": "Professional trading journal application to track, analyze and optimize your trading performance. 100% free, no hidden fees.",
        "sameAs": [
            base_url
        ],
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "url": base_url
        }
    }
    
    return JsonResponse(schema_data, json_dumps_params={'indent': 2})


def api_health(request):
    """Sondage minimal pour le front (footer) et la supervision ; aucune donnée métier."""
    if request.method != 'GET':
        return JsonResponse({'detail': 'Method not allowed'}, status=405)

    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        client_ip = xff.split(',')[0].strip()[:200]
    else:
        client_ip = (request.META.get('REMOTE_ADDR') or 'unknown')[:200]

    bucket = int(time.time()) // 60
    rl_key = f'api_health:rl:{client_ip}:{bucket}'
    try:
        hits = cache.incr(rl_key)
    except ValueError:
        cache.add(rl_key, 1, timeout=90)
        try:
            hits = cache.incr(rl_key)
        except ValueError:
            hits = 1
    if hits > 120:
        return JsonResponse({'detail': 'Too many requests'}, status=429)

    return JsonResponse({'status': 'ok'})


class _ApiSchemaAccess(BasePermission):
    """En production : schéma OpenAPI réservé aux comptes administrateur authentifiés."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return bool(
            getattr(user, 'is_superuser', False)
            or getattr(user, 'is_staff', False)
            or getattr(user, 'role', None) == 'admin'
        )


class StaffOrDebugSpectacularAPIView(SpectacularAPIView):
    def get_permissions(self):
        if settings.DEBUG:
            return [AllowAny()]
        return [IsAuthenticated(), _ApiSchemaAccess()]


class StaffOrDebugSpectacularSwaggerView(SpectacularSwaggerView):
    def get_permissions(self):
        if settings.DEBUG:
            return [AllowAny()]
        return [IsAuthenticated(), _ApiSchemaAccess()]


urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/health/', api_health, name='api_health'),

    # API Documentation (accès restreint hors DEBUG)
    path('schema/', StaffOrDebugSpectacularAPIView.as_view(), name='schema'),
    path('docs/', StaffOrDebugSpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    
    # Sitemap (vue personnalisée pour éviter les problèmes de template)
    path('sitemap.xml', generate_sitemap, name='sitemap'),
    
    # Données structurées pour Google (logo, organisation)
    path('organization.json', organization_schema, name='organization_schema'),
    path('robots.txt', serve_template_file, {'filename': 'robots.txt'}, name='robots_txt'),
    
    # Fichiers statiques depuis templates (favicon, manifest, logos)
    path('favicon.ico', serve_template_file, {'filename': 'favicon.ico'}, name='favicon_ico'),
    path('favicon.svg', serve_template_file, {'filename': 'favicon.svg'}, name='favicon_svg'),
    path('app-icon-boussole-v2.svg', serve_template_file, {'filename': 'app-icon-boussole-v2.svg'}, name='app_icon_boussole_v2_svg'),
    path('app-icon-boussole-v2.ico', serve_template_file, {'filename': 'app-icon-boussole-v2.ico'}, name='app_icon_boussole_v2_ico'),
    path('app-icon-zandoli-v1.svg', serve_template_file, {'filename': 'app-icon-zandoli-v1.svg'}, name='app_icon_zandoli_v1_svg'),
    path('app-icon-zandoli-v1.ico', serve_template_file, {'filename': 'app-icon-zandoli-v1.ico'}, name='app_icon_zandoli_v1_ico'),
    path('app-icon-zandoli-v2.svg', serve_template_file, {'filename': 'app-icon-zandoli-v2.svg'}, name='app_icon_zandoli_v2_svg'),
    path('app-icon-zandoli-v2.ico', serve_template_file, {'filename': 'app-icon-zandoli-v2.ico'}, name='app_icon_zandoli_v2_ico'),
    path('app-icon-zandoli-jaune-v1.svg', serve_template_file, {'filename': 'app-icon-zandoli-jaune-v1.svg'}, name='app_icon_zandoli_jaune_v1_svg'),
    path('app-icon-zandoli-jaune-v1.ico', serve_template_file, {'filename': 'app-icon-zandoli-jaune-v1.ico'}, name='app_icon_zandoli_jaune_v1_ico'),
    path('mstile-310x310-base.png', serve_template_file, {'filename': 'mstile-310x310-base.png'}, name='mstile_310_base'),
    path('favicon-16x16.png', serve_template_file, {'filename': 'favicon-16x16.png'}, name='favicon_16'),
    path('favicon-32x32.png', serve_template_file, {'filename': 'favicon-32x32.png'}, name='favicon_32'),
    path('favicon-48x48.png', serve_template_file, {'filename': 'favicon-48x48.png'}, name='favicon_48'),
    path('favicon-64x64.png', serve_template_file, {'filename': 'favicon-64x64.png'}, name='favicon_64'),
    path('favicon-96x96.png', serve_template_file, {'filename': 'favicon-96x96.png'}, name='favicon_96'),
    path('favicon-128x128.png', serve_template_file, {'filename': 'favicon-128x128.png'}, name='favicon_128'),
    path('favicon-180x180.png', serve_template_file, {'filename': 'favicon-180x180.png'}, name='favicon_180'),
    path('favicon-256x256.png', serve_template_file, {'filename': 'favicon-256x256.png'}, name='favicon_256'),
    path('favicon-512x512.png', serve_template_file, {'filename': 'favicon-512x512.png'}, name='favicon_512'),
    path('favicon-1024x1024.png', serve_template_file, {'filename': 'favicon-1024x1024.png'}, name='favicon_1024'),
    path('apple-touch-icon.png', serve_template_file, {'filename': 'apple-touch-icon.png'}, name='apple_touch_icon'),
    path('apple-touch-icon-120x120.png', serve_template_file, {'filename': 'apple-touch-icon-120x120.png'}, name='apple_touch_120'),
    path('apple-touch-icon-152x152.png', serve_template_file, {'filename': 'apple-touch-icon-152x152.png'}, name='apple_touch_152'),
    path('apple-touch-icon-167x167.png', serve_template_file, {'filename': 'apple-touch-icon-167x167.png'}, name='apple_touch_167'),
    path('apple-touch-icon-180x180.png', serve_template_file, {'filename': 'apple-touch-icon-180x180.png'}, name='apple_touch_180'),
    path('android-chrome-192x192.png', serve_template_file, {'filename': 'android-chrome-192x192.png'}, name='android_chrome_192'),
    path('icon-256x256.png', serve_template_file, {'filename': 'icon-256x256.png'}, name='pwa_icon_256'),
    path('icon-384x384.png', serve_template_file, {'filename': 'icon-384x384.png'}, name='pwa_icon_384'),
    path('android-chrome-512x512.png', serve_template_file, {'filename': 'android-chrome-512x512.png'}, name='android_chrome_512'),
    path('android-chrome-maskable-192x192.png', serve_template_file, {'filename': 'android-chrome-maskable-192x192.png'}, name='android_chrome_maskable_192'),
    path('android-chrome-maskable-512x512.png', serve_template_file, {'filename': 'android-chrome-maskable-512x512.png'}, name='android_chrome_maskable_512'),
    path('icon-monochrome-512x512.png', serve_template_file, {'filename': 'icon-monochrome-512x512.png'}, name='pwa_icon_monochrome_512'),
    path('safari-pinned-tab.svg', serve_template_file, {'filename': 'safari-pinned-tab.svg'}, name='safari_pinned_tab'),
    path('mstile-44x44.png', serve_template_file, {'filename': 'mstile-44x44.png'}, name='mstile_44'),
    path('mstile-70x70.png', serve_template_file, {'filename': 'mstile-70x70.png'}, name='mstile_70'),
    path('mstile-150x150.png', serve_template_file, {'filename': 'mstile-150x150.png'}, name='mstile_150'),
    path('mstile-310x310.png', serve_template_file, {'filename': 'mstile-310x310.png'}, name='mstile_310'),
    path('mstile-310x150.png', serve_template_file, {'filename': 'mstile-310x150.png'}, name='mstile_310_wide'),
    path('browserconfig.xml', serve_template_file, {'filename': 'browserconfig.xml'}, name='browserconfig'),
    path('icon-transparent-192x192.png', serve_template_file, {'filename': 'icon-transparent-192x192.png'}, name='icon_transparent_192'),
    path('logo.svg', serve_template_file, {'filename': 'logo.svg'}, name='logo_svg'),
    path('logo-transparent.svg', serve_template_file, {'filename': 'logo-transparent.svg'}, name='logo_transparent_svg'),
    path('logo-transparent-outer.svg', serve_template_file, {'filename': 'logo-transparent-outer.svg'}, name='logo_transparent_outer_svg'),
    path('zandoli-logo.svg', serve_template_file, {'filename': 'zandoli-logo.svg'}, name='zandoli_logo_svg'),
    path('favicon-small.svg', serve_template_file, {'filename': 'favicon-small.svg'}, name='favicon_small_svg'),
    path('monochrome.svg', serve_template_file, {'filename': 'monochrome.svg'}, name='monochrome_svg'),
    path('og-image.png', serve_template_file, {'filename': 'og-image.png'}, name='og_image'),
    path('og-image-1200x630.jpg', serve_template_file, {'filename': 'og-image-1200x630.jpg'}, name='og_image_jpg'),
    path('twitter-card.png', serve_template_file, {'filename': 'twitter-card.png'}, name='twitter_card'),
    path('linkedin-card.png', serve_template_file, {'filename': 'linkedin-card.png'}, name='linkedin_card'),
    path('social-square-1080x1080.png', serve_template_file, {'filename': 'social-square-1080x1080.png'}, name='social_square'),
    path('social-story-1080x1920.png', serve_template_file, {'filename': 'social-story-1080x1920.png'}, name='social_story'),
    path('manifest.json', serve_template_file, {'filename': 'manifest.json'}, name='manifest'),
    path('site.webmanifest', serve_template_file, {'filename': 'site.webmanifest'}, name='site_webmanifest'),
    
    # App URLs
    path('api/accounts/', include('accounts.urls')),
    path('api/trades/', include('trades.urls')),
    path('api/daily-journal/', include('daily_journal.urls')),
    path('api/billing/', include('billing.urls')),
    path('api/trading-activity/', include('trading_activity.urls')),
    path('api/market-data/', include('market_data.urls')),
    path('api/backtest-journal/', include('backtest_journal.urls')),
]

if settings.DEBUG:
    urlpatterns.insert(
        0,
        path("api/test/", lambda r: JsonResponse({"status": "ok"}), name="test"),
    )

# Servir les fichiers media et static AVANT le catch-all React
# Cela permet d'accéder aux fichiers uploadés directement
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    
    # Frontend React (catch-all pour SPA - doit être en dernier)
# Toutes les URLs non matchées ci-dessus seront gérées par React
urlpatterns += [
    path('', TemplateView.as_view(template_name='index.html'), name='home'),
]
