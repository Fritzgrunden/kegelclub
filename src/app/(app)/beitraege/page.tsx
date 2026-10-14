import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { formatMonth } from "@/lib/dates";
import { centsToInput, formatEuro } from "@/lib/format";
import { monthSchema } from "@/lib/validation";
import { requireUser } from "@/server/auth/session";
import {
  currentMonth,
  getDuesDefaultCents,
  getDuesMonth,
  getOpenDuesByMember,
  getOpenDuesSummary,
  listOwnDues,
  shiftMonth,
} from "@/server/services/dues";
import {
  createDuesForMonthAction,
  deleteDuesAction,
  markAllDuesPaidAction,
  saveDuesSettingsAction,
  toggleDuesPaidAction,
} from "@/server/actions/dues";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Beiträge" };

export default async function DuesPage({ searchParams }: { searchParams: Promise<{ monat?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const viewAll = hasPermission(user, "dues:view-all");
  const manage = hasPermission(user, "dues:manage");

  if (!viewAll) {
    if (!hasPermission(user, "dues:view-own")) redirect("/kein-zugriff");
    const [items, summary] = await Promise.all([listOwnDues(user), getOpenDuesSummary(user.id)]);
    return (
      <>
        <PageHeader title="Meine Beiträge" />
        <section className="tafel mb-5 rounded-md p-5 text-center">
          <p className="text-sm text-kreide-dim">Offen</p>
          <p className="kreide font-display text-5xl font-bold tabular-nums">{formatEuro(summary.totalCents)}</p>
          <p className="mt-1 text-kreide-dim">{summary.count === 1 ? "1 offener Monat" : `${summary.count} offene Monate`}</p>
        </section>
        {items.length === 0 ? (
          <EmptyState title="Noch keine Beiträge eingetragen." />
        ) : (
          <Card>
            <ul className="flex flex-col">
              {items.map((d) => (
                <li key={d.id} className="flex min-h-14 items-center justify-between gap-3 border-b border-eiche/50 last:border-0">
                  <span>{formatMonth(d.month)}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-display font-bold tabular-nums">{formatEuro(d.amountCents)}</span>
                    {d.paidAt ? <Badge tone="zusage">bezahlt</Badge> : <Badge tone="absage">offen</Badge>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </>
    );
  }

  const month = monthSchema.safeParse(sp.monat).success ? sp.monat! : currentMonth();
  const [rows, totals, defaultCents] = await Promise.all([getDuesMonth(user, month), getOpenDuesByMember(user), getDuesDefaultCents()]);
  const effective = (r: (typeof rows)[number]) => r.overrideCents ?? defaultCents;
  const withEntry = rows.filter((r) => r.entry);
  const paid = withEntry.filter((r) => r.entry!.paidAt);
  const missing = rows.filter((r) => !r.entry && effective(r) > 0);
  const openThisMonth = withEntry.filter((r) => !r.entry!.paidAt).reduce((s, r) => s + r.entry!.amountCents, 0);
  const unconfigured = defaultCents === 0 && rows.every((r) => r.overrideCents === null);

  const settingsForm = (
    <>
      <ActionForm action={saveDuesSettingsAction} className="flex flex-col gap-4">
        <Field label="Monatsbeitrag (€)" name="amount" hint="Gilt für alle, die unten keinen eigenen Betrag haben.">
          <Input name="amount" inputMode="decimal" defaultValue={defaultCents ? centsToInput(defaultCents) : ""} placeholder="z. B. 5,00" />
        </Field>
        <details className="rounded-xl border border-eiche/70">
          <summary className="flex min-h-12 cursor-pointer items-center px-3 text-sm font-medium">Abweichende Beiträge je Mitglied</summary>
          <div className="flex flex-col gap-2 border-t border-eiche/60 p-3">
            <p className="text-xs text-kreide-dim">Leer lassen = Standardbeitrag. 0 = beitragsfrei (z. B. Ehrenmitglied).</p>
            {rows.map((r) => (
              <label key={r.userId} className="grid grid-cols-[1fr_7rem] items-center gap-3">
                <span className="truncate">{r.displayName}</span>
                <Input
                  name={`member:${r.userId}`}
                  inputMode="decimal"
                  defaultValue={r.overrideCents === null ? "" : centsToInput(r.overrideCents)}
                  placeholder={defaultCents ? centsToInput(defaultCents) : "–"}
                  aria-label={`Beitrag ${r.displayName}`}
                />
              </label>
            ))}
          </div>
        </details>
        <SubmitButton size="md">Speichern</SubmitButton>
      </ActionForm>
      <p className="mt-3 text-xs text-kreide-dim">Änderungen gelten für Monate, die danach angelegt werden. Bereits angelegte Beiträge bleiben unverändert.</p>
    </>
  );

  return (
    <>
      <PageHeader title="Monatsbeiträge" subtitle={manage ? "Kassenwart-Bereich" : "Übersicht (nur lesen)"} />

      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {manage && unconfigured && (
          <Card className="border-messing/60">
            <CardTitle>1. Beitragshöhe festlegen</CardTitle>
            <p className="mb-4 text-sm text-kreide-dim">Danach legst du die Beiträge jedes Monats mit einem Tap an.</p>
            {settingsForm}
          </Card>
        )}
        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <Link href={`/beitraege?monat=${shiftMonth(month, -1)}`} aria-label="Vorheriger Monat" className="flex size-12 items-center justify-center rounded-xl border border-eiche hover:border-messing/60">
              <ChevronLeft size={22} aria-hidden />
            </Link>
            <div className="text-center">
              <h2 className="font-display text-2xl font-bold">{formatMonth(month)}</h2>
              <p className="text-sm text-kreide-dim">
                {withEntry.length === 0 ? "Noch nicht angelegt" : `${paid.length} von ${withEntry.length} bezahlt · offen ${formatEuro(openThisMonth)}`}
              </p>
            </div>
            <Link href={`/beitraege?monat=${shiftMonth(month, 1)}`} aria-label="Nächster Monat" className="flex size-12 items-center justify-center rounded-xl border border-eiche hover:border-messing/60">
              <ChevronRight size={22} aria-hidden />
            </Link>
          </div>

          {manage && missing.length > 0 && (
            <div className="mb-4">
              <ActionButton action={createDuesForMonthAction} fields={{ month }} variant="primary" size="lg" className="w-full">
                <Plus size={20} aria-hidden />
                {withEntry.length === 0
                  ? `Beiträge für ${formatMonth(month)} anlegen`
                  : `${missing.length === 1 ? "1 fehlenden Beitrag" : `${missing.length} fehlende Beiträge`} anlegen`}
              </ActionButton>
            </div>
          )}

          {rows.length === 0 ? (
            <p className="text-kreide-dim">Keine Mitglieder.</p>
          ) : (
            <ul className="flex flex-col">
              {rows.map((r) => (
                <li key={r.userId} className="flex min-h-16 flex-wrap items-center gap-3 border-b border-eiche/50 py-2 last:border-0">
                  <Avatar person={r} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{r.displayName}</span>
                  {r.entry ? (
                    <>
                      <span className="font-display font-bold tabular-nums">{formatEuro(r.entry.amountCents)}</span>
                      {manage ? (
                        r.entry.paidAt ? (
                          <ActionButton action={toggleDuesPaidAction} fields={{ id: r.entry.id, paid: "0" }} variant="ghost" size="sm" ariaLabel={`${r.displayName}: wieder auf offen setzen`}>
                            <Badge tone="zusage">bezahlt</Badge>
                          </ActionButton>
                        ) : (
                          <ActionButton action={toggleDuesPaidAction} fields={{ id: r.entry.id, paid: "1" }} variant="zusage" size="sm" ariaLabel={`${r.displayName} hat bezahlt`}>
                            Bezahlt
                          </ActionButton>
                        )
                      ) : r.entry.paidAt ? (
                        <Badge tone="zusage">bezahlt</Badge>
                      ) : (
                        <Badge tone="absage">offen</Badge>
                      )}
                      {manage && !r.entry.paidAt && (
                        <ActionButton
                          action={deleteDuesAction}
                          fields={{ id: r.entry.id }}
                          variant="ghost"
                          size="sm"
                          ariaLabel={`Beitrag von ${r.displayName} erlassen`}
                          confirm={{ title: `Beitrag für ${r.displayName} erlassen?`, text: `Der Beitrag für ${formatMonth(month)} wird entfernt.`, confirmLabel: "Erlassen" }}
                        >
                          ✕
                        </ActionButton>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-kreide-dim">{r.overrideCents === 0 ? "beitragsfrei" : effective(r) === 0 ? "kein Betrag" : "nicht angelegt"}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Offen je Mitglied</CardTitle>
          {totals.length === 0 ? <p className="text-kreide-dim">Alles bezahlt.</p> : (
            <ul className="flex flex-col">
              {totals.map((t) => (
                <li key={t.userId} className="flex min-h-14 items-center gap-2 border-b border-eiche/50 last:border-0">
                  <Avatar person={t} size="sm" />
                  <span className="min-w-0 flex-1 truncate">{t.displayName}</span>
                  <span className="text-xs text-kreide-dim">{t.n}×</span>
                  <span className="font-display font-bold tabular-nums">{formatEuro(t.total)}</span>
                  {manage && (
                    <ActionButton
                      action={markAllDuesPaidAction}
                      fields={{ userId: t.userId }}
                      variant="zusage"
                      size="sm"
                      ariaLabel={`Alle Beiträge von ${t.displayName} bezahlt`}
                      confirm={{
                        title: `${t.displayName} zahlt ${formatEuro(t.total)}?`,
                        text: t.n === 1 ? "Der offene Beitrag wird als bezahlt markiert." : `Alle ${t.n} offenen Monatsbeiträge werden als bezahlt markiert.`,
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

        {manage && !unconfigured && (
          <details className="group rounded-2xl border border-eiche/70 bg-theke">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden">
              <span className="font-semibold">Beitragshöhe ändern</span>
              <span className="flex items-center gap-2 text-sm text-kreide-dim">
                {formatEuro(defaultCents)} / Monat <ChevronDown size={18} className="transition-transform group-open:rotate-180" aria-hidden />
              </span>
            </summary>
            <div className="border-t border-eiche/60 p-4">{settingsForm}</div>
          </details>
        )}
      </div>
    </>
  );
}
