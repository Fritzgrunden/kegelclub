import type { Metadata } from "next";
import { hasPermission } from "@/lib/permissions";
import { centsToInput, formatEuro } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { listPenaltyTypes } from "@/server/services/penalties";
import { deletePenaltyTypeAction, savePenaltyTypeAction } from "@/server/actions/penalties";
import { ActionForm } from "@/components/ui/action-form";
import { ActionButton } from "@/components/ui/action-button";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Strafkatalog" };

function TypeFields({ t }: { t?: { name: string; description: string | null; amountCents: number; active: boolean } }) {
  return (
    <>
      <div className="grid grid-cols-[1fr_7.5rem] gap-3">
        <Field label="Bezeichnung" name="name"><Input name="name" defaultValue={t?.name} placeholder="z. B. Zu spät gekommen" /></Field>
        <Field label="Betrag (€)" name="amount"><Input name="amount" inputMode="decimal" defaultValue={t ? centsToInput(t.amountCents) : ""} placeholder="1,00" /></Field>
      </div>
      <Field label="Beschreibung (optional)" name="description"><Input name="description" defaultValue={t?.description ?? ""} /></Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="active" defaultChecked={t?.active ?? true} className="size-5 accent-[var(--color-messing)]" /> Aktiv
      </label>
    </>
  );
}

export default async function CatalogPage() {
  const user = await requireUser();
  const manage = hasPermission(user, "penalty-catalog:manage");
  const types = await listPenaltyTypes({ includeInactive: manage });

  return (
    <>
      <PageHeader title="Strafkatalog" subtitle={manage ? "Wird vom Kassenwart gepflegt." : undefined} back="/strafen" />
      {!manage ? (
        types.length === 0 ? <EmptyState title="Der Strafkatalog ist noch leer." /> : (
          <section className="tafel rounded-md p-5">
            <ul className="flex flex-col">
              {types.map((t) => (
                <li key={t.id} className="flex min-h-14 items-center justify-between gap-4 border-b border-dashed border-kreide/20 py-2 last:border-0">
                  <span><span className="kreide block text-lg">{t.name}</span>{t.description && <span className="block text-sm text-kreide-dim">{t.description}</span>}</span>
                  <span className="kreide font-display text-2xl font-bold tabular-nums">{formatEuro(t.amountCents)}</span>
                </li>
              ))}
            </ul>
          </section>
        )
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="flex flex-col gap-3">
            {types.length === 0 && <EmptyState title="Noch keine Strafarten angelegt." />}
            {types.map((t) => (
              <details key={t.id} className="group rounded-2xl border border-eiche/70 bg-theke">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4">
                  <span>
                    <span className="block font-semibold">{t.name}</span>
                    {!t.active && <Badge>inaktiv</Badge>}
                  </span>
                  <span className="font-display text-xl font-bold tabular-nums">{formatEuro(t.amountCents)}</span>
                </summary>
                <div className="border-t border-eiche/60 p-4">
                  <ActionForm action={savePenaltyTypeAction} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={t.id} />
                    <TypeFields t={t} />
                    <div className="flex flex-wrap gap-2">
                      <SubmitButton size="md">Speichern</SubmitButton>
                    </div>
                  </ActionForm>
                  <div className="mt-2">
                    <ActionButton action={deletePenaltyTypeAction} fields={{ id: t.id }} variant="ghost" size="sm" confirm={{ title: `„${t.name}“ löschen?`, text: "Bereits vergebene Strafarten können nicht gelöscht, nur deaktiviert werden.", confirmLabel: "Löschen" }}>
                      Löschen
                    </ActionButton>
                  </div>
                </div>
              </details>
            ))}
          </div>
          <Card className="h-fit">
            <CardTitle>Neue Strafart</CardTitle>
            <ActionForm action={savePenaltyTypeAction} resetOnSuccess className="flex flex-col gap-3">
              <TypeFields />
              <SubmitButton className="w-full">Hinzufügen</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      )}
    </>
  );
}
