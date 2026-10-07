import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, Dices } from "lucide-react";
import { hasPermission, ROLE_LABELS } from "@/lib/permissions";
import { USER_STATUS_LABELS } from "@/lib/format";
import { requirePermission } from "@/server/auth/session";
import { listMembers } from "@/server/services/users";
import { getSettings } from "@/server/services/settings";
import { rejectRegistrationAction, setMemberStatusAction, updateSettingsAction } from "@/server/actions/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verwaltung" };

export default async function AdminPage() {
  const user = await requirePermission("members:manage");
  const [members, settings] = await Promise.all([listMembers({ includeAll: true }), getSettings()]);
  const pending = members.filter((m) => m.status === "AUSSTEHEND");
  const others = members.filter((m) => m.status !== "AUSSTEHEND");

  return (
    <>
      <PageHeader title="Verwaltung" />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          {pending.length > 0 && (
            <Card className="border-messing/60">
              <CardTitle>Neue Registrierungen ({pending.length})</CardTitle>
              <ul className="flex flex-col gap-3">
                {pending.map((m) => (
                  <li key={m.id} className="rounded-xl bg-theke-2/60 p-3">
                    <div className="flex items-center gap-3">
                      <Avatar person={m} size="md" />
                      <div className="min-w-0">
                        <p className="font-semibold">{m.firstName} {m.lastName}</p>
                        <p className="truncate text-sm text-kreide-dim">{m.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <ActionButton action={setMemberStatusAction} fields={{ id: m.id, status: "AKTIV" }} variant="zusage">Freischalten</ActionButton>
                      <ActionButton action={rejectRegistrationAction} fields={{ id: m.id }} variant="ghost" confirm={{ title: "Registrierung ablehnen?", text: "Das Konto wird gelöscht.", confirmLabel: "Ablehnen" }}>Ablehnen</ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle>Mitglieder & Rollen</CardTitle>
            <ul className="flex flex-col">
              {others.map((m) => (
                <li key={m.id}>
                  <Link href={`/verwaltung/mitglieder/${m.id}`} className="flex min-h-16 items-center gap-3 border-b border-eiche/50 py-2 last:border-0 hover:bg-theke-2/40">
                    <Avatar person={m} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{m.displayName}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {m.roles.filter((r) => r !== "MITGLIED").map((r) => <Badge key={r} tone="messing">{ROLE_LABELS[r]}</Badge>)}
                        {m.status !== "AKTIV" && <Badge tone={m.status === "INAKTIV" ? "absage" : "neutral"}>{USER_STATUS_LABELS[m.status]}</Badge>}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-kreide-dim" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle>Vereinseinstellungen</CardTitle>
            <ActionForm action={updateSettingsAction} className="flex flex-col gap-4">
              <Field label="Vereinsname" name="clubName"><Input name="clubName" defaultValue={settings.clubName} /></Field>
              <Field label="Standard-Ort für Kegelabende" name="defaultLocation"><Input name="defaultLocation" defaultValue={settings.defaultLocation} /></Field>
              <Field label="Standard-Uhrzeit" name="defaultTime"><Input name="defaultTime" type="time" defaultValue={settings.defaultTime} /></Field>
              <SubmitButton>Einstellungen speichern</SubmitButton>
            </ActionForm>
          </Card>
          {hasPermission(user, "games:manage") && (
            <LinkButton href="/spiele" variant="secondary" size="lg"><Dices size={20} aria-hidden /> Kegelspiele verwalten</LinkButton>
          )}
        </div>
      </div>
    </>
  );
}
