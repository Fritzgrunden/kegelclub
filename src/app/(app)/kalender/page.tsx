import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, List, LayoutGrid } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { listEventsBetween, type EventRow } from "@/server/services/events";
import { addDaysYmd, formatMonth, formatTime, formatWeekday, formatDate, toYmd, zonedToUtc } from "@/lib/dates";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Kalender" };

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function dotClass(e: EventRow) {
  if (e.status === "ABGESAGT") return "bg-absage/60";
  return e.kind === "KEGELABEND" ? "bg-messing" : "bg-zusage";
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ monat?: string; ansicht?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const today = toYmd(new Date());
  const month = sp.monat && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.monat) ? sp.monat : today.slice(0, 7);
  const listView = sp.ansicht === "liste";

  const first = `${month}-01`;
  const nextMonth = `${shiftMonth(month, 1)}-01`;
  const events = await listEventsBetween(zonedToUtc(first, "00:00"), zonedToUtc(nextMonth, "00:00"));
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = toYmd(e.startsAt);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
  }

  // Raster beginnt am Montag vor dem Monatsersten
  const [y, m] = month.split("-").map(Number);
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const gridStart = addDaysYmd(first, -firstWeekday);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => addDaysYmd(gridStart, i));
  const q = (mo: string) => `/kalender?monat=${mo}${listView ? "&ansicht=liste" : ""}`;

  return (
    <>
      <PageHeader title="Kalender" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Link href={q(shiftMonth(month, -1))} aria-label="Voriger Monat" className="flex size-12 items-center justify-center rounded-xl border border-eiche hover:bg-theke-2"><ChevronLeft /></Link>
          <h2 className="min-w-44 text-center font-display text-xl font-bold">{formatMonth(month)}</h2>
          <Link href={q(shiftMonth(month, 1))} aria-label="Nächster Monat" className="flex size-12 items-center justify-center rounded-xl border border-eiche hover:bg-theke-2"><ChevronRight /></Link>
        </div>
        <div className="flex gap-1 rounded-xl border border-eiche bg-theke p-1">
          <Link href={`/kalender?monat=${month}`} aria-pressed={!listView} className={cn("flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm", !listView ? "bg-theke-2 text-kreide" : "text-kreide-dim")}><LayoutGrid size={16} aria-hidden /> Monat</Link>
          <Link href={`/kalender?monat=${month}&ansicht=liste`} aria-pressed={listView} className={cn("flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm", listView ? "bg-theke-2 text-kreide" : "text-kreide-dim")}><List size={16} aria-hidden /> Liste</Link>
        </div>
      </div>

      {!listView && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-eiche bg-theke">
          <div className="grid grid-cols-7 border-b border-eiche text-center text-xs text-kreide-dim">
            {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day) => {
              const inMonth = day.startsWith(month);
              const dayEvents = byDay.get(day) ?? [];
              return (
                <div key={day} className={cn("min-h-14 border-b border-r border-eiche/40 p-1 sm:min-h-24 sm:p-1.5", !inMonth && "opacity-35")}>
                  <span className={cn("inline-flex size-7 items-center justify-center rounded-full text-sm tabular-nums", day === today && "bg-messing font-bold text-bahn")}>
                    {Number(day.slice(8))}
                  </span>
                  {/* Mobil: Punkte, Desktop: Titel */}
                  <div className="mt-0.5 flex flex-wrap gap-1 sm:hidden">
                    {dayEvents.map((e) => (
                      <Link key={e.id} href={`/termine/${e.id}`} aria-label={e.title} className={cn("size-2.5 rounded-full", dotClass(e))} />
                    ))}
                  </div>
                  <div className="hidden flex-col gap-1 sm:flex">
                    {dayEvents.map((e) => (
                      <Link key={e.id} href={`/termine/${e.id}`} className={cn("truncate rounded px-1.5 py-0.5 text-xs", e.kind === "KEGELABEND" ? "bg-messing/20 text-messing-hell" : "bg-zusage/15 text-zusage", e.status === "ABGESAGT" && "line-through opacity-60")}>
                        {formatTime(e.startsAt)} {e.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 px-3 py-2 text-xs text-kreide-dim">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-messing" /> Kegelabend</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-zusage" /> Event</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-absage/60" /> Abgesagt</span>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState title="In diesem Monat ist nichts geplant." />
      ) : (
        <ul className={cn("flex flex-col gap-2", !listView && "sm:hidden")}>
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/termine/${e.id}`} className="flex min-h-16 items-center gap-3 rounded-xl border border-eiche/70 bg-theke px-3 py-2 hover:border-messing/50">
                <span className={cn("h-10 w-1.5 shrink-0 rounded-full", dotClass(e))} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-semibold", e.status === "ABGESAGT" && "line-through opacity-60")}>{e.title}</span>
                  <span className="block text-sm text-kreide-dim">{formatWeekday(e.startsAt)}, {formatDate(e.startsAt)} · {formatTime(e.startsAt)} Uhr</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
