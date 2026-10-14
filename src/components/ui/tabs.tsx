import Link from "next/link";
import { cn } from "./cn";

export interface TabItem {
  href: string;
  label: string;
  active: boolean;
  /** Kleine Zahl neben dem Label, z. B. Anzahl offener Einträge. */
  count?: number;
}

/** Reiter als Links – Zustand steckt in der URL, damit Zurück-Taste und Neuladen funktionieren. */
export function Tabs({ items, className }: { items: TabItem[]; className?: string }) {
  return (
    <nav className={cn("mb-5 flex gap-1 rounded-2xl border border-eiche/70 bg-theke p-1", className)}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          scroll={false}
          className={cn(
            "flex min-h-12 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[15px]",
            t.active ? "bg-messing font-semibold text-bahn" : "text-kreide-dim hover:bg-theke-2 hover:text-kreide",
          )}
        >
          <span className="truncate">{t.label}</span>
          {t.count !== undefined && t.count > 0 && (
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", t.active ? "bg-bahn/20" : "bg-absage/20 text-absage")}>{t.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
