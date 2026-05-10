#!/usr/bin/env bash
# Nebula Panel installer.
# Usage: curl -sSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh | sudo bash
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

REPO_GIT="https://github.com/stormscrimseu3-netizen/panel-builder.git"

echo
echo "============================================"
echo "       Nebula Panel installer"
echo "============================================"
echo "  1) Install PANEL  (web UI on this server, nginx + TLS)"
echo "  2) Install WINGS  (daemon — runs bots in Docker)"
echo
ask "Choice [1]:"; read -r ROLE; ROLE=${ROLE:-1}

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
  say "Installing Docker..."
  curl -fsSL https://get.docker.com | sh >/dev/null
  systemctl enable --now docker
}

public_ip() {
  curl -fsSL https://api.ipify.org 2>/dev/null || curl -fsSL https://ifconfig.me 2>/dev/null || echo "unknown"
}

# ============================================================
# PANEL
# ============================================================
install_panel() {
  say "=== Installing Nebula Panel ==="
  apt_install curl git ca-certificates ufw nginx certbot python3-certbot-nginx
  install_node

  echo
  ask "Public domain for the panel (e.g. panel.example.com):"; read -r DOMAIN
  [[ -n "$DOMAIN" ]] || die "Domain required."
  ask "Panel display name [NebulaPanel]:"; read -r PANEL_NAME; PANEL_NAME=${PANEL_NAME:-NebulaPanel}
  ask "Use Cloudflare proxy in front of this server? (y/N):"; read -r CF; CF=${CF:-N}

  echo
  say "You will need a Lovable Cloud (Supabase) project for the database."
  say "Get the values from your Lovable project → Cloud → Settings."
  ask "SUPABASE_URL (https://xxxx.supabase.co):"; read -r SUPA_URL
  ask "SUPABASE_PUBLISHABLE_KEY:"; read -r SUPA_PUB
  ask "SUPABASE_SERVICE_ROLE_KEY (server-only, kept on this box):"; read -rs SUPA_SR; echo
  ask "SUPABASE_PROJECT_ID:"; read -r SUPA_PID

  say "Cloning panel source..."
  rm -rf /opt/nebula-panel
  git clone --depth 1 "$REPO_GIT" /opt/nebula-panel
  cd /opt/nebula-panel

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
EOF
  chmod 600 .env

  say "Installing dependencies (this takes a minute)..."
  npm install --silent
  say "Building panel..."
  npm run build

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

  IP=$(public_ip)
  echo
  echo "============================================"
  echo "  PANEL INSTALLED"
  echo "============================================"
  echo "  Domain:      $DOMAIN"
  echo "  Server IPv4: $IP"
  echo
  echo "  → Point your DNS at this IP:"
  echo "      Type: A"
  echo "      Name: $DOMAIN"
  echo "      Value: $IP"
  if [[ "$CF" =~ ^[Yy]$ ]]; then
    echo "      Proxy (orange cloud): ON in Cloudflare"
    echo "      SSL/TLS mode: Full (strict) recommended"
  fi
  echo
  echo "  After DNS resolves (check: dig $DOMAIN +short)"
  if [[ "$CF" =~ ^[Yy]$ ]]; then
    warn "Skipping certbot — Cloudflare provides the public TLS."
    warn "On Cloudflare set SSL/TLS → Origin Server → Create cert, install on this box, OR use Flexible mode."
  else
    say "Issuing TLS certificate via Let's Encrypt..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || \
      warn "certbot failed — re-run after DNS propagates: certbot --nginx -d $DOMAIN"
  fi
  echo
  say "Visit:  https://$DOMAIN"
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
  echo "        sudo systemctl enable --now nebula-wings"
  echo
}

case "$ROLE" in
  1) install_panel ;;
  2) install_wings ;;
  *) die "Invalid choice." ;;
esac
