import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cake, Gavel, Mail, Phone, Plus, Settings } from "lucide-react";
import { hasPermission, MEMBER_ROLE } from "@/lib/permissions";
import { formatDate, formatYmd, toYmd } from "@/lib/dates";
import { formatEuro } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { canSeePrivateData, getMember } from "@/server/services/users";
import { listParticipationsOfUser } from "@/server/services/events";
import { getEveningsAttended } from "@/server/services/stats";
import { getPenaltyStats, listPenalties } from "@/server/services/penalties";
import { getAdvancesOfUser } from "@/server/services/cash";
import { CashEntryForm } from "@/components/cash/cash-entry-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/ui/stat";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mitglied" };

export default async function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireUser();
  const { id } = await params;
  const member = await getMember(id);
  if (!member || (member.status === "AUSSTEHEND" && !hasPermission(viewer, "members:manage"))) notFound();

  const isSelf = viewer.id === id;
  const showPrivate = canSeePrivateData(viewer, id);
  const showPenalties = isSelf || hasPermission(viewer, "penalties:view-all");
  const showAdvances = isSelf || hasPermission(viewer, "cash:view");
  const canPenalize = hasPermission(viewer, "penalties:manage");
  const canAdvance = hasPermission(viewer, "cash:manage");
  const name = member.nickname || `${member.firstName} ${member.lastName}`;

  const year = new Date().getFullYear();
  const [eveningsYear, eveningsAll, upcoming, past, penalties, penaltyStats, advances] = await Promise.all([
    getEveningsAttended(id, year),
    getEveningsAttended(id),
    listParticipationsOfUser(id, { past: false, limit: 5 }),
    listParticipationsOfUser(id, { past: true, limit: 5 }),
    showPenalties ? listPenalties(viewer, { userId: id, limit: 20 }) : Promise.resolve([]),
    hasPermission(viewer, "penalties:view-all") ? getPenaltyStats(viewer) : Promise.resolve(null),
    showAdvances ? getAdvancesOfUser(viewer, id) : Promise.resolve(null),
  ]);
  const openTotal = penalties.filter((p) => !p.paidAt).reduce((s, p) => s + p.amountCents - p.creditCents, 0);
  const sinner = penaltyStats?.members.find((m) => m.userId === id);
  const sinnerRank = sinner ? penaltyStats!.members.indexOf(sinner) + 1 : null;

  return (
    <>
      <PageHeader
        title={name}
        back="/mitglieder"
        actions={
          hasPermission(viewer, "members:manage") ? (
            <LinkButton href={`/verwaltung/mitglieder/${id}`} variant="secondary"><Settings size={18} aria-hidden /> Verwalten</LinkButton>
          ) : isSelf ? (
            <LinkButton href="/profil" variant="secondary">Profil bearbeiten</LinkButton>
          ) : undefined
        }
      />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <Card className="flex flex-col gap-3 lg:items-center lg:text-center">
          <div className="flex items-center gap-4 lg:flex-col lg:gap-3">
            <Avatar person={member} size="lg" className="lg:size-28 lg:text-3xl" />
            <div className="min-w-0">
              <p className="font-display text-xl font-bold">{member.firstName} {member.lastName}</p>
              {member.nickname && <p className="text-kreide-dim">„{member.nickname}“</p>}
              <div className="mt-1.5 flex flex-wrap gap-1.5 lg:justify-center">
                {member.roles.map((r) => <Badge key={r.key} tone={r.key === MEMBER_ROLE ? "neutral" : "messing"}>{r.name}</Badge>)}
              </div>
            </div>
          </div>
          <ul className="flex w-full flex-col gap-2 text-left text-sm empty:hidden">
            {member.birthday && <li className="flex items-center gap-2"><Cake size={16} className="text-messing" aria-hidden /> {showPrivate ? formatYmd(member.birthday) : formatYmd(member.birthday).slice(0, 6)}</li>}
            {showPrivate && <li className="flex items-center gap-2 break-all"><Mail size={16} className="shrink-0 text-messing" aria-hidden /> {member.email}</li>}
            {showPrivate && member.phone && <li className="flex items-center gap-2"><Phone size={16} className="text-messing" aria-hidden /> {member.phone}</li>}
          </ul>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle>Statistik</CardTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat value={eveningsYear} label={`Kegelabende ${year}`} />
              <Stat value={eveningsAll} label="Kegelabende gesamt" />
              {penaltyStats && (
                <>
                  <Stat value={sinner?.count ?? 0} label="Strafen gesamt" />
                  <Stat value={sinnerRank ? `${sinnerRank}.` : "–"} label="in der Sünderkartei" />
                </>
              )}
            </div>
            {sinner?.favorite && (
              <p className="mt-3 text-sm text-kreide-dim">
                Lieblingsstrafe: <span className="text-kreide">{sinner.favorite.label}</span> ({sinner.favorite.count}×) · zusammen {formatEuro(sinner.totalCents)}
              </p>
            )}
          </Card>

          {showPenalties && (
            <Card>
              <CardTitle action={openTotal > 0 ? <Badge tone="absage">offen: {formatEuro(openTotal)}</Badge> : undefined}>Strafen</CardTitle>
              {canPenalize && (
                <LinkButton href={`/strafen/neu?mitglied=${id}`} variant="secondary" className="mb-3 w-full">
                  <Gavel size={18} aria-hidden /> Strafe für {name} eintragen
                </LinkButton>
              )}
              {penalties.length === 0 ? <p className="text-kreide-dim">Keine Strafen.</p> : (
                <ul className="flex flex-col">
                  {penalties.map((p) => (
                    <li key={p.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-eiche/50 py-1 last:border-0">
                      <span><span className="block">{p.label}</span><span className="block text-xs text-kreide-dim">{formatYmd(p.date)}{p.eventTitle ? ` · ${p.eventTitle}` : ""}</span></span>
                      <span className="text-right"><span className="block font-display font-bold tabular-nums">{formatEuro(p.amountCents)}</span>{p.paidAt ? <Badge tone="zusage">bezahlt</Badge> : <Badge tone="absage">offen</Badge>}</span>
                    </li>
                  ))}
                </ul>
              )}

          {advances && (
            <Card>
              <CardTitle action={advances.creditCents > 0 ? <Badge tone="zusage">Guthaben: {formatEuro(advances.creditCents)}</Badge> : undefined}>Auslagen</CardTitle>
              {canAdvance && (
                <details className="group mb-3 rounded-xl border border-messing/50">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 px-3 font-semibold text-messing-hell [&::-webkit-details-marker]:hidden">
                    <Plus size={18} aria-hidden /> {name} hat etwas ausgelegt
                  </summary>
                  <div className="border-t border-eiche/60 p-3">
                    <CashEntryForm today={toYmd(new Date())} advancedBy={{ id, displayName: name }} />
                  </div>
                </details>
              )}
              {advances.entries.length === 0 ? (
                <p className="text-kreide-dim">Noch nichts für den Club ausgelegt.</p>
              ) : (
                <ul className="flex flex-col">
                  {advances.entries.map((e) => (
                    <li key={e.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-eiche/50 py-1 last:border-0">
                      <span className="min-w-0"><span className="block truncate">{e.description}</span><span className="block text-xs text-kreide-dim">{formatYmd(e.date)}</span></span>
                      <span className="shrink-0 font-display font-bold tabular-nums">{formatEuro(e.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {advances.creditCents > 0 && <p className="mt-2 text-sm text-kreide-dim">Das Guthaben wird automatisch mit den nächsten Strafen verrechnet.</p>}
            </Card>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Card>
              <CardTitle>Kommende Teilnahmen</CardTitle>
              {upcoming.length === 0 ? <p className="text-kreide-dim">Keine Zusagen.</p> : (
                <ul className="flex flex-col gap-1">
                  {upcoming.map((e) => <li key={e.id}><Link href={`/termine/${e.id}`} className="flex min-h-11 items-center justify-between hover:text-messing-hell"><span>{e.title}</span><span className="text-sm text-kreide-dim">{formatDate(e.startsAt)}</span></Link></li>)}
                </ul>
              )}
            </Card>
            <Card>
              <CardTitle>Vergangene Abende</CardTitle>
              {past.length === 0 ? <p className="text-kreide-dim">Noch keine.</p> : (
                <ul className="flex flex-col gap-1">
                  {past.map((e) => <li key={e.id}><Link href={`/termine/${e.id}`} className="flex min-h-11 items-center justify-between hover:text-messing-hell"><span>{e.title}</span><span className="text-sm text-kreide-dim">{formatDate(e.startsAt)}</span></Link></li>)}
                </ul>
              )}
            </Card>
          </div>

            </Card>
          )}
        </div>
      </div>
    </>
  );
}
