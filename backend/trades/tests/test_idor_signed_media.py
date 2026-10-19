"""IDOR médias signés : binding user/path sur screenshots + journal images."""
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import User
from daily_journal.image_access import sign_journal_image_payload
from daily_journal.models import DailyJournalEntry, DailyJournalImage
from trades.models import TradingAccount
from trades.protected_screenshot_urls import sign_screenshot_media_token


# Minimal 1x1 PNG
_PNG_BYTES = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00'
    b'\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
)


class IdorSignedMediaTests(APITestCase):
    def setUp(self) -> None:
        self.user_a = User.objects.create_user(
            email='idor-media-a@example.com',
            username='idor_media_a',
            password='testpass123',
            first_name='A',
            last_name='Media',
            role='user',
        )
        self.user_b = User.objects.create_user(
            email='idor-media-b@example.com',
            username='idor_media_b',
            password='testpass123',
            first_name='B',
            last_name='Media',
            role='user',
        )
        self.rel_b = f'screenshots/{self.user_b.id}/idor/alien.webp'
        self.rel_a = f'screenshots/{self.user_a.id}/idor/own.webp'
        root = Path(settings.MEDIA_ROOT)
        for rel in (self.rel_a, self.rel_b):
            path = root / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(_PNG_BYTES)

        account_b = TradingAccount.objects.create(
            user=self.user_b,
            name='Media Account B',
            account_type='other',
            currency='USD',
            initial_capital=Decimal('10000.00'),
            status='active',
            is_default=True,
        )
        self.entry_b = DailyJournalEntry.objects.create(
            user=self.user_b,
            trading_account=account_b,
            date=timezone.now().date(),
            content='secret',
        )
        self.image_b = DailyJournalImage.objects.create(
            entry=self.entry_b,
            image=SimpleUploadedFile('alien.png', _PNG_BYTES, content_type='image/png'),
            order=0,
        )

    def test_sign_screenshot_rejects_alien_path(self) -> None:
        self.client.force_authenticate(user=self.user_a)
        response = self.client.post(
            '/api/trades/sign-screenshot-display-url/',
            {'url': f'/media/{self.rel_b}'},
            format='json',
        )
        self.assertEqual(response.status_code, 403, response.data)

    def test_protected_screenshot_rejects_user_path_mismatch(self) -> None:
        # Token signed for user A but path under user B
        token = sign_screenshot_media_token(self.rel_b, self.user_a.id)
        response = self.client.get(f'/api/trades/protected-screenshot/?s={token}')
        self.assertIn(response.status_code, (403, 404), response.content)

    def test_protected_screenshot_rejects_foreign_path_with_valid_token(self) -> None:
        # Valid token for A's own file, then request must still bind path to u
        # Craft: token u=A,r=path_A is valid; serving path B requires mismatch check
        # which is in the token payload itself — so use token for A with path B
        token_a_on_b = sign_screenshot_media_token(self.rel_b, self.user_a.id)
        response = self.client.get(f'/api/trades/protected-screenshot/?s={token_a_on_b}')
        self.assertEqual(response.status_code, 404, response.content)
        # Control: token A + path A serves OK
        token_ok = sign_screenshot_media_token(self.rel_a, self.user_a.id)
        ok = self.client.get(f'/api/trades/protected-screenshot/?s={token_ok}')
        self.assertEqual(ok.status_code, 200)

    def test_journal_image_alien_access_denied(self) -> None:
        # Nested detail under user A's auth → entry B invisible → 404
        self.client.force_authenticate(user=self.user_a)
        nested = self.client.patch(
            f'/api/daily-journal/entries/{self.entry_b.id}/images/{self.image_b.id}/',
            {'caption': 'hack'},
            format='json',
        )
        self.assertEqual(nested.status_code, 404, nested.data)

        # Token with wrong user id for image B
        bad_token = sign_journal_image_payload(self.image_b.id, self.user_a.id)
        serve = self.client.get(
            f'/api/daily-journal/journal-images/{self.image_b.id}/?s={bad_token}'
        )
        self.assertIn(serve.status_code, (403, 404), serve.content)
