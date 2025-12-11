"""
Sitemap generator for SEO optimization
"""
from django.contrib.sitemaps import Sitemap


class StaticViewSitemap(Sitemap):
    """Sitemap for static pages"""
    priority = 1.0
    changefreq = 'weekly'

    def items(self):
        # Liste des pages statiques publiques avec leurs URLs
        return [
            {'url': '/', 'priority': 1.0},
            {'url': '/a-propos', 'priority': 0.8},
            {'url': '/fonctionnalites', 'priority': 0.8},
            # {'url': '/guide', 'priority': 0.7},  # À ajouter quand la page sera créée
            # {'url': '/contact', 'priority': 0.6},  # À ajouter quand la page sera créée
        ]

    def location(self, item):
        return item['url']
    
    def priority(self, item):
        return item.get('priority', 0.5)
