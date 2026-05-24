#!/usr/bin/env bash
# Environnement proche prod : Redis + services systemd (Daphne + bandeau cours).
# Usage : ./scripts/setup-redis-prod-local.sh   (en root)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
VENV="$BACKEND/venv"
LOG_DIR="/var/log/trading-journal"
VAR_DIR="$BACKEND/var"

if [ "${EUID:-}" -ne 0 ]; then
  echo "Ce script doit être exécuté en root : sudo $0"
  exit 1
fi

echo "==> Installation Redis"
if ! rpm -q redis >/dev/null 2>&1; then
  dnf install -y redis
fi
systemctl enable redis
systemctl start redis
redis-cli ping

echo "==> Répertoires partagés"
mkdir -p "$LOG_DIR" "$VAR_DIR"
chown apache:apache "$LOG_DIR" "$VAR_DIR"
chmod 755 "$LOG_DIR"
chmod 775 "$VAR_DIR"

echo "==> Services systemd"
MARKET_QUOTES_UNIT="${ROOT}/systemd/trading-journal-market-quotes.service"
DAPHNE_UNIT="${ROOT}/systemd/trading-journal-daphne.service"

if [ -f "$MARKET_QUOTES_UNIT" ]; then
  cp "$MARKET_QUOTES_UNIT" /etc/systemd/system/
else
  echo "Fichier manquant : $MARKET_QUOTES_UNIT"
  exit 1
fi

if [ -f "$DAPHNE_UNIT" ]; then
  cp "$DAPHNE_UNIT" /etc/systemd/system/
fi

systemctl daemon-reload
systemctl enable trading-journal-market-quotes.service
systemctl restart trading-journal-market-quotes.service 2>/dev/null || systemctl start trading-journal-market-quotes.service

if systemctl is-enabled trading-journal-daphne.service >/dev/null 2>&1; then
  systemctl restart trading-journal-daphne.service
fi

echo "==> Vérification"
sleep 2
systemctl --no-pager status redis trading-journal-market-quotes.service | head -20
echo ""
echo "Redis OK. Vérifiez le cache :"
echo "  redis-cli -n 1 KEYS '*market*'"
echo "Logs bandeau : tail -f ${LOG_DIR}/market-quotes.log"
