import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["server_status"];

const map: Record<Status, { label: string; cls: string }> = {
  online: { label: "Online", cls: "bg-success/15 text-success border-success/30" },
  starting: { label: "Starting", cls: "bg-warning/15 text-warning border-warning/30" },
  stopping: { label: "Stopping", cls: "bg-warning/15 text-warning border-warning/30" },
  offline: { label: "Offline", cls: "bg-muted text-muted-foreground border-border" },
  crashed: { label: "Crashed", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}
