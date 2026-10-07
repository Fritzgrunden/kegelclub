import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({ children, className, as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={cn("rounded-2xl border border-eiche/70 bg-theke p-4 sm:p-5", className)}>{children}</Tag>;
}

export function CardTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-lg font-bold text-kreide">{children}</h2>
      {action}
    </div>
  );
}
