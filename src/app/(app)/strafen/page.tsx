import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Plus } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatEuro } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { getOpenPenaltySummary, getOpenTotalsByMember, listPenalties, listPenaltyTypes } from "@/server/services/penalties";
import { listMembers } from "@/server/services/users";
import { markAllPaidAction } from "@/server/actions/penalties";
import { PenaltyList } from "@/components/penalties/penalty-list";
import { QuickPenaltyBoard } from "@/components/penalties/quick-penalty-board";
import { ActionButton } from "@/components/ui/action-button";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Strafen" };

export default async function PenaltiesPage({ searchParams }: { searchParams: Promise<{ mitglied?: string; filter?: string; gespeichert?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const manage = hasPermission(user, "penalties:manage");
  const viewAll = hasPermission(user, "penalties:view-all");
  const openOnly = sp.filter === "offen";

  if (!viewAll) {
    const [items, summary] = await Promise.all([listPenalties(user), getOpenPenaltySummary(user.id)]);
    return (
      <>
        <PageHeader title="Meine Strafen" actions={<LinkButton href="/strafen/katalog" variant="secondary"><BookOpen size={18} aria-hidden /> Strafkatalog</LinkButton>} />
        <section className="tafel mb-5 rounded-md p-5 text-center">
          <p className="text-sm text-kreide-dim">Offen</p>
          <p className="kreide font-display text-5xl font-bold tabular-nums">{formatEuro(summary.totalCents)}</p>
          <p className="mt-1 text-kreide-dim">{summary.count === 1 ? "1 offene Strafe" : `${summary.count} offene Strafen`}</p>
        </section>
        {items.length === 0 ? <EmptyState title="Keine Strafen – weiter so!" /> : <PenaltyList items={items} manage={false} showMember={false} />}
      </>
    );
  }

  const [items, totals, members, types] = await Promise.all([
    listPenalties(user, { userId: sp.mitglied, openOnly }),
    getOpenTotalsByMember(user),
    manage ? listMembers() : Promise.resolve([]),
    manage ? listPenaltyTypes() : Promise.resolve([]),
  ]);
  const openByMember = new Map(totals.map((t) => [t.userId, t.total]));
  const filterHref = (f: string | null) => {
    const q = new URLSearchParams();
    if (sp.mitglied) q.set("mitglied", sp.mitglied);
    if (f) q.set("filter", f);
    const s = q.toString();
    return `/strafen${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Strafen"
        subtitle={manage ? "Kassenwart-Bereich" : "Übersicht (nur lesen)"}
        actions={
          <>
            <LinkButton href="/strafen/katalog" variant="secondary"><BookOpen size={18} aria-hidden /> Katalog</LinkButton>
            {manage && <LinkButton href="/strafen/neu" variant="secondary"><Plus size={18} aria-hidden /> Ausführlich</LinkButton>}
          </>
        }
      />
      {sp.gespeichert && <Alert tone="success" className="mb-4">Strafe eingetragen.</Alert>}

      {manage && (
        <Card className="mb-5">
          <CardTitle>Strafe eintragen</CardTitle>
          {types.length === 0 ? (
            <Alert>
              Lege zuerst den <Link href="/strafen/katalog" className="font-semibold underline underline-offset-4">Strafkatalog</Link> an –
              danach trägst du Strafen hier mit zwei Taps ein.
            </Alert>
          ) : (
            <>
              <p className="mb-3 text-sm text-kreide-dim">Mitglied antippen, Strafart wählen – fertig. Datum und heutiger Termin werden automatisch gesetzt.</p>
              <QuickPenaltyBoard
                members={members.map((m) => ({
                  id: m.id,
                  displayName: m.displayName,
                  firstName: m.firstName,
                  lastName: m.lastName,
                  avatarImageId: m.avatarImageId,
                  openCents: openByMember.get(m.id) ?? 0,
                }))}
                types={types.map((t) => ({ id: t.id, name: t.name, amountCents: t.amountCents }))}
              />
            </>
          )}
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="order-last lg:order-none">
          <h2 className="mb-3 font-display text-xl font-bold">Verlauf</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Link href={filterHref(null)} className={cn("flex min-h-10 items-center rounded-full border px-4 text-sm", !openOnly ? "border-messing bg-messing/15 text-messing-hell" : "border-eiche text-kreide-dim")}>Alle</Link>
            <Link href={filterHref("offen")} className={cn("flex min-h-10 items-center rounded-full border px-4 text-sm", openOnly ? "border-messing bg-messing/15 text-messing-hell" : "border-eiche text-kreide-dim")}>Nur offene</Link>
            {sp.mitglied && <Link href={openOnly ? "/strafen?filter=offen" : "/strafen"} className="min-h-10 px-2 text-sm text-messing-hell hover:underline">Mitgliederfilter aufheben ✕</Link>}
          </div>
          {items.length === 0 ? (
            <EmptyState title="Keine Strafen gefunden." action={manage ? <LinkButton href="/strafen/neu"><Plus size={18} aria-hidden /> Strafe eintragen</LinkButton> : undefined} />
          ) : (
            <PenaltyList items={items} manage={manage} showMember />
          )}
        </div>
        <Card className="h-fit">
          <CardTitle>Offen je Mitglied</CardTitle>
          {totals.length === 0 ? <p className="text-kreide-dim">Alles bezahlt.</p> : (
            <ul className="flex flex-col">
              {totals.map((t) => (
                <li key={t.userId} className="flex min-h-14 items-center gap-2 border-b border-eiche/50 last:border-0">
                  <Link href={`/strafen?mitglied=${t.userId}`} className="flex min-h-12 min-w-0 flex-1 items-center gap-3">
                    <Avatar person={t} size="sm" />
                    <span className="flex-1 truncate">{t.displayName}</span>
                    <span className="text-xs text-kreide-dim">{t.n}×</span>
                    <span className="font-display font-bold tabular-nums">{formatEuro(t.total)}</span>
                  </Link>
                  {manage && (
                    <ActionButton
                      action={markAllPaidAction}
                      fields={{ userId: t.userId }}
                      variant="zusage"
                      size="sm"
                      ariaLabel={`Alle Strafen von ${t.displayName} bezahlt`}
                      confirm={{
                        title: `${t.displayName} zahlt ${formatEuro(t.total)}?`,
                        text: t.n === 1 ? "Die offene Strafe wird als bezahlt markiert." : `Alle ${t.n} offenen Strafen werden als bezahlt markiert.`,
                        confirmLabel: "Bezahlt",
                      }}
                    >
                      Bezahlt
                    </ActionButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-eiche/60 pt-3 text-right font-display text-lg font-bold">
            Summe: {formatEuro(totals.reduce((s, t) => s + t.total, 0))}
          </p>
        </Card>
      </div>
    </>
  );
}
