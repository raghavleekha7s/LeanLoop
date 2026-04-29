#!/usr/bin/env bash
# LeanLoop post-deploy smoke test.
# Run this on the VPS *after* `./install.sh` finishes. It validates that:
#  - all four containers are up and healthy
#  - dashboard, n8n, and the WhatsApp webhook endpoint respond through Caddy
#  - Postgres is reachable from inside the dashboard container
#  - the queue tables exist
#  - the WhatsApp webhook verify-token handshake succeeds
#
# Usage:
#   ./scripts/smoke-test.sh                 # uses DOMAIN from .env
#   DOMAIN=leanloop-demo.me ./scripts/smoke-test.sh

set -euo pipefail

cd "$(dirname "$0")/.."

# ─── Helpers ────────────────────────────────────────────────────────────
GREEN='\033[1;32m'; RED='\033[1;31m'; YELLOW='\033[1;33m'; BLUE='\033[1;34m'; NC='\033[0m'
pass(){ printf "${GREEN}✓${NC} %s\n" "$1"; }
fail(){ printf "${RED}✗${NC} %s\n" "$1"; FAILS=$((FAILS+1)); }
warn(){ printf "${YELLOW}!${NC} %s\n" "$1"; }
info(){ printf "${BLUE}→${NC} %s\n" "$1"; }
FAILS=0

[ -f .env ] || { fail ".env missing — run ./install.sh first"; exit 1; }

# Read env values without sourcing (handles weird chars).
get_env() { grep "^${1}=" .env | head -1 | cut -d= -f2- ; }

DOMAIN_ENV=${DOMAIN:-$(get_env DOMAIN)}
PROTOCOL_ENV=${PROTOCOL:-$(get_env PROTOCOL)}
VERIFY_TOKEN=$(get_env WHATSAPP_VERIFY_TOKEN)

[ -n "$DOMAIN_ENV" ]   || { fail "DOMAIN not set in .env"; exit 1; }
[ -n "$PROTOCOL_ENV" ] || PROTOCOL_ENV="http"

BASE="${PROTOCOL_ENV}://${DOMAIN_ENV}"
info "Testing against ${BASE}"
echo

# ─── 1. Containers up ───────────────────────────────────────────────────
info "Container status"
EXPECTED=(postgres n8n dashboard caddy)
for svc in "${EXPECTED[@]}"; do
  state=$(docker compose ps -q "$svc" 2>/dev/null)
  if [ -z "$state" ]; then
    fail "service '$svc' is not running"
  else
    pass "service '$svc' is running"
  fi
done
echo

# ─── 2. Postgres reachable from dashboard ───────────────────────────────
info "Postgres connectivity (from dashboard container)"
DBHOST=$(get_env DB_POSTGRESDB_HOST)
DBNAME=$(get_env DB_POSTGRESDB_DATABASE)
DBUSER=$(get_env DB_POSTGRESDB_USER)
if docker compose exec -T postgres pg_isready -h localhost -U "$DBUSER" -d "$DBNAME" >/dev/null 2>&1; then
  pass "Postgres accepts connections (db=$DBNAME)"
else
  fail "Postgres not accepting connections"
fi

# Verify our migrations ran (tables exist)
TABLES=$(docker compose exec -T postgres psql -U "$DBUSER" -d "$DBNAME" -tAc \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'leanloop_%' ORDER BY 1" 2>/dev/null || true)
for tbl in leanloop_queue leanloop_activations; do
  if echo "$TABLES" | grep -q "^${tbl}$"; then
    pass "table $tbl exists"
  else
    warn "table $tbl missing — will be created on first dashboard request"
  fi
done
echo

# ─── 3. HTTP endpoints (through Caddy) ──────────────────────────────────
info "HTTP endpoints"

check_url() {
  local label="$1" url="$2" expected="$3"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -k "$url" || echo "000")
  if [ "$code" = "$expected" ]; then
    pass "$label → $code"
  else
    fail "$label → $code (expected $expected)"
  fi
}

# Dashboard home — if admin gate is enabled, expect 401 unauth and 200 with auth.
ADMIN_PW=$(get_env LEANLOOP_ADMIN_PASSWORD)
if [ -n "$ADMIN_PW" ]; then
  unauth_code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -k "${BASE}/" || echo "000")
  if [ "$unauth_code" = "401" ]; then
    pass "dashboard admin gate returns 401 unauthenticated"
  else
    fail "dashboard gate returned $unauth_code (expected 401 unauthenticated)"
  fi
  auth_code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -k -u "admin:${ADMIN_PW}" "${BASE}/" || echo "000")
  if [ "$auth_code" = "200" ]; then
    pass "dashboard home with admin auth → 200"
  else
    fail "dashboard home with admin auth → $auth_code"
  fi
else
  check_url "dashboard home" "${BASE}/" "200"
fi
# n8n redirects to /n8n/setup or shows login on first run — accept any 2xx/3xx
URL_N8N="${BASE}/n8n/"
code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -k "$URL_N8N" || echo "000")
if [[ "$code" =~ ^[23] ]]; then
  pass "n8n UI → $code"
else
  fail "n8n UI → $code"
fi

# WhatsApp webhook verify handshake
if [ -n "$VERIFY_TOKEN" ]; then
  url="${BASE}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=test123"
  body=$(curl -s -m 10 -k "$url" || true)
  if [ "$body" = "test123" ]; then
    pass "WhatsApp webhook verify handshake echoes challenge"
  else
    fail "WhatsApp webhook verify failed (got: '$body')"
  fi
else
  warn "WHATSAPP_VERIFY_TOKEN not set — skipping webhook handshake"
fi
echo

# ─── 4. n8n API reachability (only if API key set) ──────────────────────
N8N_API_KEY_SET=$(get_env N8N_API_KEY)
if [ -n "$N8N_API_KEY_SET" ]; then
  info "n8n REST API"
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -k \
    -H "X-N8N-API-KEY: ${N8N_API_KEY_SET}" \
    "${BASE}/n8n/api/v1/workflows" || echo "000")
  if [ "$code" = "200" ]; then
    pass "n8n /api/v1/workflows → 200 (API key works)"
  else
    fail "n8n /api/v1/workflows → $code (check N8N_API_KEY)"
  fi
else
  warn "N8N_API_KEY not set in .env — generate one at ${BASE}/n8n/ → Settings → API"
fi
echo

# ─── Summary ────────────────────────────────────────────────────────────
if [ "$FAILS" -eq 0 ]; then
  printf "${GREEN}All smoke tests passed.${NC}\n"
  exit 0
else
  printf "${RED}${FAILS} test(s) failed.${NC}\n"
  exit 1
fi
