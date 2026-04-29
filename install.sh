#!/usr/bin/env bash
# LeanLoop 1-click installer.
# - First run: optionally installs Docker; writes .env from .env.example with
#   generated secrets; prompts for domain + admin password; then exits.
# - Second run: builds images, starts the stack, waits for health.
# Intended for fresh Ubuntu/Debian VPS.

set -euo pipefail

log() { printf "\033[1;34m→\033[0m %s\n" "$1"; }
ok()  { printf "\033[1;32m✓\033[0m %s\n" "$1"; }
warn(){ printf "\033[1;33m!\033[0m %s\n" "$1"; }
die() { printf "\033[1;31m✗\033[0m %s\n" "$1" >&2; exit 1; }

# Must run from the repo root (where docker-compose.yml lives).
[ -f docker-compose.yml ] || die "Run ./install.sh from the LeanLoop repo root."
[ -f .env.example ]      || die ".env.example missing — broken checkout?"

# ─── Docker installation (Ubuntu/Debian) ────────────────────────────────────
install_docker() {
  log "Installing Docker Engine + Compose plugin (apt)…"
  sudo apt-get update -y
  sudo apt-get install -y ca-certificates curl gnupg lsb-release
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -y
  sudo apt-get install -y \
    docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER" || true
  ok "Docker installed. You may need to log out/in for the docker group to apply."
}

if ! command -v docker >/dev/null 2>&1; then
  if [ -f /etc/debian_version ] || [ -f /etc/lsb-release ]; then
    if [ -t 0 ]; then
      read -rp "Docker not found. Install it now via apt? [Y/n] " yn
      yn=${yn:-Y}
      [[ "$yn" =~ ^[Yy] ]] && install_docker || die "Aborted."
    else
      install_docker
    fi
  else
    die "Docker not found. Install it: https://docs.docker.com/engine/install/"
  fi
fi

docker compose version >/dev/null 2>&1 || \
  die "Docker Compose v2 not available. Install 'docker-compose-plugin'."
command -v openssl >/dev/null 2>&1 || \
  die "openssl is required to generate secrets."

# ─── Helpers ────────────────────────────────────────────────────────────────
# Portable sed -i.
sedi() {
  if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi
}

# Set/replace a key=value line in .env. Handles slashes, ampersands, pipes.
set_env() {
  local key="$1" val="$2"
  local esc
  esc=$(printf '%s' "$val" | sed 's/[\\&|]/\\&/g')
  if grep -q "^${key}=" .env; then
    sedi "s|^${key}=.*|${key}=${esc}|" .env
  else
    printf '%s=%s\n' "$key" "$val" >> .env
  fi
}

# Wait for a URL to return 200, up to N tries (sleep 2s each).
wait_http() {
  local url="$1" tries="${2:-60}"
  for i in $(seq 1 "$tries"); do
    if curl -fsS -o /dev/null -m 4 "$url"; then return 0; fi
    sleep 2
  done
  return 1
}

# ─── First run: bootstrap .env ──────────────────────────────────────────────
if [ ! -f .env ]; then
  log "Bootstrapping .env from .env.example"
  cp .env.example .env

  log "Generating secrets"
  set_env N8N_ENCRYPTION_KEY      "$(openssl rand -hex 32)"
  set_env DB_POSTGRESDB_PASSWORD  "$(openssl rand -hex 16)"
  set_env N8N_BASIC_AUTH_PASSWORD "$(openssl rand -hex 12)"
  set_env LEANLOOP_ADMIN_PASSWORD "$(openssl rand -hex 12)"
  # Webhook verify token Meta will echo back to us.
  set_env WHATSAPP_VERIFY_TOKEN   "$(openssl rand -hex 16)"

  if [ -t 0 ] && [ -z "${LEANLOOP_NONINTERACTIVE:-}" ]; then
    read -rp "Domain (e.g. leanloop-demo.me; blank = localhost): " dom
    if [ -n "$dom" ]; then
      set_env DOMAIN   "$dom"
      set_env PROTOCOL "https"
      read -rp "Email for Let's Encrypt: " email
      [ -n "$email" ] && set_env ACME_EMAIL "$email"
    fi
  fi

  ok "Wrote .env"
  warn "Optional: edit .env to add WhatsApp / Google creds, then re-run ./install.sh"
  log  "If you skip those, the stack still boots — you can add creds later via the dashboard."
  echo
  read -rp "Run the build + start now? [Y/n] " go
  go=${go:-Y}
  [[ "$go" =~ ^[Yy] ]] || { log "Re-run ./install.sh when ready."; exit 0; }
fi

# ─── Build + start ──────────────────────────────────────────────────────────
log "Building images (slow on first run — n8n custom nodes compile in this stage)"
docker compose build

log "Starting stack"
docker compose up -d

# Probe through Caddy on 127.0.0.1 (always works, no DNS dependency).
log "Waiting for dashboard via reverse proxy"
if wait_http "http://127.0.0.1/" 90; then
  ok "Dashboard responded"
else
  warn "Dashboard didn't respond in ~3min — check: docker compose logs dashboard"
fi

log "Waiting for n8n via reverse proxy"
if wait_http "http://127.0.0.1/n8n/" 90; then
  ok "n8n responded"
else
  warn "n8n didn't respond in ~3min — check: docker compose logs n8n"
fi

# ─── Post-deploy summary ────────────────────────────────────────────────────
ADMIN_PW=$(grep '^LEANLOOP_ADMIN_PASSWORD=' .env | cut -d= -f2-)
N8N_PW=$(grep   '^N8N_BASIC_AUTH_PASSWORD=' .env | cut -d= -f2-)
VERIFY=$(grep   '^WHATSAPP_VERIFY_TOKEN='   .env | cut -d= -f2-)
DOMAIN=$(grep   '^DOMAIN='                  .env | cut -d= -f2-)
PROTOCOL=$(grep '^PROTOCOL='                .env | cut -d= -f2-)

cat <<EOF

$(ok "LeanLoop is up")

  Dashboard:               ${PROTOCOL}://${DOMAIN}/
  n8n UI:                  ${PROTOCOL}://${DOMAIN}/n8n/
  WhatsApp webhook URL:    ${PROTOCOL}://${DOMAIN}/api/webhooks/whatsapp
  WhatsApp verify token:   ${VERIFY}

  Dashboard admin password: ${ADMIN_PW}
  n8n basic-auth password:  ${N8N_PW}

Next steps:
  1. Open the n8n UI, log in (admin / above password), Settings → API → create
     a personal API key. Paste it into .env as N8N_API_KEY.
  2. (For WhatsApp template) In Meta Developer dashboard, configure the webhook
     URL above with the verify token shown.
  3. Restart the dashboard so it picks up the new API key:
        docker compose up -d dashboard
  4. Open the dashboard, Templates → set up your first automation.
EOF
