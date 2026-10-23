import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ADMIN_ROLE, hasPermission, MEMBER_ROLE } from "@/lib/permissions";
import { USER_STATUS_LABELS } from "@/lib/format";
import type { UserStatus } from "@/server/db/schema";
import { requirePermission } from "@/server/auth/session";
import { getMember, hasRole } from "@/server/services/users";
import { listRoles } from "@/server/services/roles";
import { setMemberRolesAction, setMemberStatusAction } from "@/server/actions/admin";
import { AvatarUpload } from "@/components/members/avatar-upload";
import { ProfileForm } from "@/components/members/profile-form";
import { ResetLink } from "@/components/members/reset-link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { ActionButton } from "@/components/ui/action-button";
import { SubmitButton } from "@/components/ui/fields";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Mitglied verwalten" };

const STATUS_ACTIONS: { status: UserStatus; label: string }[] = [
  { status: "AKTIV", label: "Aktiv" },
  { status: "PASSIV", label: "Passiv" },
  { status: "INAKTIV", label: "Sperren" },
];

export default async function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("members:manage");
  const { id } = await params;
  const [member, roles] = await Promise.all([getMember(id), listRoles()]);
  if (!member) notFound();
  const lockSelfAdmin = actor.id === id && hasRole(member, ADMIN_ROLE);

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
          {actor.id !== id && (member.status === "AKTIV" || member.status === "PASSIV") && (
            <Card>
              <CardTitle>Passwort</CardTitle>
              <ResetLink userId={id} firstName={member.firstName} />
            </Card>
          )}
          <Card>
            <CardTitle
              action={hasPermission(actor, "roles:manage") ? <Link href="/verwaltung/rollen" className="text-sm text-messing-hell hover:underline">Rollen bearbeiten</Link> : undefined}
            >
              Rollen
            </CardTitle>
            <ActionForm action={setMemberRolesAction} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={id} />
              {roles.map((r) => (
                <label key={r.key} className="flex min-h-14 items-center gap-3 rounded-xl border border-eiche px-3 py-2">
                  <input
                    type="checkbox"
                    name="roles"
                    value={r.key}
                    defaultChecked={r.key === MEMBER_ROLE || hasRole(member, r.key)}
                    disabled={r.key === MEMBER_ROLE || (r.key === ADMIN_ROLE && lockSelfAdmin)}
                    className="size-5 shrink-0 accent-[var(--color-messing)]"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{r.name}</span>
                    {r.description && <span className="block text-xs text-kreide-dim">{r.description}</span>}
                  </span>
                  {r.key === ADMIN_ROLE && lockSelfAdmin && <input type="hidden" name="roles" value={ADMIN_ROLE} />}
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
