import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cake, ChevronRight, Gavel, PiggyBank, Plus, Trophy, UserPlus, Wallet, type LucideIcon } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatEuro, displayName } from "@/lib/format";
import { formatYmd, nextBirthday, toYmd, addDaysYmd } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import {
  getMyParticipation,
  getNextEvent,
  getParticipationCounts,
  listEvents,
  upcomingThreshold,
} from "@/server/services/events";
import { getEveningsAttended } from "@/server/services/stats";
import { getCashSummary } from "@/server/services/cash";
import { getOpenPenaltySummary } from "@/server/services/penalties";
import { getOpenDuesSummary } from "@/server/services/dues";
import { countPendingRegistrations, listMembers } from "@/server/services/users";
import { NextEveningBoard } from "@/components/events/next-evening-board";
import { EventCard } from "@/components/events/event-card";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Start" };

/** Kompakte Kachel mit Symbol, Titel und einer Zeile Status – führt zur Detailseite. */
function QuickLink({ href, Icon, title, alert = false, children }: { href: string; Icon: LucideIcon; title: string; alert?: boolean; children: ReactNode }) {
  return (
    <Link href={href} className="block">
      <Card className="flex items-center gap-4 hover:border-messing/50">
        <Icon size={28} className="shrink-0 text-messing" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold">{title}</p>
          <p className={alert ? "text-absage" : "text-kreide-dim"}>{children}</p>
        </div>
        <ChevronRight size={20} className="shrink-0 text-kreide-dim" aria-hidden />
      </Card>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const isAdmin = hasPermission(user, "events:manage");
  const isKassenwart = hasPermission(user, "penalties:manage");
  const year = new Date().getFullYear();

  const showDues = hasPermission(user, "dues:view-own");
  const showCash = hasPermission(user, "cash:view");
  const [nextEvening, upcomingEvents, penalties, pending, members, dues, cash, attended] = await Promise.all([
    getNextEvent("KEGELABEND"),
    listEvents({ kind: "EVENT", from: upcomingThreshold(), limit: 3, includeCancelled: false }),
    getOpenPenaltySummary(user.id),
    isAdmin ? countPendingRegistrations() : Promise.resolve(0),
    listMembers(),
    showDues ? getOpenDuesSummary(user.id) : Promise.resolve({ count: 0, totalCents: 0 }),
    showCash ? getCashSummary(user) : Promise.resolve(null),
    getEveningsAttended(user.id, year),
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
        <div className="flex gap-2">
          {isAdmin && (
            <LinkButton href="/termine/neu?art=KEGELABEND" variant="secondary" className="min-h-16 min-w-0 flex-1 flex-col gap-1 px-1 text-sm">
              <Plus size={20} className="shrink-0" aria-hidden /><span className="truncate">Kegelabend</span>
            </LinkButton>
          )}
          {isAdmin && (
            <LinkButton href="/termine/neu?art=EVENT" variant="secondary" className="min-h-16 min-w-0 flex-1 flex-col gap-1 px-1 text-sm">
              <Plus size={20} className="shrink-0" aria-hidden /><span className="truncate">Event</span>
            </LinkButton>
          )}
          {isKassenwart && (
            <LinkButton href="/strafen" variant="secondary" className="min-h-16 min-w-0 flex-1 flex-col gap-1 px-1 text-sm">
              <Gavel size={20} className="shrink-0" aria-hidden /><span className="truncate">Strafe</span>
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
          <QuickLink href="/strafen" Icon={Gavel} title="Deine Strafen" alert={penalties.count > 0}>
            {penalties.count === 0 ? "Keine offenen Strafen – vorbildlich!" : `${penalties.count} offen · ${formatEuro(penalties.totalCents)}`}
          </QuickLink>

          {dues.count > 0 && (
            <QuickLink href="/beitraege" Icon={Wallet} title="Deine Beiträge" alert>
              {dues.count === 1 ? "1 Monat" : `${dues.count} Monate`} offen · {formatEuro(dues.totalCents)}
            </QuickLink>
          )}

          {cash && (
            <QuickLink href="/strafen?ansicht=kasse" Icon={PiggyBank} title="Kasse">
              {formatEuro(cash.balanceCents)} in der Kasse
            </QuickLink>
          )}

          <QuickLink href="/statistik?ansicht=anwesenheit" Icon={Trophy} title={`Deine Kegelabende ${year}`}>
            {attended === 0 ? "Noch keiner – ab auf die Bahn!" : attended === 1 ? "1-mal dabei gewesen" : `${attended}-mal dabei gewesen`}
          </QuickLink>

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
