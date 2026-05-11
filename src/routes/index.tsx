import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, Bot, Terminal, Files, Shield, Cpu, Zap } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between px-6 py-5">
        <Brand />
        <nav className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link to="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <main>
        <section className="container mx-auto px-6 pt-16 pb-24 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
            Open-source bot hosting panel
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            Host your bots like the pros, on your own{" "}
            <span className="text-gradient">infrastructure</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Spin up Discord bots, manage files, watch live console output, and control resources —
            all from a single beautiful panel.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="gap-2">
                Open the panel <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              <Button variant="outline" size="lg">
                View on GitHub
              </Button>
            </a>
          </div>
        </section>

        <section className="container mx-auto grid gap-4 px-6 pb-24 md:grid-cols-3">
          {[
            {
              icon: Bot,
              title: "Bot servers",
              desc: "Create, start, stop, and delete instances in one click.",
            },
            {
              icon: Terminal,
              title: "Live console",
              desc: "Tail logs and send commands like SSH — right in the browser.",
            },
            {
              icon: Files,
              title: "File manager",
              desc: "Edit code, configs, and assets without leaving the panel.",
            },
            {
              icon: Cpu,
              title: "Resource limits",
              desc: "Cap memory, CPU, and disk per server to stay in budget.",
            },
            {
              icon: Shield,
              title: "Per-user isolation",
              desc: "Row-level security keeps every user's data private by default.",
            },
            {
              icon: Zap,
              title: "Built for daemons",
              desc: "Pairs with a wings daemon over WebSocket for real Docker control.",
            },
          ].map((f) => (
            <div key={f.title} className="card-elevated rounded-xl p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="container mx-auto px-6 pb-32">
          <div className="card-elevated rounded-2xl p-8 md:p-12">
            <p className="text-sm uppercase tracking-widest text-muted-foreground">
              One-line install
            </p>
            <pre className="mono mt-4 overflow-x-auto rounded-lg bg-background/60 p-4 text-sm">
              <span className="text-success">$</span> curl -fsSL
              https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh
              | sudo bash
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">
              Works on a real Debian or Ubuntu VPS. The installer shows RUN REAL NGINX, asks you to
              choose 1 or 2, then prints the IPv4 address for DNS.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="container mx-auto flex flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground md:flex-row">
          <span>© {new Date().getFullYear()} NebulaPanel · MIT License</span>
          <span>Built with TanStack Start</span>
        </div>
      </footer>
    </div>
  );
}
