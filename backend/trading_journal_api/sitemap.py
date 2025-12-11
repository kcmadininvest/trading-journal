"""
Sitemap generator for SEO optimization
"""
from django.contrib.sitemaps import Sitemap
from django.conf import settings


class StaticViewSitemap(Sitemap):
    """Sitemap for static pages"""
    changefreq = 'weekly'
    protocol = 'https'
    priority = 0.8

    def items(self):
        # Liste des pages statiques publiques avec leurs URLs et priorités
        return [
            {'url': '/', 'priority': 1.0},
            {'url': '/a-propos', 'priority': 0.8},
            {'url': '/about', 'priority': 0.8},
            {'url': '/acerca-de', 'priority': 0.8},
            {'url': '/uber-uns', 'priority': 0.8},
            {'url': '/fonctionnalites', 'priority': 0.8},
            {'url': '/features', 'priority': 0.8},
            {'url': '/funcionalidades', 'priority': 0.8},
            {'url': '/funktionen', 'priority': 0.8},
        ]

    def location(self, item):
        """Retourne l'URL de l'item"""
        return item['url']
    
    def priority(self, item):
        """Retourne la priorité de l'item"""
        return item.get('priority', 0.5)
    
    def get_domain(self):
        """Retourne le domaine depuis les settings"""
        return getattr(settings, 'SITE_DOMAIN', 'app.kctradingjournal.com')
