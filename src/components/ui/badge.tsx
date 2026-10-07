import type { ReactNode } from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-theke-2 text-kreide-dim border-eiche",
  messing: "bg-messing/15 text-messing-hell border-messing/40",
  zusage: "bg-zusage/15 text-zusage border-zusage/40",
  absage: "bg-absage/15 text-absage border-absage/40",
} as const;

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}
