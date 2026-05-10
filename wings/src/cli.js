#!/usr/bin/env node
// Tiny CLI wrapper used by the systemd unit.
// Reads /etc/nebula-wings/config.json and execs the daemon with the right env.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cmd = process.argv[2];

if (cmd === "configure") {
  const args = process.argv.slice(3);
  const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const cfg = {
    panel: get("--panel"),
    token: get("--token"),
    node_id: get("--node"),
    port: parseInt(get("--port") || "8443", 10),
  };
  if (!cfg.panel || !cfg.token || !cfg.node_id) {
    console.error("usage: nebula-wings configure --panel <url> --token <token> --node <node-id> [--port 8443]");
    process.exit(1);
  }
  const fs = await import("node:fs");
  fs.mkdirSync("/etc/nebula-wings", { recursive: true });
  fs.writeFileSync("/etc/nebula-wings/config.json", JSON.stringify(cfg, null, 2));
  console.log("Saved /etc/nebula-wings/config.json. Now: sudo systemctl enable --now nebula-wings");
  process.exit(0);
}

// default: run daemon
const cfgPath = "/etc/nebula-wings/config.json";
let cfg = {};
try { cfg = JSON.parse(readFileSync(cfgPath, "utf8")); }
catch { console.error(`missing ${cfgPath} — run: nebula-wings configure ...`); process.exit(1); }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(__dirname, "index.js")], {
  stdio: "inherit",
  env: {
    ...process.env,
    PANEL_URL: cfg.panel,
    WINGS_TOKEN: cfg.token,
    NODE_ID: cfg.node_id,
    WINGS_PORT: String(cfg.port || 8443),
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
