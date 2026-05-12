import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type ChangeEvent } from "react";
import { toast } from "sonner";
import { Trash2, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  eggs as builtinEggs,
  getCustomEggs,
  saveCustomEggs,
  importPterodactylEgg,
  type EggDefinition,
} from "@/lib/egg-catalog";

export const Route = createFileRoute("/_authenticated/eggs")({
  component: EggsPage,
});

function EggsPage() {
  const [custom, setCustom] = useState<EggDefinition[]>(() => getCustomEggs());
  const [pasted, setPasted] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const persist = (next: EggDefinition[]) => {
    setCustom(next);
    saveCustomEggs(next);
  };

  const importJson = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const next = [...custom];
      for (const item of list) next.push(importPterodactylEgg(item));
      persist(next);
      toast.success(`Imported ${list.length} egg${list.length > 1 ? "s" : ""}`);
      setPasted("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    for (const f of Array.from(files)) importJson(await f.text());
    if (fileInput.current) fileInput.current.value = "";
  };

  const remove = (id: string) => persist(custom.filter((e) => e.id !== id));

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-10">
      <h1 className="text-3xl font-bold tracking-tight">Eggs</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Import Pterodactyl-style egg JSON files. Imported eggs appear in the egg picker when
        creating a new server.
      </p>

      <section className="card-elevated mt-6 rounded-2xl p-6">
        <h2 className="font-semibold">Import egg</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a Pterodactyl egg export (JSON) or upload one or more .json files.
        </p>
        <Textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={8}
          placeholder='{"name":"My Egg","image":"node:20-bullseye","startup":"node {{MAIN_FILE}}","variables":[...]}'
          className="mono mt-3"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => importJson(pasted)} disabled={!pasted.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Import pasted JSON
          </Button>
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Upload .json files
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            multiple
            className="hidden"
            onChange={onFile}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Custom eggs ({custom.length})</h2>
        {custom.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No custom eggs imported yet.</p>
        ) : (
          <div className="mt-3 grid gap-3">
            {custom.map((egg) => (
              <div
                key={egg.id}
                className="card-elevated flex items-start justify-between gap-3 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{egg.name}</h3>
                    <Badge variant="secondary">{egg.runtime}</Badge>
                    <Badge variant="outline" className="mono">{egg.image}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{egg.description}</p>
                  <p className="mono mt-1 truncate text-xs text-muted-foreground">
                    startup: {egg.startup}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => remove(egg.id)} title="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Built-in eggs ({builtinEggs.length})</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {builtinEggs.map((egg) => (
            <div key={egg.id} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{egg.name}</span>
                <Badge variant="secondary">{egg.category}</Badge>
              </div>
              <p className="mono mt-1 text-xs text-muted-foreground">{egg.image}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
