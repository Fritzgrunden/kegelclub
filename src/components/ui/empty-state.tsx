import type { ReactNode } from "react";
import { PinDiamond } from "./pin-diamond";

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-eiche px-6 py-10 text-center">
      <PinDiamond className="mb-4 h-12 w-12 opacity-40" />
      <p className="font-display text-lg text-kreide">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-kreide-dim">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
