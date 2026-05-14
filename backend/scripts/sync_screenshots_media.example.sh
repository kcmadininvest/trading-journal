#!/usr/bin/env bash
# Synchronise media/screenshots/ vers MEDIA_ROOT local (exemple pour qualif / dev).
#
# Usage :
#   export SCREENSHOTS_REMOTE="user@host:/path/to/media/screenshots/"
#   export MEDIA_ROOT_LOCAL="/path/to/backend/media"
#   bash backend/scripts/sync_screenshots_media.example.sh
#
# Ou en une ligne :
#   SCREENSHOTS_REMOTE="..." MEDIA_ROOT_LOCAL="..." bash backend/scripts/sync_screenshots_media.example.sh

set -euo pipefail

if [[ -z "${SCREENSHOTS_REMOTE:-}" || -z "${MEDIA_ROOT_LOCAL:-}" ]]; then
  echo "Définissez SCREENSHOTS_REMOTE (source rsync) et MEDIA_ROOT_LOCAL (répertoire media Django, parent de screenshots/)."
  echo "Exemple : SCREENSHOTS_REMOTE=user@host:/data/media/screenshots/ MEDIA_ROOT_LOCAL=/var/www/.../backend/media"
  exit 1
fi

mkdir -p "${MEDIA_ROOT_LOCAL}/screenshots"
rsync -avz --delete "${SCREENSHOTS_REMOTE}" "${MEDIA_ROOT_LOCAL}/screenshots/"
echo "Synchronisation terminée vers ${MEDIA_ROOT_LOCAL}/screenshots/"
