import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Server as ServerIcon, Activity, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/server-status";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const { data: servers = [] } = useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("servers").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const online = servers.filter((s) => s.status === "online").length;
  const totalMem = servers.reduce((a, s) => a + s.memory_mb, 0);

  return (
    <div className="p-6 md:p-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight">{user?.user_metadata?.display_name || user?.email}</h1>
        </div>
        <Link to="/servers/new"><Button className="gap-2"><Plus className="h-4 w-4" />New server</Button></Link>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatCard icon={ServerIcon} label="Total servers" value={servers.length} />
        <StatCard icon={Activity} label="Online" value={online} accent />
        <StatCard icon={HardDrive} label="Memory allocated" value={`${totalMem} MB`} />
      </div>

      <div className="card-elevated rounded-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">Your servers</h2>
          <Link to="/servers" className="text-sm text-muted-foreground hover:text-foreground">View all →</Link>
        </div>
        {servers.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ServerIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium">No servers yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first bot server to get started.</p>
            <Link to="/servers/new"><Button className="mt-4 gap-2"><Plus className="h-4 w-4" />Create server</Button></Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {servers.slice(0, 5).map((s) => (
              <li key={s.id}>
                <Link
                  to="/servers/$serverId"
                  params={{ serverId: s.id }}
                  className="flex items-center justify-between px-5 py-4 hover:bg-accent/40"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground mono">{s.runtime} · {s.memory_mb} MB</p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = false }: { icon: typeof ServerIcon; label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="card-elevated rounded-xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${accent ? "text-success" : "text-muted-foreground"}`} />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
