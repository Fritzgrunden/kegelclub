import Link from "next/link";
import { formatEuro } from "@/lib/format";
import { formatYmd } from "@/lib/dates";
import type { PenaltyStats } from "@/server/services/penalties";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/components/ui/cn";

const MEDALS = ["🥇", "🥈", "🥉"];

/** Sünderkartei, häufigste Strafen und teuerste Abende. */
export function PenaltyStatsView({ stats, userId }: { stats: PenaltyStats; userId: string }) {
  if (stats.members.length === 0) return <EmptyState title="Keine Strafen in diesem Zeitraum." text="Vorbildlich – oder es hat nur noch keiner eingetragen." />;
  const maxType = stats.types[0]?.count ?? 1;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section className="tafel min-w-0 rounded-md p-3 sm:p-5">
        <h2 className="kreide mb-3 px-1 font-display text-2xl font-bold">😈 Sünderkartei</h2>
        <ol className="flex flex-col gap-1">
          {stats.members.map((m, i) => (
            <li key={m.userId}>
              <Link href={`/strafen?ansicht=verlauf&mitglied=${m.userId}`} className={cn("flex min-h-14 items-center gap-3 rounded-lg px-2 hover:bg-black/15", m.userId === userId && "bg-messing/15")}>
                <span className="kreide w-8 text-center font-display text-2xl font-bold text-messing-hell tabular-nums">{MEDALS[i] ?? i + 1}</span>
                <Avatar person={m} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="kreide block truncate font-semibold">{m.displayName}</span>
                  <span className="block truncate text-xs text-kreide-dim">
                    {formatEuro(m.totalCents)}
                    {m.favorite && ` · am liebsten: ${m.favorite.label} (${m.favorite.count}×)`}
                  </span>
                </span>
                <span className="kreide font-display text-2xl font-bold tabular-nums">{m.count}×</span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardTitle>Club gesamt</CardTitle>
          <div className="grid grid-cols-2 gap-2">
            <Stat value={stats.totalCount} label="Strafen" />
            <Stat value={formatEuro(stats.totalCents)} label="zusammen" />
          </div>
        </Card>

        <Card>
          <CardTitle>Häufigste Strafen</CardTitle>
          <ul className="flex flex-col gap-2">
            {stats.types.map((t) => (
              <li key={t.label}>
                <div className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span className="truncate">{t.label}</span>
                  <span className="shrink-0 tabular-nums text-kreide-dim">
                    <span className="font-semibold text-kreide">{t.count}×</span> · {formatEuro(t.totalCents)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-theke-2">
                  <div className="h-full rounded-full bg-messing" style={{ width: `${Math.max(4, (t.count / maxType) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {stats.evenings.length > 0 && (
          <Card>
            <CardTitle>Teuerste Abende</CardTitle>
            <ul>
              {stats.evenings.map((e, i) => (
                <li key={e.eventId} className="border-b border-eiche/50 last:border-0">
                  <Link href={`/termine/${e.eventId}`} className="flex min-h-14 items-center gap-3 hover:bg-theke-2/50">
                    <span className="w-6 text-center text-lg">{MEDALS[i]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{e.title}</span>
                      <span className="block text-xs text-kreide-dim">{formatYmd(e.date)} · {e.count} Strafen</span>
                    </span>
                    <span className="font-display font-bold tabular-nums">{formatEuro(e.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
