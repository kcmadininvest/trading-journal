from __future__ import annotations

from celery import shared_task

from market_data.services.downloader import run_download_job


@shared_task(bind=True, max_retries=1, default_retry_delay=60)
def run_historical_download(self, job_id: int) -> None:
    """Télécharge les bougies historiques pour un HistoricalDownloadJob."""
    run_download_job(job_id)
