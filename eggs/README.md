# Nebula Eggs

Pterodactyl-style **eggs** — runtime templates that tell Wings how to install
and start a server. Each egg is a JSON file describing:

- the Docker image to use
- environment variables the user can fill in (token, main file, etc.)
- the install script (run once when the server is created)
- the startup command

Pick one when creating a server in the panel. The panel sends the egg + user
variables to Wings, which runs the install script in the container, then boots
it with the startup command.

## Built-in eggs

| File | Runtime | Typical use |
| --- | --- | --- |
| `generic/nodejs.json`   | Node.js 20 | discord.js, eris, oceanic.js bots |
| `generic/nodejs-22.json`| Node.js 22 | latest LTS |
| `generic/bun.json`      | Bun 1.x    | bun-native bots, fast cold starts |
| `generic/deno.json`     | Deno       | TypeScript-first bots |
| `generic/python.json`   | Python 3.12| discord.py, pycord, hikari |
| `generic/java.json`     | JRE 21     | JDA bots, generic JVM apps |
| `games/minecraft-paper.json` | JRE 21 | Paper Minecraft server |

## Egg schema (shortened)

```jsonc
{
  "name": "Node.js 20 Bot",
  "author": "nebula",
  "image": "ghcr.io/nebula/yolks:nodejs_20",
  "startup": "node {{MAIN_FILE}}",
  "stop": "^C",
  "variables": [
    { "name": "Git repository", "env": "GIT_REPO", "default": "", "rules": "nullable|url" },
    { "name": "Main file",      "env": "MAIN_FILE", "default": "index.js", "rules": "required|string" },
    { "name": "Bot token",      "env": "BOT_TOKEN", "default": "", "rules": "required|string", "secret": true }
  ],
  "install": {
    "image": "node:20-bullseye",
    "script": "scripts/nodejs-install.sh"
  }
}
```

## Adding your own egg

Drop a `your-egg.json` file in `eggs/custom/` and (optionally) an install
script in `eggs/custom/scripts/`. Wings auto-loads anything under `eggs/`
on the next restart.
