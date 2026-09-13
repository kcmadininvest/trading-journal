"""Tests dispatch Celery vs thread pour les téléchargements historiques."""
from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase

from market_data.services.download_dispatch import (
    celery_workers_available,
    dispatch_historical_download,
)


class CeleryWorkersAvailableTests(SimpleTestCase):
    @patch('trading_journal_api.celery.app')
    def test_false_when_ping_empty(self, mock_app):
        mock_app.control.inspect.return_value.ping.return_value = None
        self.assertFalse(celery_workers_available())

    @patch('trading_journal_api.celery.app')
    def test_true_when_worker_responds(self, mock_app):
        mock_app.control.inspect.return_value.ping.return_value = {'w1': {'ok': 'pong'}}
        self.assertTrue(celery_workers_available())


class DispatchHistoricalDownloadTests(TestCase):
    @patch('market_data.services.download_dispatch.run_download_job_in_thread')
    @patch('market_data.services.download_dispatch.celery_workers_available', return_value=False)
    def test_falls_back_to_thread(self, _avail, mock_thread):
        mode = dispatch_historical_download(42)
        self.assertEqual(mode, 'thread')
        mock_thread.assert_called_once_with(42)

    @patch('market_data.tasks.run_historical_download')
    @patch('market_data.services.download_dispatch.celery_workers_available', return_value=True)
    def test_uses_celery_when_workers(self, _avail, mock_task):
        mock_task.delay = MagicMock()
        mode = dispatch_historical_download(7)
        self.assertEqual(mode, 'celery')
        mock_task.delay.assert_called_once_with(7)
