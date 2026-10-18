"""TTL des jetons media signés (screenshots + journal)."""
from datetime import timedelta
from unittest.mock import patch

from django.core import signing
from django.test import SimpleTestCase
from django.utils import timezone

from daily_journal.image_access import (
    SIGN_MAX_AGE as JOURNAL_SIGN_MAX_AGE,
    load_journal_image_payload,
    sign_journal_image_payload,
)
from trades.protected_screenshot_urls import (
    SIGN_MAX_AGE as SCREENSHOT_SIGN_MAX_AGE,
    sign_screenshot_media_token,
    verify_screenshot_media_token,
)


class SignedMediaTtlTests(SimpleTestCase):
    def test_ttl_is_one_day(self) -> None:
        self.assertEqual(SCREENSHOT_SIGN_MAX_AGE, 24 * 3600)
        self.assertEqual(JOURNAL_SIGN_MAX_AGE, 24 * 3600)

    def test_fresh_screenshot_token_accepts(self) -> None:
        token = sign_screenshot_media_token('screenshots/1/a.webp', 1)
        payload = verify_screenshot_media_token(token)
        self.assertEqual(payload['r'], 'screenshots/1/a.webp')
        self.assertEqual(payload['u'], 1)

    def test_expired_screenshot_token_rejects(self) -> None:
        token = sign_screenshot_media_token('screenshots/1/a.webp', 1)
        past = timezone.now() + timedelta(seconds=SCREENSHOT_SIGN_MAX_AGE + 60)
        with patch('django.core.signing.time.time', return_value=past.timestamp()):
            with self.assertRaises(signing.SignatureExpired):
                verify_screenshot_media_token(token)

    def test_expired_journal_token_rejects(self) -> None:
        token = sign_journal_image_payload(42, 7)
        past = timezone.now() + timedelta(seconds=JOURNAL_SIGN_MAX_AGE + 60)
        with patch('django.core.signing.time.time', return_value=past.timestamp()):
            with self.assertRaises(signing.SignatureExpired):
                load_journal_image_payload(token)
