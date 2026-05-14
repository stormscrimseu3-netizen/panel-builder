#!/usr/bin/env bash
# Nebula Panel installer.
# Usage: curl -fsSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh | sudo bash
#
# Installs ONE of two roles on a Linux box (Debian/Ubuntu):
#   1) Panel  — the web UI itself (nginx + TLS + Node service)
#   2) Wings  — the daemon that runs bot containers via Docker
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
say()  { echo -e "${GREEN}[nebula]${NC} $*"; }
ask()  { echo -ne "${CYAN}[nebula]${NC} $* "; }
warn() { echo -e "${YELLOW}[nebula]${NC} $*"; }
die()  { echo -e "${RED}[nebula]${NC} $*"; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."

echo
echo "============================================"
echo "       RUN REAL NGINX"
echo "       Nebula Panel installer"
echo "============================================"
echo "If nothing appears or the prompts skip, run instead:"
echo "  bash <(curl -fsSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh)"
echo "or:"
echo "  curl -fsSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh -o install.sh && sudo bash install.sh"
echo

# CRITICAL: when invoked via `curl | bash`, stdin is the pipe — reads would EOF
# and silently take defaults. Force every prompt to read from the real terminal.
if [[ ! -t 0 ]]; then
  if [[ -e /dev/tty ]]; then
    exec </dev/tty
  else
    die "No terminal available for prompts. Download install.sh and run it directly:
   curl -O https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh
   sudo bash install.sh"
  fi
fi

# Detect sandboxed environments (Codespaces / Codesandbox / Gitpod / Firebase
# Studio / generic Docker). They usually lack systemd, public DNS, and inbound
# port 80, so we run the panel directly on a forwarded app port instead.
SANDBOX=0
SANDBOX_NAME="VPS"
if [[ -n "${CODESPACES:-}" ]] || grep -qi 'codespaces' /etc/hostname 2>/dev/null || [[ -d /workspaces ]]; then
  SANDBOX=1; SANDBOX_NAME="GitHub Codespaces"
elif [[ -n "${CODESANDBOX_SSE:-}" ]] || [[ -n "${CSB:-}" ]] || grep -qi 'codesandbox' /etc/hostname 2>/dev/null || [[ -d /.codesandbox ]]; then
  SANDBOX=1; SANDBOX_NAME="CodeSandbox"
elif [[ -n "${MONOSPACE_ENV:-}" ]] || [[ -n "${IDX_WORKSPACE_ID:-}" ]] || [[ -n "${FIREBASE_WORKSPACE:-}" ]]; then
  SANDBOX=1; SANDBOX_NAME="Firebase Studio"
elif [[ -n "${GITPOD_WORKSPACE_ID:-}" ]] || grep -qi 'gitpod' /etc/hostname 2>/dev/null; then
  SANDBOX=1; SANDBOX_NAME="Gitpod"
elif [[ -f /.dockerenv ]] || ! pidof systemd >/dev/null 2>&1; then
  SANDBOX=1; SANDBOX_NAME="container/no-systemd environment"
fi

if [[ "$SANDBOX" == "1" ]]; then
  warn "$SANDBOX_NAME detected — will skip nginx, systemd, ufw, and TLS."
  warn "Panel will bind to 0.0.0.0:3535 so your workspace can forward it."
fi

REPO_GIT="https://github.com/stormscrimseu3-netizen/panel-builder.git"

echo "  1) Install PANEL  (web UI on this server, nginx + TLS)"
echo "  2) Install WINGS  (daemon — runs bots in Docker)"
echo
ROLE=""
while [[ "$ROLE" != "1" && "$ROLE" != "2" ]]; do
  ask "Choice (1 or 2):"; read -r ROLE || ROLE=""
  [[ "$ROLE" =~ ^[12]$ ]] || warn "Please type 1 or 2."
done

# ---------- helpers ----------
apt_install() {
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y >/dev/null
  apt-get install -y "$@"
}

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -ge 20 ]]; then
    say "Node $(node -v) already installed."; return
  fi
  say "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt_install nodejs
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then say "Docker already installed."; return; fi
  [[ "$SANDBOX" == "1" ]] && die "Docker is not installed and cannot be safely installed inside this sandbox. Use a VPS for Wings, or enable Docker in your workspace first."
  say "Installing Docker..."
  curl -fsSL https://get.docker.com | sh >/dev/null
  systemctl enable --now docker
}

public_ip() {
  curl -fsSL https://api.ipify.org 2>/dev/null || curl -fsSL https://ifconfig.me 2>/dev/null || echo "unknown"
}

listen_host() {
  [[ "$SANDBOX" == "1" ]] && echo "0.0.0.0" || echo "127.0.0.1"
}

start_panel_process() {
  local host="$(listen_host)"
  pkill -f '/opt/nebula-panel/.output/server/index.mjs' 2>/dev/null || true
  set -a; . /opt/nebula-panel/.env; set +a
  HOST="$host" nohup /usr/bin/node /opt/nebula-panel/.output/server/index.mjs >/var/log/nebula-panel.log 2>&1 &
  echo $! >/var/run/nebula-panel.pid
  sleep 3
  if ! curl -fsS "http://127.0.0.1:${PORT:-3535}" >/dev/null 2>&1; then
    warn "Panel did not answer yet. Last log lines:"
    tail -n 40 /var/log/nebula-panel.log 2>/dev/null || true
    die "Panel failed to start on port ${PORT:-3535}."
  fi
}

dns_ip_for_domain() {
  getent ahostsv4 "$1" 2>/dev/null | awk '{print $1; exit}' || true
}

prompt() {
  # prompt VAR "Question" "default"
  local __var="$1" __q="$2" __def="${3:-}"
  local __ans=""
  if [[ -n "$__def" ]]; then
    ask "$__q [$__def]:"
  else
    ask "$__q:"
  fi
  read -r __ans || __ans=""
  [[ -z "$__ans" && -n "$__def" ]] && __ans="$__def"
  printf -v "$__var" '%s' "$__ans"
}

prompt_required() {
  local __var="$1" __q="$2" __ans=""
  while [[ -z "${__ans:-}" ]]; do
    ask "$__q:"
    read -r __ans || __ans=""
    [[ -z "$__ans" ]] && warn "This field is required."
  done
  printf -v "$__var" '%s' "$__ans"
}

# ============================================================
# PANEL
# ============================================================
install_panel() {
  say "=== Installing Nebula Panel ==="
  if [[ "$SANDBOX" == "1" ]]; then
    apt_install curl git ca-certificates || warn "apt failed (sandbox FS) — continuing."
  else
    apt_install curl git ca-certificates ufw nginx certbot python3-certbot-nginx
  fi
  install_node

  echo
  if [[ "$SANDBOX" == "1" ]]; then
    DOMAIN="localhost"
    say "Sandbox mode: no DNS/domain is needed. Open forwarded port 3535 after install."
  else
    prompt_required DOMAIN "Public domain for the panel (e.g. panel.example.com)"
  fi
  prompt PANEL_NAME "Panel display name" "NebulaPanel"
  if [[ "$SANDBOX" == "1" ]]; then
    CF="N"
  else
    prompt CF "Use Cloudflare proxy in front of this server? (y/N)" "N"
  fi

  # Defaults point at the hosted Lovable Cloud project that ships with the panel.
  # Press ENTER to accept — only override if you've forked the panel onto your
  # own Lovable Cloud / Supabase project.
  DEFAULT_SUPA_URL="https://pxwvtdufrjqhqkwbdsms.supabase.co"
  DEFAULT_SUPA_PUB="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4d3Z0ZHVmcmpxaHFrd2Jkc21zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0MTA2OTUsImV4cCI6MjA5Mzk4NjY5NX0.9ZFrD1Pc2Fbg_mpyev0c9uxESIKZIF7rzh6j6493cGk"
  DEFAULT_SUPA_PID="pxwvtdufrjqhqkwbdsms"

  echo
  say "Backend (Lovable Cloud) — press ENTER on each to use the bundled defaults."
  say "Only change these if you've connected your own Lovable Cloud project."
  prompt SUPA_URL "SUPABASE_URL" "$DEFAULT_SUPA_URL"
  prompt SUPA_PUB "SUPABASE_PUBLISHABLE_KEY" "$DEFAULT_SUPA_PUB"
  prompt SUPA_PID "SUPABASE_PROJECT_ID" "$DEFAULT_SUPA_PID"
  SUPA_SR=""
  if [[ "$SUPA_URL" != "$DEFAULT_SUPA_URL" ]]; then
    ask "SUPABASE_SERVICE_ROLE_KEY (server-only, hidden — leave blank to skip):"
    read -rs SUPA_SR; echo
  fi

  say "Cloning panel source..."
  rm -rf /opt/nebula-panel
  git clone --depth 1 "$REPO_GIT" /opt/nebula-panel
  cd /opt/nebula-panel

  PANEL_HOST="$(listen_host)"
  cat > .env <<EOF
VITE_SUPABASE_URL=$SUPA_URL
VITE_SUPABASE_PUBLISHABLE_KEY=$SUPA_PUB
VITE_SUPABASE_PROJECT_ID=$SUPA_PID
SUPABASE_URL=$SUPA_URL
SUPABASE_PUBLISHABLE_KEY=$SUPA_PUB
SUPABASE_SERVICE_ROLE_KEY=$SUPA_SR
SUPABASE_PROJECT_ID=$SUPA_PID
VITE_PANEL_NAME=$PANEL_NAME
PORT=3535
HOST=$PANEL_HOST
EOF
  chmod 600 .env

  say "Installing dependencies (this takes a minute)..."
  npm install --silent
  say "Building panel..."
  npm run build

  if [[ "$SANDBOX" == "1" ]]; then
    say "Sandbox mode — starting panel directly on 0.0.0.0:3535 (no nginx/systemd)..."
    start_panel_process
  else
    say "Creating systemd service..."
    cat >/etc/systemd/system/nebula-panel.service <<UNIT
[Unit]
Description=Nebula Panel
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/nebula-panel
EnvironmentFile=/opt/nebula-panel/.env
ExecStart=/usr/bin/node .output/server/index.mjs
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable --now nebula-panel
    sleep 3
    systemctl is-active --quiet nebula-panel || { journalctl -u nebula-panel -n 60 --no-pager || true; die "Panel service failed to start."; }
  fi

  if [[ "$SANDBOX" == "0" ]]; then
    say "Configuring nginx for $DOMAIN..."
    cat >/etc/nginx/sites-available/nebula-panel <<NGINX
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3535;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }
}
NGINX
    ln -sf /etc/nginx/sites-available/nebula-panel /etc/nginx/sites-enabled/nebula-panel
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
    ufw allow 80/tcp >/dev/null 2>&1 || true
    ufw allow 443/tcp >/dev/null 2>&1 || true
    ufw allow 22/tcp >/dev/null 2>&1 || true
  fi

  IP=$(public_ip)
  echo
  echo "============================================"
  echo "  PANEL INSTALLED"
  echo "============================================"
  echo "  Domain:      $DOMAIN"
  echo "  Server IPv4: $IP"
  echo

  if [[ "$SANDBOX" == "1" ]]; then
    warn "Sandbox detected — skipping DNS pause and TLS."
    say "Panel running on port 3535."
    if [[ -n "${CODESPACE_NAME:-}" && -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]]; then
      say "Codespaces URL: https://${CODESPACE_NAME}-3535.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
    fi
    say "Open/forward port 3535 in Codespaces, CodeSandbox, or Firebase Studio."
    say "Logs: tail -f /var/log/nebula-panel.log"
  else
    echo "  → Point your DNS at this IP:"
    echo "      Type: A   Name: $DOMAIN   Value: $IP"
    if [[ "$CF" =~ ^[Yy]$ ]]; then
      echo "      Proxy (orange cloud): ON in Cloudflare"
      echo "      SSL/TLS mode: Full (strict) recommended"
      warn "Skipping certbot — Cloudflare provides public TLS."
    else
      echo
      warn "Create the A record above at your DNS provider NOW."
      warn "Let's Encrypt will fail if $DOMAIN doesn't already resolve to $IP."
      warn "If you only want HTTP for now, type skip."
      ask "Press ENTER once DNS is created, or type 'skip' to skip TLS:"
      read -r DNS_READY || DNS_READY=""
      if [[ "$DNS_READY" == "skip" ]]; then
        warn "Skipping TLS. Re-run later: certbot --nginx -d $DOMAIN"
      else
        say "Checking DNS for $DOMAIN..."
        for i in $(seq 1 24); do
          RESOLVED=$(dns_ip_for_domain "$DOMAIN")
          if [[ "$RESOLVED" == "$IP" ]]; then
            say "DNS resolves to $IP ✓"; break
          fi
          warn "Waiting for DNS... attempt $i/24 (current: ${RESOLVED:-none}, expected: $IP). Press Ctrl+C to stop, or type skip next run."
          [[ $i -eq 24 ]] && warn "DNS still doesn't match — skipping certbot. Re-run later: certbot --nginx -d $DOMAIN"
          sleep 5
        done
        RESOLVED=$(dns_ip_for_domain "$DOMAIN")
        if [[ "$RESOLVED" == "$IP" ]]; then
          say "Issuing TLS certificate via Let's Encrypt..."
          certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
            warn "certbot failed — re-run after DNS propagates: certbot --nginx -d $DOMAIN"
        fi
      fi
    fi
  fi
  echo
  if [[ "$SANDBOX" == "1" ]]; then
    say "Visit the forwarded port 3535 URL shown by your workspace."
  elif [[ "$CF" =~ ^[Yy]$ ]]; then
    say "Visit:  https://$DOMAIN"
  else
    say "Visit:  http://$DOMAIN now; use https://$DOMAIN after TLS succeeds."
  fi
  echo
}

# ============================================================
# WINGS
# ============================================================
install_wings() {
  say "=== Installing Nebula Wings (node daemon) ==="
  apt_install curl git ca-certificates
  install_docker
  install_node

  say "Cloning daemon..."
  rm -rf /opt/nebula-wings /tmp/nebula-repo
  git clone --depth 1 "$REPO_GIT" /tmp/nebula-repo
  mv /tmp/nebula-repo/wings /opt/nebula-wings
  rm -rf /tmp/nebula-repo
  cd /opt/nebula-wings
  npm install --omit=dev --silent
  ln -sf /opt/nebula-wings/src/cli.js /usr/local/bin/nebula-wings
  chmod +x /usr/local/bin/nebula-wings

  if [[ "$SANDBOX" == "1" ]]; then
    warn "Sandbox mode — skipping systemd unit. Start manually with: nebula-wings"
  else
    cat >/etc/systemd/system/nebula-wings.service <<'UNIT'
[Unit]
Description=Nebula Wings daemon
After=docker.service network-online.target
Requires=docker.service

[Service]
Type=simple
ExecStart=/usr/local/bin/nebula-wings
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
  fi

  # Pre-pull common egg images so first-server start is instant
  say "Pre-pulling common runtime images..."
  for img in node:20-bullseye node:22-bullseye python:3.12-bullseye eclipse-temurin:21-jre oven/bun:1 denoland/deno:alpine; do
    docker pull "$img" >/dev/null 2>&1 && say "  ✓ $img" || warn "  skipped $img"
  done

  IP=$(public_ip)
  echo
  echo "============================================"
  echo "  WINGS INSTALLED"
  echo "============================================"
  echo "  Server IPv4: $IP"
  echo
  echo "  Next steps:"
  echo "   1. In your panel → Nodes → Add node"
  echo "      use this IP as the host: $IP"
  echo "   2. Copy the configure command shown there"
  echo "   3. Run it here, then:"
  if [[ "$SANDBOX" == "1" ]]; then
    echo "        nebula-wings"
  else
    echo "        sudo systemctl enable --now nebula-wings"
  fi
  echo
}

case "$ROLE" in
  1) install_panel ;;
  2) install_wings ;;
esac
