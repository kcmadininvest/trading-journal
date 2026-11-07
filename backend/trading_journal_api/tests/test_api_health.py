"""Sondage /api/health/ : OK en HTTP local même avec SECURE_SSL_REDIRECT."""
from django.test import TestCase, Client, override_settings


@override_settings(
    DEBUG=False,
    SECURE_SSL_REDIRECT=True,
    SECURE_REDIRECT_EXEMPT=[r'^api/health/?$'],
    ALLOWED_HOSTS=['127.0.0.1', 'localhost', 'testserver'],
)
class ApiHealthSecureRedirectTests(TestCase):
    def setUp(self) -> None:
        self.client = Client()

    def test_health_get_returns_ok_over_http(self) -> None:
        response = self.client.get('/api/health/', HTTP_HOST='127.0.0.1')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'status': 'ok'})

    def test_other_api_still_redirects_to_https(self) -> None:
        response = self.client.get('/api/accounts/profile/', HTTP_HOST='127.0.0.1')
        self.assertIn(response.status_code, (301, 302))
