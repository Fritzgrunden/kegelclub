import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, ChevronDown } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatEuro } from "@/lib/format";
import { formatYmd } from "@/lib/dates";
import { requireUser } from "@/server/auth/session";
import { getOpenPenaltySummary, getOpenTotalsByMember, listPenalties, listPenaltyTypes } from "@/server/services/penalties";
import { listMembers } from "@/server/services/users";
import { markAllPaidAction, togglePenaltyPaidAction } from "@/server/actions/penalties";
import { PenaltyList } from "@/components/penalties/penalty-list";
import { QuickPenaltyBoard } from "@/components/penalties/quick-penalty-board";
import { MemberFilter } from "@/components/penalties/member-filter";
import { ActionButton } from "@/components/ui/action-button";
import { PageHeader } from "@/components/ui/page-header";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Strafen" };

type View = "eintragen" | "offen" | "verlauf";

function Tally({ totalCents, label }: { totalCents: number; label: string }) {
  return (
    <section className="tafel mb-5 rounded-md p-5 text-center">
      <p className="text-sm text-kreide-dim">Offen</p>
      <p className="kreide font-display text-5xl font-bold tabular-nums">{formatEuro(totalCents)}</p>
      <p className="mt-1 text-kreide-dim">{label}</p>
    </section>
  );
}

export default async function PenaltiesPage({
  searchParams,
}: {
  searchParams: Promise<{ ansicht?: string; mitglied?: string; filter?: string; gespeichert?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const manage = hasPermission(user, "penalties:manage");
  const viewAll = hasPermission(user, "penalties:view-all");
  const catalogButton = (
    <LinkButton href="/strafen/katalog" variant="secondary" size="sm">
      <BookOpen size={16} aria-hidden /> {hasPermission(user, "penalty-catalog:manage") ? "Strafarten & Beträge" : "Strafkatalog"}
    </LinkButton>
  );

  /* ───── Ansicht für Mitglieder: nur eigene Strafen ───── */
  if (!viewAll) {
    const [items, summary] = await Promise.all([listPenalties(user), getOpenPenaltySummary(user.id)]);
    return (
      <>
        <PageHeader title="Meine Strafen" actions={catalogButton} />
        <Tally totalCents={summary.totalCents} label={summary.count === 1 ? "1 offene Strafe" : `${summary.count} offene Strafen`} />
        {items.length === 0 ? <EmptyState title="Keine Strafen – weiter so!" /> : <PenaltyList items={items} manage={false} showMember={false} />}
      </>
    );
  }

  /* ───── Ansicht für Kassenwart / Leser aller Strafen ───── */
  const requested = sp.ansicht as View | undefined;
  const view: View = requested === "offen" || requested === "verlauf" || (requested === "eintragen" && manage) ? requested : manage ? "eintragen" : "offen";
  const openOnly = sp.filter === "offen";

  const [totals, members, types, items] = await Promise.all([
    getOpenTotalsByMember(user),
    view === "offen" ? Promise.resolve([]) : listMembers(),
    view === "eintragen" ? listPenaltyTypes() : Promise.resolve([]),
    view === "offen"
      ? listPenalties(user, { openOnly: true })
      : view === "verlauf"
        ? listPenalties(user, { userId: sp.mitglied, openOnly, limit: 200 })
        : Promise.resolve([]),
  ]);
  const openSum = totals.reduce((s, t) => s + t.total, 0);
  const openCount = totals.reduce((s, t) => s + t.n, 0);

  const tabs = [
    ...(manage ? [{ href: "/strafen", label: "Eintragen", active: view === "eintragen" }] : []),
    { href: "/strafen?ansicht=offen", label: "Offen", active: view === "offen", count: totals.length },
    { href: "/strafen?ansicht=verlauf", label: "Verlauf", active: view === "verlauf" },
  ];

  return (
    <>
      <PageHeader title="Strafen" actions={catalogButton} />
      {sp.gespeichert && <Alert tone="success" className="mb-4">Strafe eingetragen.</Alert>}
      <Tabs items={tabs} />

      {view === "eintragen" && (
        <>
          <p className="mb-3 text-sm text-kreide-dim">
            Mitglied antippen, dann Strafe wählen oder eigenen Titel und Betrag eingeben. Datum und heutiger Termin werden automatisch gesetzt.
          </p>
          {types.length === 0 && (
            <Alert className="mb-4">
              Tipp: Häufige Strafen einmal im{" "}
              <Link href="/strafen/katalog" className="font-semibold underline underline-offset-4">Strafkatalog</Link>{" "}
              anlegen – dann reichen zwei Taps.
            </Alert>
          )}
          <QuickPenaltyBoard
            members={members.map((m) => ({
              id: m.id,
              displayName: m.displayName,
              firstName: m.firstName,
              lastName: m.lastName,
              avatarImageId: m.avatarImageId,
              openCents: totals.find((t) => t.userId === m.id)?.total ?? 0,
            }))}
            types={types.map((t) => ({ id: t.id, name: t.name, amountCents: t.amountCents }))}
            canEditCatalog={hasPermission(user, "penalty-catalog:manage")}
          />
        </>
      )}

      {view === "offen" && (
        <>
          <Tally totalCents={openSum} label={`${openCount === 1 ? "1 Strafe" : `${openCount} Strafen`} bei ${totals.length === 1 ? "1 Mitglied" : `${totals.length} Mitgliedern`}`} />
          {totals.length === 0 ? (
            <EmptyState title="Alles bezahlt!" />
          ) : (
            <ul className="flex flex-col gap-2">
              {totals.map((t) => {
                const mine = items.filter((p) => p.userId === t.userId);
                return (
                  <li key={t.userId}>
                    <details className="group rounded-2xl border border-eiche/70 bg-theke">
                      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-3 py-2 [&::-webkit-details-marker]:hidden">
                        <Avatar person={t} size="md" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{t.displayName}</span>
                          <span className="block text-xs text-kreide-dim">{t.n === 1 ? "1 Strafe" : `${t.n} Strafen`}</span>
                        </span>
                        <span className="font-display text-xl font-bold tabular-nums text-absage">{formatEuro(t.total)}</span>
                        <ChevronDown size={18} className="shrink-0 text-kreide-dim transition-transform group-open:rotate-180" aria-hidden />
                      </summary>
                      <div className="border-t border-eiche/50 px-3 pb-3">
                        <ul>
                          {mine.map((p) => (
                            <li key={p.id} className="flex min-h-14 items-center gap-3 border-b border-eiche/40 last:border-0">
                              <span className="min-w-0 flex-1">
                                <span className="block truncate">{p.label}</span>
                                <span className="block text-xs text-kreide-dim">{formatYmd(p.date)}</span>
                              </span>
                              <span className="font-display font-bold tabular-nums">{formatEuro(p.amountCents)}</span>
                              {manage && (
                                <ActionButton action={togglePenaltyPaidAction} fields={{ id: p.id, paid: "1" }} variant="secondary" size="sm" ariaLabel={`${p.label} bezahlt`}>
                                  Bezahlt
                                </ActionButton>
                              )}
                            </li>
                          ))}
                        </ul>
                        {manage && (
                          <ActionButton
                            action={markAllPaidAction}
                            fields={{ userId: t.userId }}
                            variant="zusage"
                            size="lg"
                            className="mt-3 w-full"
                            confirm={{
                              title: `${t.displayName} zahlt ${formatEuro(t.total)}?`,
                              text: t.n === 1 ? "Die offene Strafe wird als bezahlt markiert." : `Alle ${t.n} offenen Strafen werden als bezahlt markiert.`,
                              confirmLabel: "Bezahlt",
                            }}
                          >
                            Alles bezahlt · {formatEuro(t.total)}
                          </ActionButton>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {view === "verlauf" && (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <MemberFilter
              members={members.map((m) => ({ id: m.id, displayName: m.displayName }))}
              value={sp.mitglied ?? ""}
              baseHref={`/strafen?ansicht=verlauf${openOnly ? "&filter=offen" : ""}`}
              className="sm:max-w-xs"
            />
            <div className="flex gap-2">
              {[
                { label: "Alle", on: !openOnly, f: "" },
                { label: "Nur offene", on: openOnly, f: "&filter=offen" },
              ].map((c) => (
                <Link
                  key={c.label}
                  href={`/strafen?ansicht=verlauf${c.f}${sp.mitglied ? `&mitglied=${sp.mitglied}` : ""}`}
                  scroll={false}
                  className={cn(
                    "flex min-h-11 flex-1 items-center justify-center rounded-full border px-4 text-sm sm:flex-none",
                    c.on ? "border-messing bg-messing/15 text-messing-hell" : "border-eiche text-kreide-dim",
                  )}
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>
          {items.length === 0 ? (
            <EmptyState title="Keine Strafen gefunden." />
          ) : (
            <>
              <p className="mb-2 text-sm text-kreide-dim">
                {items.length === 1 ? "1 Strafe" : `${items.length} Strafen`} · {formatEuro(items.reduce((s, p) => s + p.amountCents, 0))}
                {manage && " · Antippen zum Bearbeiten"}
              </p>
              <PenaltyList items={items} manage={manage} showMember={!sp.mitglied} />
            </>
          )}
        </>
      )}

      {view === "eintragen" && totals.length > 0 && (
        <Card className="mt-5 flex items-center justify-between gap-3">
          <span className="text-kreide-dim">Offen gesamt</span>
          <Link href="/strafen?ansicht=offen" className="font-display text-xl font-bold tabular-nums text-messing-hell hover:underline">
            {formatEuro(openSum)} →
          </Link>
        </Card>
      )}
    </>
  );
}
