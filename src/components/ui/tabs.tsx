import Link from "next/link";
import { cn } from "./cn";

export interface TabItem {
  href: string;
  label: string;
  active: boolean;
  /** Kleine Zahl neben dem Label, z. B. Anzahl offener Einträge. */
  count?: number;
}

/**
 * Reiter als Links – Zustand steckt in der URL, damit Zurück-Taste und Neuladen funktionieren.
 * `sub` = zweite, schlichtere Ebene unter den Hauptreitern (z. B. Eintragen/Offen/Verlauf bei Strafen).
 */
export function Tabs({ items, className, variant = "main" }: { items: TabItem[]; className?: string; variant?: "main" | "sub" }) {
  const sub = variant === "sub";
  return (
    <nav className={cn(sub ? "mb-4 flex gap-2" : "mb-5 flex gap-1 rounded-2xl border border-eiche/70 bg-theke p-1", className)}>
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          scroll={false}
          className={cn(
            // flex-auto statt flex-1: längere Beschriftungen („Eintragen“) bekommen mehr Platz, statt am Handy abgeschnitten zu werden
            "flex min-w-0 flex-auto items-center justify-center gap-1.5 px-2",
            sub ? "min-h-11 rounded-full border text-sm" : "min-h-12 rounded-xl text-[15px]",
            sub
              ? t.active
                ? "border-messing bg-messing/15 font-semibold text-messing-hell"
                : "border-eiche/70 text-kreide-dim hover:text-kreide"
              : t.active
                ? "bg-messing font-semibold text-bahn"
                : "text-kreide-dim hover:bg-theke-2 hover:text-kreide",
          )}
        >
          <span className="truncate">{t.label}</span>
          {t.count !== undefined && t.count > 0 && (
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", t.active && !sub ? "bg-bahn/20" : "bg-absage/20 text-absage")}>{t.count}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
