"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/components/ui/cn";

export const MAX_QUANTITY = 99;

const stepClass =
  "flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-eiche bg-theke-2 hover:border-messing/60 active:bg-messing/15 disabled:opacity-40";

/** „Wie oft?“ – große Plus/Minus-Knöpfe für die Bedienung an der Bahn. */
export function QuantityStepper({ value, onChange, name, className }: { value: number; onChange: (n: number) => void; name?: string; className?: string }) {
  const set = (n: number) => onChange(Math.min(MAX_QUANTITY, Math.max(1, n)));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button type="button" onClick={() => set(value - 1)} disabled={value <= 1} aria-label="Einmal weniger" className={stepClass}>
        <Minus size={20} aria-hidden />
      </button>
      <span aria-live="polite" className="min-w-14 text-center font-display text-2xl font-bold tabular-nums">
        {value}×
      </span>
      <button type="button" onClick={() => set(value + 1)} disabled={value >= MAX_QUANTITY} aria-label="Einmal mehr" className={stepClass}>
        <Plus size={20} aria-hidden />
      </button>
    </div>
  );
}
