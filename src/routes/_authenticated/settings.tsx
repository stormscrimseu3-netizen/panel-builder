import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { getStoredBranding, setStoredBranding, DEFAULT_APP_NAME } from "@/components/brand";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [name, setName] = useState(DEFAULT_APP_NAME);
  const [logoUrl, setLogoUrl] = useState("");

  useEffect(() => {
    const b = getStoredBranding();
    setName(b.name);
    setLogoUrl(b.logoUrl);
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredBranding({ name: name.trim() || DEFAULT_APP_NAME, logoUrl: logoUrl.trim() });
    toast.success("Branding updated");
  };

  const reset = () => {
    setName(DEFAULT_APP_NAME);
    setLogoUrl("");
    setStoredBranding({ name: DEFAULT_APP_NAME, logoUrl: "" });
    toast.success("Reset to defaults");
  };

  return (
    <div className="mx-auto max-w-2xl p-6 md:p-10">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">Customize how the panel looks.</p>

      <form onSubmit={save} className="card-elevated mt-8 space-y-5 rounded-2xl p-6">
        <h2 className="font-semibold">Branding</h2>

        <div>
          <Label htmlFor="name">Panel name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="NebulaPanel" />
          <p className="mt-1 text-xs text-muted-foreground">Shown in the sidebar and browser tab.</p>
        </div>

        <div>
          <Label htmlFor="logo">Logo URL</Label>
          <Input id="logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
          <p className="mt-1 text-xs text-muted-foreground">Square PNG or SVG. Leave blank to use the default icon.</p>
        </div>

        {logoUrl && (
          <div className="flex items-center gap-3 rounded-md border border-border/60 p-3">
            <img src={logoUrl} alt="preview" className="h-10 w-10 rounded-md object-cover" />
            <span className="text-sm text-muted-foreground">Preview</span>
          </div>
        )}

        <div className="flex gap-2">
          <Button type="submit">Save</Button>
          <Button type="button" variant="ghost" onClick={reset}>Reset</Button>
        </div>
      </form>

      <p className="mt-6 text-xs text-muted-foreground">
        Branding is saved in this browser. To change the default for everyone, set <code className="mono">VITE_PANEL_NAME</code> in your <code className="mono">.env</code> when self-hosting.
      </p>
    </div>
  );
}
