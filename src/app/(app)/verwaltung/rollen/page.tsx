import type { Metadata } from "next";
import { Lock } from "lucide-react";
import {
  ADMIN_ROLE,
  LOCKED_ADMIN_PERMISSIONS,
  MEMBER_ROLE,
  PERMISSION_GROUPS,
  PERMISSION_INFO,
  PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import { requirePermission } from "@/server/auth/session";
import { listRoles, type RoleItem } from "@/server/services/roles";
import { deleteRoleAction, saveRoleAction } from "@/server/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { ActionButton } from "@/components/ui/action-button";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Rollen & Rechte" };

function RoleFields({ role }: { role?: RoleItem }) {
  const locked = (p: Permission) => role?.key === ADMIN_ROLE && LOCKED_ADMIN_PERMISSIONS.includes(p);
  return (
    <>
      <Field label="Name" name="name"><Input name="name" defaultValue={role?.name} placeholder="z. B. Vorstand" /></Field>
      <Field label="Beschreibung (optional)" name="description"><Input name="description" defaultValue={role?.description ?? ""} placeholder="Wofür ist die Rolle da?" /></Field>
      {PERMISSION_GROUPS.map((group) => (
        <fieldset key={group} className="flex flex-col gap-1">
          <legend className="mb-1 text-sm font-medium text-kreide-dim">{group}</legend>
          {PERMISSIONS.filter((p) => PERMISSION_INFO[p].group === group).map((p) => (
            <label key={p} className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-[15px]">
              <input
                type="checkbox"
                name="permissions"
                value={p}
                defaultChecked={role?.permissions.includes(p) || locked(p)}
                disabled={locked(p)}
                className="size-5 shrink-0 accent-[var(--color-messing)]"
              />
              <span className="flex-1">{PERMISSION_INFO[p].label}</span>
              {locked(p) && <Lock size={14} className="text-kreide-dim" aria-label="Immer aktiv" />}
            </label>
          ))}
        </fieldset>
      ))}
    </>
  );
}

export default async function RolesPage() {
  await requirePermission("roles:manage");
  const roles = await listRoles();

  return (
    <>
      <PageHeader title="Rollen & Rechte" subtitle="Lege fest, wer was darf." back="/verwaltung" />
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-3">
          {roles.map((r) => (
            <details key={r.key} className="group rounded-2xl border border-eiche/70 bg-theke">
              <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  <span className="block font-semibold">{r.name}</span>
                  {r.description && <span className="block text-sm text-kreide-dim">{r.description}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  {r.key === MEMBER_ROLE ? <Badge>alle</Badge> : <Badge tone="messing">{r.memberCount === 1 ? "1 Person" : `${r.memberCount} Personen`}</Badge>}
                  <span className="text-xs text-kreide-dim">{r.permissions.length} Rechte</span>
                </span>
              </summary>
              <div className="border-t border-eiche/60 p-4">
                {r.key === MEMBER_ROLE && <p className="mb-3 text-sm text-kreide-dim">Diese Rechte hat jedes freigeschaltete Mitglied – zusätzlich zu seinen anderen Rollen.</p>}
                {r.key === ADMIN_ROLE && <p className="mb-3 text-sm text-kreide-dim">Mit Schloss markierte Rechte behält der Admin immer, damit sich niemand aussperrt.</p>}
                <ActionForm action={saveRoleAction} className="flex flex-col gap-3">
                  <input type="hidden" name="key" value={r.key} />
                  <RoleFields role={r} />
                  <SubmitButton size="md">Speichern</SubmitButton>
                </ActionForm>
                {!r.isSystem && (
                  <div className="mt-2">
                    <ActionButton
                      action={deleteRoleAction}
                      fields={{ key: r.key }}
                      variant="ghost"
                      size="sm"
                      confirm={{
                        title: `Rolle „${r.name}“ löschen?`,
                        text: r.memberCount > 0 ? `${r.memberCount === 1 ? "1 Person verliert" : `${r.memberCount} Personen verlieren`} diese Rolle und ihre Rechte.` : undefined,
                        confirmLabel: "Löschen",
                      }}
                    >
                      Rolle löschen
                    </ActionButton>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
        <Card className="h-fit">
          <CardTitle>Neue Rolle</CardTitle>
          <p className="mb-3 text-sm text-kreide-dim">
            Danach unter Verwaltung → Mitglied der Person zuweisen. Achtung: Wer „Rollen anlegen und Rechte festlegen“ hat, kann sich selbst jedes Recht geben.
          </p>
          <ActionForm action={saveRoleAction} resetOnSuccess className="flex flex-col gap-3">
            <RoleFields />
            <SubmitButton className="w-full">Rolle anlegen</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
