#!/bin/bash
# Script de démarrage Daphne pour Trading Journal
# Utilisé par le service systemd trading-journal-daphne

cd /var/www/html/trading_journal/backend
source venv/bin/activate
export DJANGO_ENV=production
export MPLCONFIGDIR="${MPLCONFIGDIR:-/var/www/html/trading_journal/backend/var/mplconfig}"
mkdir -p "$MPLCONFIGDIR"
exec daphne -b 127.0.0.1 -p 8001 trading_journal_api.asgi:application

