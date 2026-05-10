#!/usr/bin/env bash
# Nebula Panel installer.
# Usage: curl -sSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh | sudo bash
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
say() { echo -e "${GREEN}[nebula]${NC} $*"; }
warn() { echo -e "${YELLOW}[nebula]${NC} $*"; }
die() { echo -e "${RED}[nebula]${NC} $*"; exit 1; }

[[ $EUID -eq 0 ]] || die "Run with sudo."

REPO_RAW="https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main"
REPO_GIT="https://github.com/stormscrimseu3-netizen/panel-builder.git"

# --- choose role ---
echo
echo "What do you want to install?"
echo "  1) Node daemon (run bots here, talks to a remote panel)"
echo "  2) Panel (web UI — only if self-hosting; most users use the hosted panel)"
echo
read -rp "Choice [1]: " ROLE
ROLE=${ROLE:-1}

install_docker() {
  if command -v docker >/dev/null 2>&1; then say "Docker already installed."; return; fi
  say "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
}

install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -v | cut -dv -f2 | cut -d. -f1)" -ge 20 ]]; then
    say "Node $(node -v) already installed."; return
  fi
  say "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
}

case "$ROLE" in
  1)
    say "=== Installing Nebula Wings (node daemon) ==="
    apt-get update -y
    apt-get install -y curl git ca-certificates
    install_docker
    install_node

    say "Cloning daemon..."
    rm -rf /opt/nebula-wings
    git clone --depth 1 "$REPO_GIT" /tmp/nebula-repo
    mv /tmp/nebula-repo/wings /opt/nebula-wings
    rm -rf /tmp/nebula-repo
    cd /opt/nebula-wings
    npm install --omit=dev
    ln -sf /opt/nebula-wings/src/cli.js /usr/local/bin/nebula-wings
    chmod +x /usr/local/bin/nebula-wings

    say "Installing systemd unit..."
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

    echo
    say "Done. Next step:"
    echo
    echo "  1. In your panel, open  Nodes → Add node  and copy the configure command."
    echo "  2. Run it on this server, then:"
    echo "       sudo systemctl enable --now nebula-wings"
    echo
    ;;
  2)
    warn "The panel is a web app deployed to Lovable / Vercel / Cloudflare Pages."
    warn "There is no apt-installable panel build. See the project README for hosted/self-host options."
    exit 0
    ;;
  *) die "Invalid choice." ;;
esac
