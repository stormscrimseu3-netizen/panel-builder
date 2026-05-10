// Nebula Wings — node daemon.
// Runs on the user's Linux box (VPS, Railway docker, Codespaces, bare Debian/Ubuntu).
// Exposes an authenticated HTTP + WebSocket API that the panel calls to
// start/stop containers, stream console output, and read/write files.
//
// This file is intentionally dependency-light so it works on any Node 20+
// host with Docker reachable on the local socket.

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { WebSocketServer } from "ws";
import Docker from "dockerode";

const PORT = parseInt(process.env.WINGS_PORT || "8443", 10);
const TOKEN = process.env.WINGS_TOKEN;
const PANEL_URL = process.env.PANEL_URL;
const NODE_ID = process.env.NODE_ID;
const DATA_DIR = process.env.WINGS_DATA || "/var/lib/nebula-wings";

if (!TOKEN || !PANEL_URL || !NODE_ID) {
  console.error("[wings] missing env: WINGS_TOKEN, PANEL_URL, NODE_ID required");
  process.exit(1);
}

const docker = new Docker();
const app = express();
app.use(express.json({ limit: "5mb" }));

// --- auth middleware ---
app.use((req, res, next) => {
  const auth = req.headers.authorization || "";
  if (auth !== `Bearer ${TOKEN}`) return res.status(401).json({ error: "unauthorized" });
  next();
});

const containerName = (serverId) => `nebula-${serverId}`;
const serverDir = (serverId) => path.join(DATA_DIR, serverId);

// --- runtime images ---
const RUNTIME_IMAGES = {
  nodejs: "node:20-alpine",
  python: "python:3.12-alpine",
  java: "eclipse-temurin:21-jre-alpine",
  docker: null, // user supplies own image
};

// --- server lifecycle ---
app.post("/servers/:id/start", async (req, res) => {
  const { id } = req.params;
  const { runtime, startCommand, memoryMb, cpuPercent, image } = req.body;
  try {
    await fs.mkdir(serverDir(id), { recursive: true });
    try { await docker.getContainer(containerName(id)).remove({ force: true }); } catch {}

    const useImage = runtime === "docker" ? image : RUNTIME_IMAGES[runtime];
    if (!useImage) return res.status(400).json({ error: "unknown runtime" });

    const container = await docker.createContainer({
      name: containerName(id),
      Image: useImage,
      Cmd: ["sh", "-c", startCommand],
      WorkingDir: "/home/container",
      Tty: false,
      OpenStdin: true,
      HostConfig: {
        Memory: memoryMb * 1024 * 1024,
        NanoCpus: Math.floor((cpuPercent / 100) * 1e9),
        Binds: [`${serverDir(id)}:/home/container`],
        RestartPolicy: { Name: "unless-stopped" },
      },
    });
    await container.start();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/servers/:id/stop", async (req, res) => {
  try { await docker.getContainer(containerName(req.params.id)).stop({ t: 10 }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.post("/servers/:id/restart", async (req, res) => {
  try { await docker.getContainer(containerName(req.params.id)).restart({ t: 10 }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.delete("/servers/:id", async (req, res) => {
  try {
    try { await docker.getContainer(containerName(req.params.id)).remove({ force: true }); } catch {}
    await fs.rm(serverDir(req.params.id), { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// --- file manager ---
const safeJoin = (id, p) => {
  const base = serverDir(id);
  const full = path.resolve(base, p.replace(/^\/+/, ""));
  if (!full.startsWith(base)) throw new Error("path escape");
  return full;
};

app.get("/servers/:id/files", async (req, res) => {
  try {
    const dir = safeJoin(req.params.id, String(req.query.path || ""));
    const entries = await fs.readdir(dir, { withFileTypes: true });
    res.json(entries.map((e) => ({ name: e.name, dir: e.isDirectory() })));
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.get("/servers/:id/file", async (req, res) => {
  try { res.type("text/plain").send(await fs.readFile(safeJoin(req.params.id, String(req.query.path)), "utf8")); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.put("/servers/:id/file", async (req, res) => {
  try {
    const full = safeJoin(req.params.id, req.body.path);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, req.body.content ?? "");
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

app.delete("/servers/:id/file", async (req, res) => {
  try { await fs.rm(safeJoin(req.params.id, String(req.query.path)), { recursive: true, force: true }); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

// --- websocket: live console stream + stdin ---
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/console" });

wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, "http://x");
  if (url.searchParams.get("token") !== TOKEN) return ws.close(1008, "unauthorized");
  const id = url.searchParams.get("server");
  if (!id) return ws.close(1008, "missing server");

  try {
    const container = docker.getContainer(containerName(id));
    const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
    stream.on("data", (chunk) => { try { ws.send(chunk.toString("utf8")); } catch {} });
    ws.on("message", (msg) => stream.write(msg.toString() + "\n"));
    ws.on("close", () => stream.end());
  } catch (e) {
    ws.send(`[wings] error: ${e.message}\n`);
    ws.close();
  }
});

// --- heartbeat back to panel ---
const heartbeat = async () => {
  try {
    await fetch(`${PANEL_URL}/api/public/nodes/heartbeat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ node_id: NODE_ID, version: "0.1.0" }),
    });
  } catch (e) { console.error("[wings] heartbeat failed:", e.message); }
};
setInterval(heartbeat, 30_000);
heartbeat();

server.listen(PORT, () => {
  console.log(`[wings] listening on :${PORT} — panel=${PANEL_URL} node=${NODE_ID}`);
});
