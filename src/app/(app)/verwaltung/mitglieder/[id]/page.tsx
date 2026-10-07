import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ROLE_LABELS, ROLES } from "@/lib/permissions";
import { USER_STATUS_LABELS } from "@/lib/format";
import type { UserStatus } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/session";
import { getMember } from "@/server/services/users";
import { setMemberRolesAction, setMemberStatusAction } from "@/server/actions/admin";
import { AvatarUpload } from "@/components/members/avatar-upload";
import { ProfileForm } from "@/components/members/profile-form";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { ActionButton } from "@/components/ui/action-button";
import { SubmitButton } from "@/components/ui/fields";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Mitglied verwalten" };

const ROLE_HINTS: Record<string, string> = {
  MITGLIED: "Basisrechte – haben alle.",
  KASSENWART: "Strafen vergeben und Strafkatalog pflegen.",
  ADMIN: "Mitglieder, Termine, Spiele und Einstellungen verwalten.",
};

const STATUS_ACTIONS: { status: UserStatus; label: string }[] = [
  { status: "AKTIV", label: "Aktiv" },
  { status: "PASSIV", label: "Passiv" },
  { status: "INAKTIV", label: "Sperren" },
];

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("members:manage");
  const { id } = await params;
  const member = await getMember(id);
  if (!member) notFound();

  return (
    <>
      <PageHeader title={`${member.firstName} ${member.lastName}`} subtitle={<Badge>{USER_STATUS_LABELS[member.status]}</Badge>} back="/verwaltung" />
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-5">
          <Card><AvatarUpload person={member} userId={member.id} /></Card>
          <Card>
            <CardTitle>Status</CardTitle>
            <p className="mb-3 text-sm text-kreide-dim">Passive Mitglieder erscheinen nicht unter „ohne Antwort“. Gesperrte können sich nicht anmelden; ihre Daten bleiben erhalten.</p>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_ACTIONS.map((s) => (
                <ActionButton
                  key={s.status}
                  action={setMemberStatusAction}
                  fields={{ id, status: s.status }}
                  variant={member.status === s.status ? "primary" : "secondary"}
                  size="sm"
                  confirm={s.status === "INAKTIV" ? { title: "Mitglied sperren?", text: "Alle Sitzungen werden ungültig.", confirmLabel: "Sperren" } : undefined}
                >
                  {s.label}
                </ActionButton>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>Rollen</CardTitle>
            <ActionForm action={setMemberRolesAction} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={id} />
              {ROLES.map((r) => (
                <label key={r} className="flex min-h-14 items-center gap-3 rounded-xl border border-eiche px-3">
                  <input
                    type="checkbox"
                    name="roles"
                    value={r}
                    defaultChecked={member.roles.includes(r)}
                    disabled={r === "MITGLIED" || (r === "ADMIN" && actor.id === id)}
                    className="size-5 accent-[var(--color-messing)]"
                  />
                  <span>
                    <span className="block font-medium">{ROLE_LABELS[r]}</span>
                    <span className="block text-xs text-kreide-dim">{ROLE_HINTS[r]}</span>
                  </span>
                  {r === "ADMIN" && actor.id === id && <input type="hidden" name="roles" value="ADMIN" />}
                </label>
              ))}
              <SubmitButton size="md" className="mt-2">Rollen speichern</SubmitButton>
            </ActionForm>
          </Card>
        </div>
        <Card>
          <CardTitle>Profildaten</CardTitle>
          <ProfileForm member={member} adminMode />
        </Card>
      </div>
    </>
  );
}
