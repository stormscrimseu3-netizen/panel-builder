import { Hexagon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const APP_NAME = "NebulaPanel";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--gradient-primary)] glow">
        <Hexagon className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
      </span>
      <span className="text-lg">
        <span className="text-gradient">Nebula</span>
        <span className="text-foreground">Panel</span>
      </span>
    </Link>
  );
}
