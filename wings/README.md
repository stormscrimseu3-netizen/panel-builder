# Nebula Wings

The node daemon for Nebula Panel. Runs on a Linux host with Docker and exposes
an authenticated API the panel uses to start/stop bots, stream console output,
and manage files.

## Requirements

- Linux (Debian/Ubuntu recommended) or any host that can run Docker
- Docker Engine
- Node.js 20+

## Install (one-liner)

```bash
curl -fsSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh | sudo bash
```

The installer asks whether to set up the **panel** or a **node**. Choose `node`,
then paste the configure command shown in your panel under *Nodes → Add node*:

```bash
sudo nebula-wings configure \
  --panel  https://your-panel.example.com \
  --token  <NODE_TOKEN> \
  --node   <NODE_ID>

sudo systemctl enable --now nebula-wings
```

## Config

`/etc/nebula-wings/config.json` — created by `configure`, edit if you need to
change the port or panel URL.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/servers/:id/start` | create+start container |
| POST | `/servers/:id/stop` | graceful stop |
| POST | `/servers/:id/restart` | restart |
| DELETE | `/servers/:id` | remove container + files |
| GET | `/servers/:id/files?path=` | list files |
| GET/PUT/DELETE | `/servers/:id/file` | read/write/delete one file |
| WS | `/console?server=<id>&token=<token>` | bi-directional console |

All HTTP calls require `Authorization: Bearer <WINGS_TOKEN>`.
