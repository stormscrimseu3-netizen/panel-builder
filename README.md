# Nebula Panel

Self-hostable bot hosting panel — like Pterodactyl/Featherpanel but focused on
Discord bots and small workloads. Two pieces:

- **Panel** (this repo) — web UI for users to create servers, edit files, view
  console, and manage their nodes. Deploys to any modern JS host.
- **Wings** ([`./wings`](./wings)) — Node.js daemon that runs on your Linux box
  with Docker. The panel talks to it over HTTPS + WebSocket.

## Quick start

### 1. Use the panel

Sign up on your hosted panel, create an account, then go to **Nodes → Add node**
to register a Linux server.

### 2. Install the daemon on your server

```bash
curl -fsSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh | sudo bash
```

Pick **Node daemon**, then paste the `nebula-wings configure ...` command shown
in the panel.

### 3. Create a server

In **Servers → New server**, pick an egg, fill its required variables, set
memory + CPU caps, and upload your bot files. The daemon spins up an isolated
Docker container using the egg image and startup command.

## Architecture

```
 Browser  ──►  Panel (this repo)  ──►  Wings daemon  ──►  Docker container (your bot)
                     ▲                       │
                     └─── heartbeat ─────────┘
```

## Repo layout

| Path | What |
| --- | --- |
| `src/` | Panel web app (TanStack Start + Supabase) |
| `wings/` | Node daemon — install on your VPS |
| `install.sh` | One-line installer for the daemon |
| `supabase/` | DB migrations |

## Configuration

The panel reads its backend URL/keys from environment. **No personal API keys,
tokens, or server addresses are committed** — see `.env.example`. Each user's
node tokens are generated server-side and only displayed once in their panel.

## License

MIT — see [LICENSE](./LICENSE).
