#!/bin/bash
# Démarrage du worker bandeau cours TopStep (systemd trading-journal-market-quotes)

set -euo pipefail

cd /var/www/html/trading_journal/backend

if [ ! -f venv/bin/activate ]; then
  echo "venv introuvable dans $(pwd) — exécutez: python3 -m venv venv && pip install -r requirements.txt" >&2
  exit 1
fi

# shellcheck source=/dev/null
source venv/bin/activate

export DJANGO_SETTINGS_MODULE=trading_journal_api.settings
export MPLCONFIGDIR="${MPLCONFIGDIR:-/var/www/html/trading_journal/backend/var/mplconfig}"
export MARKET_QUOTES_DATA_DIR="${MARKET_QUOTES_DATA_DIR:-/var/www/html/trading_journal/backend/var}"

mkdir -p "$MPLCONFIGDIR" "$MARKET_QUOTES_DATA_DIR"

exec python manage.py run_market_quotes_hub
