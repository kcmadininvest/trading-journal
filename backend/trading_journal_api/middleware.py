"""
Middleware personnalisé pour la sécurité de l'application Trading Journal.
"""
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Middleware pour ajouter les headers de sécurité CSP et autres.
    Ce middleware gère les headers de sécurité de manière centralisée
    pour éviter les duplications avec Apache.
    """
    
    def process_response(self, request, response):
        """
        Ajoute les headers de sécurité à la réponse.
        """
        # Content Security Policy
        if hasattr(settings, 'CONTENT_SECURITY_POLICY'):
            csp = settings.CONTENT_SECURITY_POLICY
            response['Content-Security-Policy'] = csp
        
        # X-Frame-Options (géré par Django, pas par Apache)
        # Déjà géré par XFrameOptionsMiddleware de Django
        
        # Autres headers de sécurité
        response['X-Content-Type-Options'] = 'nosniff'
        response['Referrer-Policy'] = settings.SECURE_REFERRER_POLICY if hasattr(settings, 'SECURE_REFERRER_POLICY') else 'strict-origin-when-cross-origin'
        
        return response


class CSPNonceMiddleware(MiddlewareMixin):
    """
    Middleware pour générer et injecter des nonces CSP dans les templates.
    Cela permet d'utiliser des scripts inline de manière sécurisée sans 'unsafe-inline'.
    """
    
    def process_request(self, request):
        """
        Génère un nonce unique pour chaque requête.
        """
        import secrets
        request.csp_nonce = secrets.token_urlsafe(16)
    
    def process_response(self, request, response):
        """
        Ajoute le nonce au header CSP si nécessaire.
        """
        if hasattr(request, 'csp_nonce') and hasattr(settings, 'USE_CSP_NONCE') and settings.USE_CSP_NONCE:
            csp = response.get('Content-Security-Policy', '')
            if csp:
                # Remplacer 'unsafe-inline' par le nonce
                csp = csp.replace("'unsafe-inline'", f"'nonce-{request.csp_nonce}'")
                response['Content-Security-Policy'] = csp
        
        return response

