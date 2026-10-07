import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cake, Mail, Phone, Settings } from "lucide-react";
import { hasPermission, ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatYmd } from "@/lib/dates";
import { formatEuro } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { canSeePrivateData, getMember } from "@/server/services/users";
import { listParticipationsOfUser } from "@/server/services/events";
import { getPersonalStats, getRecentResults } from "@/server/services/stats";
import { listPenalties } from "@/server/services/penalties";
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

  const [stats, recent, upcoming, past, penalties] = await Promise.all([
    getPersonalStats(id),
    getRecentResults(id, 8),
    listParticipationsOfUser(id, { past: false, limit: 5 }),
    listParticipationsOfUser(id, { past: true, limit: 5 }),
    showPenalties ? listPenalties(viewer, { userId: id, limit: 20 }) : Promise.resolve([]),
  ]);
  const openTotal = penalties.filter((p) => !p.paidAt).reduce((s, p) => s + p.amountCents, 0);

  return (
    <>
      <PageHeader
        title={member.nickname || `${member.firstName} ${member.lastName}`}
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
        <Card className="flex flex-col items-center gap-3 text-center">
          <Avatar person={member} size="xl" />
          <div>
            <p className="font-display text-xl font-bold">{member.firstName} {member.lastName}</p>
            {member.nickname && <p className="text-kreide-dim">„{member.nickname}“</p>}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {member.roles.map((r) => <Badge key={r} tone={r === "MITGLIED" ? "neutral" : "messing"}>{ROLE_LABELS[r]}</Badge>)}
          </div>
          <ul className="mt-2 flex w-full flex-col gap-2 text-left text-sm">
            {member.birthday && <li className="flex items-center gap-2"><Cake size={16} className="text-messing" aria-hidden /> {showPrivate ? formatYmd(member.birthday) : formatYmd(member.birthday).slice(0, 6)}</li>}
            {showPrivate && <li className="flex items-center gap-2 break-all"><Mail size={16} className="shrink-0 text-messing" aria-hidden /> {member.email}</li>}
            {showPrivate && member.phone && <li className="flex items-center gap-2"><Phone size={16} className="text-messing" aria-hidden /> {member.phone}</li>}
          </ul>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle>Statistik (gesamt)</CardTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat value={stats.eveningsAttended} label="Kegelabende" />
              <Stat value={stats.gamesPlayed} label="Spiele" />
              <Stat value={stats.wins} label="Siege" />
              <Stat value={stats.points} label="Ranglistenpunkte" />
            </div>
            {stats.bestByGame.length > 0 && (
              <>
                <h3 className="mb-2 mt-5 font-display font-bold">Persönliche Bestleistungen</h3>
                <ul className="flex flex-col">
                  {stats.bestByGame.map((b) => (
                    <li key={b.gameName} className="flex min-h-11 items-center justify-between border-b border-eiche/50 last:border-0">
                      <span>{b.gameName}</span>
                      <span className="font-display font-bold tabular-nums">{b.score} <span className="text-sm font-normal text-kreide-dim">{b.scoreLabel}</span></span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <CardTitle>Letzte Ergebnisse</CardTitle>
            {recent.length === 0 ? <p className="text-kreide-dim">Noch keine Ergebnisse.</p> : (
              <ul className="flex flex-col">
                {recent.map((r) => (
                  <li key={r.sessionId}>
                    <Link href={`/spielrunden/${r.sessionId}`} className="flex min-h-12 items-center justify-between gap-3 border-b border-eiche/50 py-1 last:border-0">
                      <span><span className="block">{r.gameName}</span><span className="block text-xs text-kreide-dim">{formatDate(r.startsAt)}</span></span>
                      <span className="text-right font-display font-bold">{r.rank ? `${r.rank}.` : "–"} <span className="text-sm font-normal text-kreide-dim">({r.score ?? "–"} {r.scoreLabel})</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

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

          {showPenalties && (
            <Card>
              <CardTitle action={openTotal > 0 ? <Badge tone="absage">offen: {formatEuro(openTotal)}</Badge> : undefined}>Strafen</CardTitle>
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
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
