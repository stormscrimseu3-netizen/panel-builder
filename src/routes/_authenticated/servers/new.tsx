import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  defaultEggVariables,
  getAllEggs,
  getEgg,
  renderStartup,
  validateEggVariables,
} from "@/lib/egg-catalog";

export const Route = createFileRoute("/_authenticated/servers/new")({
  component: NewServerPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(60),
  description: z.string().trim().max(280).optional(),
  memory_mb: z.number().int().min(128).max(8192),
  cpu_percent: z.number().int().min(10).max(400),
});

function NewServerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eggId, setEggId] = useState("generic/nodejs");
  const [variables, setVariables] = useState<Record<string, string>>(() =>
    defaultEggVariables(getEgg("generic/nodejs")),
  );
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [memoryMb, setMemoryMb] = useState(512);
  const [cpuPercent, setCpuPercent] = useState(50);
  const [busy, setBusy] = useState(false);
  const selectedEgg = useMemo(() => getEgg(eggId), [eggId]);
  const startCommand = useMemo(
    () => renderStartup(selectedEgg.startup, variables),
    [selectedEgg, variables],
  );

  const selectEgg = (id: string) => {
    const egg = getEgg(id);
    setEggId(egg.id);
    setVariables(defaultEggVariables(egg));
    setVisibleSecrets({});
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      name,
      description,
      memory_mb: memoryMb,
      cpu_percent: cpuPercent,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const variableError = validateEggVariables(selectedEgg, variables);
    if (variableError) return toast.error(variableError);
    if (!user) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("servers")
      .insert({
        ...parsed.data,
        runtime: selectedEgg.runtime,
        start_command: startCommand,
        egg_id: selectedEgg.id,
        egg_name: selectedEgg.name,
        egg_image: selectedEgg.image,
        egg_startup: selectedEgg.startup,
        egg_variables: variables,
        egg_secret_variables: selectedEgg.variables
          .filter((variable) => variable.secret)
          .map((variable) => variable.env),
        user_id: user.id,
      })
      .select()
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Server created");
    navigate({ to: "/servers/$serverId", params: { serverId: data.id } });
  };

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <Link
        to="/servers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to servers
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Create server</h1>
      <p className="text-sm text-muted-foreground">
        Choose an egg, then fill the startup variables.
      </p>

      <form onSubmit={submit} className="card-elevated mt-6 space-y-5 rounded-2xl p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_1.1fr]">
          <div className="space-y-2">
            <Label htmlFor="name">Server name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-discord-bot"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Egg</Label>
            <Select value={eggId} onValueChange={selectEgg}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eggs.map((egg) => (
                  <SelectItem key={egg.id} value={egg.id}>
                    {egg.category} / {egg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-background/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{selectedEgg.name}</h2>
                <Badge variant="secondary">{selectedEgg.runtime}</Badge>
                <Badge variant="outline" className="mono">
                  {selectedEgg.image}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{selectedEgg.description}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Description (optional)</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>

        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Startup variables</h2>
            <p className="text-xs text-muted-foreground">
              Required, secret, and validation rules match the selected egg.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {selectedEgg.variables
              .filter((variable) => variable.user_viewable !== false)
              .map((variable) => {
                const isSecret = Boolean(variable.secret);
                const isVisible = visibleSecrets[variable.env];
                const inputType =
                  isSecret && !isVisible
                    ? "password"
                    : variable.field_type === "number"
                      ? "number"
                      : "text";
                return (
                  <div
                    key={variable.env}
                    className="space-y-2 rounded-lg border border-border bg-background/30 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={variable.env} className="flex items-center gap-2">
                        {variable.name}
                        {variable.rules.includes("required") && (
                          <Badge variant="outline">required</Badge>
                        )}
                        {isSecret && (
                          <Badge variant="secondary" className="gap-1">
                            <LockKeyhole className="h-3 w-3" />
                            secret
                          </Badge>
                        )}
                      </Label>
                      <span className="mono text-xs text-muted-foreground">{variable.env}</span>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        id={variable.env}
                        type={inputType}
                        value={variables[variable.env] ?? ""}
                        disabled={variable.user_editable === false}
                        onChange={(e) =>
                          setVariables((current) => ({
                            ...current,
                            [variable.env]: e.target.value,
                          }))
                        }
                        required={variable.rules.includes("required")}
                        className="mono"
                      />
                      {isSecret && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() =>
                            setVisibleSecrets((current) => ({
                              ...current,
                              [variable.env]: !current[variable.env],
                            }))
                          }
                          aria-label={isVisible ? "Hide secret" : "Show secret"}
                        >
                          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    {variable.description && (
                      <p className="text-xs text-muted-foreground">{variable.description}</p>
                    )}
                    <p className="mono text-xs text-muted-foreground">rules: {variable.rules}</p>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="mem">Memory (MB)</Label>
            <Input
              id="mem"
              type="number"
              value={memoryMb}
              onChange={(e) => setMemoryMb(parseInt(e.target.value) || 0)}
              min={128}
              max={8192}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpu">CPU (%)</Label>
            <Input
              id="cpu"
              type="number"
              value={cpuPercent}
              onChange={(e) => setCpuPercent(parseInt(e.target.value) || 0)}
              min={10}
              max={400}
            />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="cmd">Generated startup command</Label>
            <Input id="cmd" value={startCommand} className="mono" readOnly />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create server"}
          </Button>
          <Link to="/servers">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
