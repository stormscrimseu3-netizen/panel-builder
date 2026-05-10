import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/docs")({
  component: DocsPage,
});

function DocsPage() {
  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
      <p className="mt-2 text-sm text-muted-foreground">Quick reference for installing the daemon and connecting nodes.</p>

      <div className="mt-8 space-y-6">
        <section className="card-elevated rounded-2xl p-6">
          <h2 className="font-semibold">1. Install the panel daemon</h2>
          <p className="mt-1 text-sm text-muted-foreground">Run on Debian, Ubuntu, Docker, or Codespaces:</p>
          <pre className="mono mt-3 overflow-x-auto rounded-md bg-background/60 p-3 text-sm">
{`curl -sSL https://get.nebulapanel.dev/install.sh | bash`}
          </pre>
          <p className="mt-2 text-xs text-muted-foreground">The installer prompts: <strong>panel</strong> (with nginx or Cloudflare Tunnel) or <strong>node daemon</strong>.</p>
        </section>

        <section className="card-elevated rounded-2xl p-6">
          <h2 className="font-semibold">2. Configure a node</h2>
          <p className="mt-1 text-sm text-muted-foreground">After choosing "node", paste the auto-generated command shown in your panel:</p>
          <pre className="mono mt-3 overflow-x-auto rounded-md bg-background/60 p-3 text-sm">
{`nebula-wings configure \\
  --panel https://your-panel.example.com \\
  --token <NODE_TOKEN>`}
          </pre>
        </section>

        <section className="card-elevated rounded-2xl p-6">
          <h2 className="font-semibold">3. Create your first server</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            From <em>Servers → New server</em>, pick a runtime (Node, Python, Java, Docker), set memory and CPU limits, and define the start command.
            The wings daemon will pull the matching Docker image and run it under your resource caps.
          </p>
        </section>

        <section className="card-elevated rounded-2xl p-6">
          <h2 className="font-semibold">Architecture</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The panel (this UI) talks to one or more nodes over WebSocket. Each node runs the wings daemon, which spawns Docker containers per server.
            Console output and file changes stream back to the panel in real time.
          </p>
        </section>
      </div>
    </div>
  );
}
