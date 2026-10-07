import Link from "next/link";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getClubTotals, getLeaderboard, getPersonalStats } from "@/server/services/stats";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Stat } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Rangliste" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const all = sp.jahr === "alle";
  const year = all ? undefined : Number(sp.jahr) || currentYear;
  const [board, mine, totals] = await Promise.all([getLeaderboard(year), getPersonalStats(user.id, year), getClubTotals(year)]);
  const years = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <>
      <PageHeader title="Rangliste" subtitle={all ? "Alle Jahre" : `Saison ${year}`} />
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {years.map((y) => (
          <Link key={y} href={`/statistik?jahr=${y}`} className={cn("flex min-h-11 shrink-0 items-center rounded-full border px-4", year === y && !all ? "border-messing bg-messing/15 text-messing-hell" : "border-eiche text-kreide-dim")}>{y}</Link>
        ))}
        <Link href="/statistik?jahr=alle" className={cn("flex min-h-11 shrink-0 items-center rounded-full border px-4", all ? "border-messing bg-messing/15 text-messing-hell" : "border-eiche text-kreide-dim")}>Ewige Tabelle</Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="tafel rounded-md p-3 sm:p-5">
          <h2 className="kreide mb-3 px-1 font-display text-2xl font-bold">🏆 Rangliste</h2>
          {board.length === 0 ? (
            <EmptyState title="Noch keine abgeschlossenen Spiele." text="Sobald Runden abgeschlossen werden, erscheint hier die Rangliste." />
          ) : (
            <ol className="flex flex-col gap-1">
              {board.map((r) => (
                <li key={r.userId}>
                  <Link href={`/mitglieder/${r.userId}`} className={cn("flex min-h-14 items-center gap-3 rounded-lg px-2 hover:bg-black/15", r.userId === user.id && "bg-messing/15")}>
                    <span className="kreide w-8 text-center font-display text-2xl font-bold text-messing-hell tabular-nums">{r.position}</span>
                    <Avatar person={r} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="kreide block truncate font-semibold">{r.displayName}</span>
                      <span className="block text-xs text-kreide-dim">{r.games} Spiele · {r.wins} Siege · Ø Platz {r.averageRank.toLocaleString("de-DE")}</span>
                    </span>
                    <span className="kreide font-display text-2xl font-bold tabular-nums">{r.points}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle>Deine Saison</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat value={mine.points} label="Punkte" />
              <Stat value={mine.wins} label="Siege" />
              <Stat value={mine.gamesPlayed} label="Spiele" />
              <Stat value={mine.bestRank ?? "–"} label="Beste Platzierung" />
              <Stat value={mine.podiums} label="Podestplätze" />
              <Stat value={mine.eveningsAttended} label="Kegelabende" />
            </div>
          </Card>
          <Card>
            <CardTitle>Club gesamt</CardTitle>
            <div className="grid grid-cols-2 gap-2">
              <Stat value={totals.evenings} label="Kegelabende" />
              <Stat value={totals.games} label="gewertete Spiele" />
            </div>
          </Card>
          <Card className="text-sm text-kreide-dim">
            <p className="flex items-start gap-2">
              <Info size={18} className="mt-0.5 shrink-0 text-messing" aria-hidden />
              <span>
                <strong className="text-kreide">So wird gezählt:</strong> Pro abgeschlossener Runde gibt es Platzierungspunkte –
                bei 8 Spielern bekommt Platz 1 acht Punkte, Platz 8 einen Punkt. Gleichstand = gleiche Punkte.
                Bei Punktgleichheit in der Tabelle entscheiden die Siege.
              </span>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
