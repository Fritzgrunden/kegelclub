import type { ReactNode } from "react";

export function Stat({ value, label, hint }: { value: ReactNode; label: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-theke-2/70 px-3 py-3">
      <div className="font-display text-3xl font-bold tabular-nums text-kreide">{value}</div>
      <div className="text-sm text-kreide-dim">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-kreide-dim/70">{hint}</div>}
    </div>
  );
}
