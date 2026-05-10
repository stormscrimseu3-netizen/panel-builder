import { Hexagon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

const ENV_NAME = (import.meta.env.VITE_PANEL_NAME as string | undefined)?.trim();
export const DEFAULT_APP_NAME = ENV_NAME && ENV_NAME.length > 0 ? ENV_NAME : "NebulaPanel";

export function getStoredBranding() {
  if (typeof window === "undefined") return { name: DEFAULT_APP_NAME, logoUrl: "" };
  return {
    name: localStorage.getItem("panel:brand:name") || DEFAULT_APP_NAME,
    logoUrl: localStorage.getItem("panel:brand:logo") || "",
  };
}

export function setStoredBranding(b: { name: string; logoUrl: string }) {
  localStorage.setItem("panel:brand:name", b.name);
  localStorage.setItem("panel:brand:logo", b.logoUrl);
  window.dispatchEvent(new Event("panel:brand:update"));
}

function splitName(n: string): [string, string] {
  if (n.length <= 1) return [n, ""];
  const mid = Math.ceil(n.length / 2);
  return [n.slice(0, mid), n.slice(mid)];
}

export function Brand({ className = "" }: { className?: string }) {
  const [brand, setBrand] = useState(() => ({ name: DEFAULT_APP_NAME, logoUrl: "" }));

  useEffect(() => {
    const sync = () => setBrand(getStoredBranding());
    sync();
    window.addEventListener("panel:brand:update", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("panel:brand:update", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const [first, second] = splitName(brand.name);

  return (
    <Link to="/" className={`flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-[image:var(--gradient-primary)] glow">
        {brand.logoUrl
          ? <img src={brand.logoUrl} alt="" className="h-full w-full object-cover" />
          : <Hexagon className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />}
      </span>
      <span className="text-lg">
        <span className="text-gradient">{first}</span>
        <span className="text-foreground">{second}</span>
      </span>
    </Link>
  );
}
