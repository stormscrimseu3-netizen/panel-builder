import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Server as ServerIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/server-status";

export const Route = createFileRoute("/_authenticated/servers/")({
  component: ServerListPage,
});

function ServerListPage() {
  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Servers</h1>
          <p className="text-sm text-muted-foreground">Manage all your bot instances.</p>
        </div>
        <Link to="/servers/new"><Button className="gap-2"><Plus className="h-4 w-4" />New server</Button></Link>
      </header>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground">Loading…</div>
      ) : servers.length === 0 ? (
        <div className="card-elevated rounded-2xl p-16 text-center">
          <ServerIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 font-medium">No servers yet</p>
          <Link to="/servers/new"><Button className="mt-4 gap-2"><Plus className="h-4 w-4" />Create server</Button></Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (
            <Link
              key={s.id}
              to="/servers/$serverId"
              params={{ serverId: s.id }}
              className="card-elevated rounded-xl p-5 transition hover:border-primary/50"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description || s.egg_name || "No description"}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-xs mono text-muted-foreground">
                <div><dt>EGG</dt><dd className="truncate text-foreground">{s.egg_name}</dd></div>
                <div><dt>MEM</dt><dd className="text-foreground">{s.memory_mb}M</dd></div>
                <div><dt>CPU</dt><dd className="text-foreground">{s.cpu_percent}%</dd></div>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
