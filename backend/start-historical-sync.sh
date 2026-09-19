#!/bin/bash
# Tick de synchronisation historique (systemd trading-journal-historical-sync)
#
# Passer par bash plutôt que par le binaire du venv dans ExecStart : systemd
# échoue en 203/EXEC à exécuter directement venv/bin/python sur ce serveur.

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

DATA_DIR="/var/www/html/trading_journal/backend/var"
mkdir -p "$MPLCONFIGDIR" "$DATA_DIR"

# Un tick qui déborde sur le suivant enfilerait deux fois les mêmes cibles.
LOCK_FILE="${DATA_DIR}/historical-sync-tick.lock"
if command -v flock >/dev/null 2>&1; then
  exec flock -n "$LOCK_FILE" python manage.py run_historical_sync_tick
fi

exec python manage.py run_historical_sync_tick
