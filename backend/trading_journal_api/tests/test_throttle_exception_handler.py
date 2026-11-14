"""Messages 429 throttle clarifiés pour l'utilisateur."""
from django.test import SimpleTestCase, override_settings
from rest_framework.exceptions import Throttled
from rest_framework.test import APIRequestFactory
from rest_framework.views import APIView

from trading_journal_api.exception_handlers import custom_exception_handler


@override_settings(
    REST_FRAMEWORK={
        'EXCEPTION_HANDLER': 'trading_journal_api.exception_handlers.custom_exception_handler',
    }
)
class ThrottleExceptionHandlerTests(SimpleTestCase):
    def test_throttled_response_includes_wait_and_clear_detail(self):
        factory = APIRequestFactory()
        request = factory.get('/api/accounts/auth/login/')
        view = APIView()
        view.request = view.initialize_request(request)
        context = {'view': view, 'request': view.request}

        response = custom_exception_handler(Throttled(wait=42), context)

        self.assertIsNotNone(response)
        assert response is not None
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data.get('code'), 'throttled')
        self.assertEqual(response.data.get('wait'), 42)
        detail = response.data.get('detail') or ''
        self.assertIn('Trop de tentatives', detail)
        self.assertIn('pas un bug', detail)
        self.assertIn('42', detail)
        self.assertNotIn('Request was throttled', detail)
        self.assertNotIn('Expected available', detail)
