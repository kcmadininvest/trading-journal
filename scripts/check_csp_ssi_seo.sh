#!/usr/bin/env bash
# Matrice H1–H6 — nonce SSI / CSP / Organization JSON-LD (post-deploy Apache).
# Usage:
#   BASE_URL=https://app.example.com ./scripts/check_csp_ssi_seo.sh
#   BASE_URL=http://127.0.0.1/ ./scripts/check_csp_ssi_seo.sh
set -euo pipefail

BASE_URL="${BASE_URL:-}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: BASE_URL=https://host ./scripts/check_csp_ssi_seo.sh" >&2
  exit 2
fi
BASE_URL="${BASE_URL%/}"

fail=0
ok() { echo "OK: $*"; }
bad() { echo "FAIL: $*"; fail=$((fail + 1)); }

check_page() {
  local path="$1"
  local label="$2"
  local hdr body csp meta_nonce script_nonce cache

  hdr=$(curl -sI -L "${BASE_URL}${path}" || true)
  body=$(curl -sL "${BASE_URL}${path}" || true)

  csp=$(echo "$hdr" | tr -d '\r' | grep -i '^content-security-policy:' | head -1 || true)
  if echo "$csp" | grep -qi "nonce-"; then
    ok "H1 ${label}: CSP contient nonce-"
  else
    bad "H1 ${label}: CSP sans nonce- (${csp:-absent})"
  fi
  if echo "$csp" | grep -qi "script-src[^;]*'unsafe-inline'"; then
    bad "H1 ${label}: script-src contient encore unsafe-inline"
  else
    ok "H1 ${label}: pas de unsafe-inline dans script-src (ou CSP absent déjà signalé)"
  fi

  meta_nonce=$(echo "$body" | grep -oP 'name=["'\'']csp-nonce["'\'']\s+content=["'\'']\K[^"'\'']+' | head -1 || true)
  if [[ -z "$meta_nonce" ]]; then
    meta_nonce=$(echo "$body" | grep -oP 'content=["'\'']\K[^"'\'']+(?=["'\'']\s+name=["'\'']csp-nonce)' | head -1 || true)
  fi
  if [[ -z "$meta_nonce" || "$meta_nonce" == "DEV_ONLY" || "$meta_nonce" == *'<!--#'* ]]; then
    bad "H2 ${label}: meta csp-nonce invalide (${meta_nonce:-vide})"
  else
    ok "H2 ${label}: meta csp-nonce=${meta_nonce}"
  fi

  csp_nonce=$(echo "$csp" | grep -oP "nonce-\K[^'\;\s]+" | head -1 || true)
  script_nonce=$(echo "$body" | grep -oP 'id=["'\'']organization-schema["'\''][^>]*nonce=["'\'']\K[^"'\'']+' | head -1 || true)
  if [[ -z "$script_nonce" ]]; then
    script_nonce=$(echo "$body" | grep -oP 'nonce=["'\'']\K[^"'\'']+(?=["'\''][^>]*id=["'\'']organization-schema)' | head -1 || true)
  fi

  if [[ -n "$meta_nonce" && -n "$csp_nonce" && -n "$script_nonce" && "$meta_nonce" == "$csp_nonce" && "$meta_nonce" == "$script_nonce" ]]; then
    ok "H3 ${label}: meta == CSP == script nonce"
  else
    bad "H3 ${label}: mismatch meta=${meta_nonce:-?} csp=${csp_nonce:-?} script=${script_nonce:-?}"
  fi

  if echo "$body" | grep -q 'id="organization-schema"\|id='\''organization-schema'\''; then
    json=$(echo "$body" | tr '\n' ' ' | grep -oP 'id=["'\'']organization-schema["'\''][^>]*>\K[^<]+' | head -1 || true)
    if echo "$json" | grep -q 'Organization'; then
      ok "H4 ${label}: Organization JSON-LD présent"
    else
      bad "H4 ${label}: script présent mais JSON suspect"
    fi
  else
    bad "H4 ${label}: pas de #organization-schema"
  fi

  cache=$(echo "$hdr" | tr -d '\r' | grep -i '^cache-control:' | head -1 || true)
  if echo "$cache" | grep -qiE 'no-store|no-cache'; then
    ok "H5 ${label}: Cache-Control HTML ok (${cache})"
  else
    bad "H5 ${label}: Cache-Control manquant/no-store (${cache:-absent})"
  fi
}

echo "=== CSP SSI SEO check against ${BASE_URL} ==="
check_page "/" "home"
check_page "/a-propos/" "about-fr"
# H6 = smoke navigateur manuel (hydrate React) — rappel
echo "H6: vérifier manuellement en console (0 violation script-src ; #organization-schema après hydrate)"

if [[ "$fail" -gt 0 ]]; then
  echo "FAILED: ${fail} check(s)" >&2
  exit 1
fi
echo "ALL CHECKS PASSED (H1–H5)"
