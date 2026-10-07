import Link from "next/link";
import type { Metadata } from "next";
import { Cake, Gavel, Plus, Trophy, UserPlus } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatEuro, displayName } from "@/lib/format";
import { formatDate, formatYmd, nextBirthday, toYmd, addDaysYmd } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import {
  getMyParticipation,
  getNextEvent,
  getParticipationCounts,
  listEvents,
  upcomingThreshold,
} from "@/server/services/events";
import { getLeaderboard, getRecentResults } from "@/server/services/stats";
import { getOpenPenaltySummary } from "@/server/services/penalties";
import { countPendingRegistrations, listMembers } from "@/server/services/users";
import { NextEveningBoard } from "@/components/events/next-evening-board";
import { EventCard } from "@/components/events/event-card";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Start" };

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, "events:manage");
  const isKassenwart = hasPermission(user, "penalties:manage");
  const year = new Date().getFullYear();

  const [nextEvening, upcomingEvents, board, recent, penalties, pending, members] = await Promise.all([
    getNextEvent("KEGELABEND"),
    listEvents({ kind: "EVENT", from: upcomingThreshold(), limit: 3, includeCancelled: false }),
    getLeaderboard(year),
    getRecentResults(user.id, 4),
    getOpenPenaltySummary(user.id),
    isAdmin ? countPendingRegistrations() : Promise.resolve(0),
    listMembers(),
  ]);

  const eventIds = [nextEvening?.id, ...upcomingEvents.map((e) => e.id)].filter(Boolean) as string[];
  const [counts, mine] = await Promise.all([getParticipationCounts(eventIds), getMyParticipation(user.id, eventIds)]);

  const today = toYmd(new Date());
  const in30 = addDaysYmd(today, 30);
  const birthdays = members
    .filter((m) => m.birthday)
    .map((m) => ({ ...m, next: nextBirthday(m.birthday!, today) }))
    .filter((m) => m.next <= in30)
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">Gut Holz, {user.nickname || user.firstName}!</h1>
        <p className="mt-1 text-kreide-dim">Schön, dass du da bist.</p>
      </div>

      {pending > 0 && (
        <Alert tone="info">
          <Link href="/verwaltung" className="font-semibold underline-offset-4 hover:underline">
            {pending === 1 ? "1 neue Registrierung wartet" : `${pending} neue Registrierungen warten`} auf Freischaltung.
          </Link>
        </Alert>
      )}

      {(isAdmin || isKassenwart) && (
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {isAdmin && (
            <LinkButton href="/termine/neu?art=KEGELABEND" variant="secondary" className="shrink-0">
              <Plus size={18} aria-hidden /> Kegelabend
            </LinkButton>
          )}
          {isAdmin && (
            <LinkButton href="/termine/neu?art=EVENT" variant="secondary" className="shrink-0">
              <Plus size={18} aria-hidden /> Event
            </LinkButton>
          )}
          {isKassenwart && (
            <LinkButton href={`/strafen/neu${nextEvening ? `?termin=${nextEvening.id}` : ""}`} variant="secondary" className="shrink-0">
              <Gavel size={18} aria-hidden /> Strafe eintragen
            </LinkButton>
          )}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          {nextEvening ? (
            <NextEveningBoard event={nextEvening} counts={counts.get(nextEvening.id)!} myStatus={mine.get(nextEvening.id) ?? null} />
          ) : (
            <EmptyState
              title="Noch keine Kegelabende geplant."
              action={isAdmin ? <LinkButton href="/termine/neu?art=KEGELABEND"><Plus size={18} aria-hidden /> Kegelabend erstellen</LinkButton> : undefined}
            />
          )}

          <Card>
            <CardTitle action={<Link href="/events" className="text-sm text-messing-hell hover:underline">Alle</Link>}>Nächste Events</CardTitle>
            {upcomingEvents.length === 0 ? (
              <p className="text-kreide-dim">Keine Events geplant.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcomingEvents.map((e) => (
                  <EventCard key={e.id} event={e} counts={counts.get(e.id)} myStatus={mine.get(e.id) ?? null} />
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle action={<Link href="/statistik" className="text-sm text-messing-hell hover:underline">Rangliste</Link>}>
              <span className="flex items-center gap-2"><Trophy size={20} className="text-messing" aria-hidden /> Rangliste {year}</span>
            </CardTitle>
            {board.length === 0 ? (
              <p className="text-kreide-dim">Noch keine Spiele gewertet.</p>
            ) : (
              <ol className="flex flex-col">
                {board.slice(0, 5).map((r) => (
                  <li key={r.userId} className="flex min-h-12 items-center gap-3 border-b border-eiche/50 last:border-0">
                    <span className="w-6 text-center font-display text-xl font-bold text-messing tabular-nums">{r.position}</span>
                    <Avatar person={r} size="sm" />
                    <span className={r.userId === user.id ? "flex-1 font-semibold text-messing-hell" : "flex-1"}>{r.displayName}</span>
                    <span className="font-display font-bold tabular-nums">{r.points} Pkt.</span>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardTitle>Deine letzten Ergebnisse</CardTitle>
            {recent.length === 0 ? (
              <p className="text-kreide-dim">Noch keine Ergebnisse – ab auf die Bahn!</p>
            ) : (
              <ul className="flex flex-col">
                {recent.map((r) => (
                  <li key={r.sessionId}>
                    <Link href={`/spielrunden/${r.sessionId}`} className="flex min-h-12 items-center justify-between gap-3 border-b border-eiche/50 py-1 last:border-0">
                      <span>
                        <span className="block font-medium">{r.gameName}</span>
                        <span className="block text-xs text-kreide-dim">{formatDate(r.startsAt)}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-display font-bold">{r.rank ? `${r.rank}. Platz` : "–"}</span>
                        <span className="block text-xs text-kreide-dim">{r.score ?? "–"} {r.scoreLabel}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Link href="/strafen" className="block">
            <Card className="flex items-center gap-4 hover:border-messing/50">
              <Gavel size={28} className="text-messing" aria-hidden />
              <div className="flex-1">
                <p className="font-display text-lg font-bold">Deine Strafen</p>
                <p className="text-kreide-dim">
                  {penalties.count === 0 ? "Keine offenen Strafen – vorbildlich!" : `${penalties.count} offen · ${formatEuro(penalties.totalCents)}`}
                </p>
              </div>
            </Card>
          </Link>

          {birthdays.length > 0 && (
            <Card>
              <CardTitle><span className="flex items-center gap-2"><Cake size={20} className="text-messing" aria-hidden /> Geburtstage</span></CardTitle>
              <ul className="flex flex-col gap-2">
                {birthdays.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <Avatar person={m} size="sm" />
                    <span className="flex-1">{displayName(m)}</span>
                    <span className="text-sm text-kreide-dim">{m.next === today ? "Heute! 🎉" : formatYmd(m.next).slice(0, 6)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {isAdmin && (
            <LinkButton href="/verwaltung" variant="ghost" className="justify-start">
              <UserPlus size={18} aria-hidden /> Mitglieder & Einstellungen verwalten
            </LinkButton>
          )}
        </div>
      </div>
    </div>
  );
}
