import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/servers/new")({
  component: NewServerPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  description: z.string().trim().max(280).optional(),
  runtime: z.enum(["nodejs", "python", "java", "docker"]),
  memory_mb: z.number().int().min(128).max(8192),
  cpu_percent: z.number().int().min(10).max(400),
  start_command: z.string().trim().min(1).max(200),
});

function NewServerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [runtime, setRuntime] = useState<"nodejs" | "python" | "java" | "docker">("nodejs");
  const [memoryMb, setMemoryMb] = useState(512);
  const [cpuPercent, setCpuPercent] = useState(50);
  const [startCommand, setStartCommand] = useState("node index.js");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, description, runtime, memory_mb: memoryMb, cpu_percent: cpuPercent, start_command: startCommand });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase.from("servers").insert({
      ...parsed.data,
      user_id: user.id,
    }).select().single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Server created");
    navigate({ to: "/servers/$serverId", params: { serverId: data.id } });
  };

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <Link to="/servers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to servers
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Create server</h1>
      <p className="text-sm text-muted-foreground">Configure your new bot instance.</p>

      <form onSubmit={submit} className="card-elevated mt-6 space-y-5 rounded-2xl p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my-discord-bot" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Description (optional)</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Runtime</Label>
            <Select value={runtime} onValueChange={(v) => setRuntime(v as typeof runtime)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nodejs">Node.js</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="java">Java</SelectItem>
                <SelectItem value="docker">Docker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd">Start command</Label>
            <Input id="cmd" value={startCommand} onChange={(e) => setStartCommand(e.target.value)} className="mono" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mem">Memory (MB)</Label>
            <Input id="mem" type="number" value={memoryMb} onChange={(e) => setMemoryMb(parseInt(e.target.value) || 0)} min={128} max={8192} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU (%)</Label>
            <Input id="cpu" type="number" value={cpuPercent} onChange={(e) => setCpuPercent(parseInt(e.target.value) || 0)} min={10} max={400} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create server"}</Button>
          <Link to="/servers"><Button type="button" variant="ghost">Cancel</Button></Link>
        </div>
      </form>
    </div>
  );
}
