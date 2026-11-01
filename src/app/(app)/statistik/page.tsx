import Link from "next/link";
import type { Metadata } from "next";
import { hasPermission } from "@/lib/permissions";
import { requireUser } from "@/server/auth/session";
import { getAttendance, type AttendanceRow } from "@/server/services/stats";
import { getPenaltyStats } from "@/server/services/penalties";
import { PenaltyStatsView } from "@/components/penalties/penalty-stats";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Statistik" };

const MEDALS = ["🥇", "🥈", "🥉"];

function AttendanceView({ evenings, members, userId }: { evenings: number; members: AttendanceRow[]; userId: string }) {
  if (evenings === 0) return <EmptyState title="Noch keine Kegelabende in diesem Zeitraum." />;
  return (
    <section className="tafel rounded-md p-3 sm:p-5">
      <h2 className="kreide mb-1 px-1 font-display text-2xl font-bold">🎳 Immer dabei</h2>
      <p className="mb-3 px-1 text-sm text-kreide-dim">{evenings === 1 ? "1 Kegelabend" : `${evenings} Kegelabende`} – gezählt wird die Zusage.</p>
      <ol className="flex flex-col gap-1">
        {members.map((m, i) => (
          <li key={m.userId}>
            <Link href={`/mitglieder/${m.userId}`} className={cn("flex min-h-14 items-center gap-3 rounded-lg px-2 hover:bg-black/15", m.userId === userId && "bg-messing/15")}>
              <span className="kreide w-8 shrink-0 text-center font-display text-2xl font-bold text-messing-hell tabular-nums">{m.attended > 0 ? (MEDALS[i] ?? i + 1) : "–"}</span>
              <Avatar person={m} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="kreide block truncate font-semibold">{m.displayName}</span>
                <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-black/25">
                  <span className="block h-full rounded-full bg-zusage" style={{ width: `${m.percent}%` }} />
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="kreide block font-display text-xl font-bold tabular-nums">{m.attended}×</span>
                <span className="block text-xs text-kreide-dim tabular-nums">{m.percent} %</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ jahr?: string; ansicht?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const currentYear = new Date().getFullYear();
  const all = sp.jahr === "alle";
  const year = all ? undefined : Number(sp.jahr) || currentYear;
  const canPenalties = hasPermission(user, "penalties:view-all");
  const view = canPenalties && sp.ansicht !== "anwesenheit" ? "strafen" : "anwesenheit";
  const yearParam = all ? "alle" : String(year);
  const viewParam = `&ansicht=${view}`;

  return (
    <>
      <PageHeader title="Statistik" subtitle={all ? "Alle Jahre" : `Jahr ${year}`} />
      {canPenalties && (
        <Tabs
          items={[
            { href: `/statistik?jahr=${yearParam}&ansicht=strafen`, label: "Strafen", active: view === "strafen" },
            { href: `/statistik?jahr=${yearParam}&ansicht=anwesenheit`, label: "Anwesenheit", active: view === "anwesenheit" },
          ]}
        />
      )}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
          <Link
            key={y}
            href={`/statistik?jahr=${y}${viewParam}`}
            scroll={false}
            className={cn("flex min-h-11 shrink-0 items-center rounded-full border px-4", year === y && !all ? "border-messing bg-messing/15 text-messing-hell" : "border-eiche text-kreide-dim")}
          >
            {y}
          </Link>
        ))}
        <Link
          href={`/statistik?jahr=alle${viewParam}`}
          scroll={false}
          className={cn("flex min-h-11 shrink-0 items-center rounded-full border px-4", all ? "border-messing bg-messing/15 text-messing-hell" : "border-eiche text-kreide-dim")}
        >
          Alle Jahre
        </Link>
      </div>

      {view === "strafen" ? (
        <PenaltyStatsView stats={await getPenaltyStats(user, year)} userId={user.id} />
      ) : (
        <AttendanceView {...await getAttendance(year)} userId={user.id} />
      )}
    </>
  );
}
