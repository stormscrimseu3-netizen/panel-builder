import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Play, Square, RotateCw, Trash2, Terminal, Files, Settings, Send, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/server-status";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Database } from "@/integrations/supabase/types";

type ServerStatus = Database["public"]["Enums"]["server_status"];
type EggVariables = Record<string, string | number | boolean | null>;

function asEggVariables(value: unknown): EggVariables {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as EggVariables;
}

export const Route = createFileRoute("/_authenticated/servers/$serverId")({
  component: ServerDetailPage,
});

function ServerDetailPage() {
  const { serverId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: server, isLoading } = useQuery({
    queryKey: ["server", serverId],
    queryFn: async () => {
      const { data, error } = await supabase.from("servers").select("*").eq("id", serverId).single();
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async (status: ServerStatus) => {
      const { error } = await supabase.from("servers").update({ status, updated_at: new Date().toISOString() }).eq("id", serverId);
      if (error) throw error;
      // Append a log line for feedback
      if (user) {
        await supabase.from("console_logs").insert({
          server_id: serverId, user_id: user.id,
          level: status === "crashed" ? "error" : "info",
          message: `Server ${status}`,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["server", serverId] });
      qc.invalidateQueries({ queryKey: ["console", serverId] });
      qc.invalidateQueries({ queryKey: ["servers"] });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("servers").delete().eq("id", serverId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Server deleted");
      qc.invalidateQueries({ queryKey: ["servers"] });
      navigate({ to: "/servers" });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;
  if (!server) return <div className="p-10">Not found</div>;
  const eggVariables = asEggVariables(server.egg_variables);

  return (
    <div className="p-6 md:p-10">
      <Link to="/servers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{server.name}</h1>
            <StatusBadge status={server.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground mono">
            {server.egg_name ?? server.runtime} · {server.memory_mb}MB · {server.cpu_percent}% CPU · {server.node_id}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={server.status === "online" || setStatus.isPending}
            onClick={() => setStatus.mutate("online")}>
            <Play className="h-4 w-4" /> Start
          </Button>
          <Button size="sm" variant="outline" disabled={server.status === "offline" || setStatus.isPending}
            onClick={() => setStatus.mutate("offline")}>
            <Square className="h-4 w-4" /> Stop
          </Button>
          <Button size="sm" variant="outline" disabled={setStatus.isPending}
            onClick={() => { setStatus.mutate("starting"); setTimeout(() => setStatus.mutate("online"), 800); }}>
            <RotateCw className="h-4 w-4" /> Restart
          </Button>
        </div>
      </header>

      <Tabs defaultValue="console" className="mt-8">
        <TabsList>
          <TabsTrigger value="console" className="gap-2"><Terminal className="h-4 w-4" />Console</TabsTrigger>
          <TabsTrigger value="files" className="gap-2"><Files className="h-4 w-4" />Files</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="console" className="mt-4">
          <ConsoleTab serverId={serverId} userId={user?.id ?? ""} />
        </TabsContent>
        <TabsContent value="files" className="mt-4">
          <FilesTab serverId={serverId} userId={user?.id ?? ""} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="card-elevated rounded-2xl p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">Egg configuration</h3>
                <Badge variant="secondary">{server.runtime}</Badge>
                <Badge variant="outline" className="mono">{server.egg_image}</Badge>
              </div>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Startup command</p>
              <pre className="mono mt-2 overflow-x-auto rounded-md bg-background/60 p-3 text-xs">{server.start_command}</pre>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {Object.entries(eggVariables).map(([key, value]) => {
                  const secret = server.egg_secret_variables?.includes(key);
                  return (
                    <div key={key} className="rounded-lg border border-border bg-background/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="mono text-xs text-muted-foreground">{key}</span>
                        {secret && <Badge variant="secondary">secret</Badge>}
                      </div>
                      <p className="mono mt-1 truncate text-sm">{secret ? "••••••••••••" : String(value ?? "")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card-elevated rounded-2xl p-6">
            <h3 className="font-semibold">Danger zone</h3>
            <p className="mt-1 text-sm text-muted-foreground">Permanently delete this server and all its files.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="mt-4 gap-2"><Trash2 className="h-4 w-4" />Delete server</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {server.name}?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone. All files and logs will be removed.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => remove.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConsoleTab({ serverId, userId }: { serverId: string; userId: string }) {
  const qc = useQueryClient();
  const [cmd, setCmd] = useState("");
  const { data: logs = [] } = useQuery({
    queryKey: ["console", serverId],
    queryFn: async () => {
      const { data, error } = await supabase.from("console_logs").select("*").eq("server_id", serverId).order("created_at", { ascending: true }).limit(200);
      if (error) throw error;
      return data;
    },
    refetchInterval: 3000,
  });

  const send = async () => {
    if (!cmd.trim() || !userId) return;
    await supabase.from("console_logs").insert([
      { server_id: serverId, user_id: userId, level: "command", message: `$ ${cmd}` },
      { server_id: serverId, user_id: userId, level: "info", message: `Executed: ${cmd.slice(0, 80)}` },
    ]);
    setCmd("");
    qc.invalidateQueries({ queryKey: ["console", serverId] });
  };

  return (
    <div className="card-elevated overflow-hidden rounded-2xl">
      <div className="bg-background/60 p-4 mono text-sm">
        <div className="h-80 overflow-auto rounded-md bg-background/80 p-3">
          {logs.length === 0 ? (
            <p className="text-muted-foreground">Console is empty. Start the server to see output.</p>
          ) : logs.map((l) => (
            <div key={l.id} className="leading-relaxed">
              <span className="text-muted-foreground">[{new Date(l.created_at).toLocaleTimeString()}]</span>{" "}
              <span className={
                l.level === "error" ? "text-destructive" :
                l.level === "command" ? "text-primary" :
                l.level === "warning" ? "text-warning" : "text-foreground"
              }>{l.message}</span>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="mt-3 flex gap-2">
          <Input value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="Enter command…" className="mono" />
          <Button type="submit" size="icon"><Send className="h-4 w-4" /></Button>
        </form>
      </div>
    </div>
  );
}

function FilesTab({ serverId, userId }: { serverId: string; userId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [newPath, setNewPath] = useState("");

  const { data: files = [] } = useQuery({
    queryKey: ["files", serverId],
    queryFn: async () => {
      const { data, error } = await supabase.from("server_files").select("*").eq("server_id", serverId).order("path");
      if (error) throw error;
      return data;
    },
  });

  const file = files.find((f) => f.id === selected);

  const save = async () => {
    if (!file) return;
    const { error } = await supabase.from("server_files").update({
      content, size_bytes: new Blob([content]).size, updated_at: new Date().toISOString(),
    }).eq("id", file.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["files", serverId] });
  };

  const create = async () => {
    if (!newPath.trim() || !userId) return;
    const { data, error } = await supabase.from("server_files").insert({
      server_id: serverId, user_id: userId, path: newPath.trim(), content: "", size_bytes: 0,
    }).select().single();
    if (error) return toast.error(error.message);
    setNewPath("");
    setSelected(data.id);
    setContent("");
    qc.invalidateQueries({ queryKey: ["files", serverId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("server_files").delete().eq("id", id);
    if (error) return toast.error(error.message);
    if (selected === id) { setSelected(null); setContent(""); }
    qc.invalidateQueries({ queryKey: ["files", serverId] });
  };

  return (
    <div className="card-elevated grid gap-0 overflow-hidden rounded-2xl md:grid-cols-[260px_1fr]">
      <aside className="border-r border-border bg-background/40 p-3">
        <div className="flex gap-2">
          <Input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="index.js" className="mono h-8" />
          <Button size="icon" className="h-8 w-8" onClick={create}><Plus className="h-4 w-4" /></Button>
        </div>
        <ul className="mt-3 space-y-1">
          {files.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">No files</li>}
          {files.map((f) => (
            <li key={f.id} className="group flex items-center justify-between gap-1">
              <button
                onClick={() => { setSelected(f.id); setContent(f.content); }}
                className={`flex-1 truncate rounded px-2 py-1 text-left text-sm mono ${selected === f.id ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"}`}
              >
                {f.path}
              </button>
              <button onClick={() => remove(f.id)} className="opacity-0 transition group-hover:opacity-100 text-destructive hover:text-destructive/80">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="p-4">
        {file ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm mono text-muted-foreground">{file.path}</p>
              <Button size="sm" onClick={save}>Save</Button>
            </div>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[360px] mono text-sm" />
          </>
        ) : (
          <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">
            Select or create a file to edit.
          </div>
        )}
      </div>
    </div>
  );
}
