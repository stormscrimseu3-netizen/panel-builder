import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Trash2, CircleDot, Circle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/nodes")({
  component: NodesPage,
});

type Node = {
  id: string;
  name: string;
  fqdn: string;
  port: number;
  token: string;
  online: boolean;
  last_seen_at: string | null;
};

function NodesPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [fqdn, setFqdn] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("nodes")
      .select("id, name, fqdn, port, token, online, last_seen_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setNodes(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("nodes").insert({ user_id: user.id, name, fqdn });
    setCreating(false);
    if (error) return toast.error(error.message);
    setName(""); setFqdn("");
    toast.success("Node created — copy the configure command below");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this node?")) return;
    const { error } = await supabase.from("nodes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const panelUrl = typeof window !== "undefined" ? window.location.origin : "https://your-panel.example.com";

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <h1 className="text-3xl font-bold tracking-tight">Nodes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Linux servers running the Wings daemon. Each node hosts one or more bot containers.
      </p>

      <form onSubmit={create} className="card-elevated mt-8 grid gap-3 rounded-2xl p-6 md:grid-cols-3">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-vps" required />
        </div>
        <div>
          <Label htmlFor="fqdn">Host (FQDN or IP)</Label>
          <Input id="fqdn" value={fqdn} onChange={(e) => setFqdn(e.target.value)} placeholder="bots.example.com" required />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={creating} className="w-full">
            {creating ? "Adding..." : "Add node"}
          </Button>
        </div>
      </form>

      <div className="mt-8 space-y-4">
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loading && nodes.length === 0 && (
          <p className="text-sm text-muted-foreground">No nodes yet. Add one above.</p>
        )}
        {nodes.map((n) => {
          const cmd = `sudo nebula-wings configure \\\n  --panel ${panelUrl} \\\n  --node  ${n.id} \\\n  --token ${n.token}\nsudo systemctl enable --now nebula-wings`;
          return (
            <div key={n.id} className="card-elevated rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {n.online
                      ? <CircleDot className="h-4 w-4 text-emerald-500" />
                      : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <h3 className="truncate font-semibold">{n.name}</h3>
                    <span className="text-xs text-muted-foreground">{n.fqdn}:{n.port}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.online
                      ? `online · last seen ${n.last_seen_at ? new Date(n.last_seen_at).toLocaleString() : "—"}`
                      : "offline — daemon hasn't checked in yet"}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(n.id)} title="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Run on your Linux server</p>
                  <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(cmd); toast.success("Copied"); }}>
                    <Copy className="mr-1 h-3 w-3" /> Copy
                  </Button>
                </div>
                <pre className="mono mt-2 overflow-x-auto rounded-md bg-background/60 p-3 text-xs">{cmd}</pre>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-border/60 p-5 text-sm text-muted-foreground">
        Don't have the daemon installed yet? Run this once on your VPS:
        <pre className="mono mt-2 overflow-x-auto rounded-md bg-background/60 p-3 text-xs">
{`curl -sSL https://raw.githubusercontent.com/stormscrimseu3-netizen/panel-builder/main/install.sh | sudo bash`}
        </pre>
      </div>
    </div>
  );
}
