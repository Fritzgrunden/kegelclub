import "server-only";
import { randomUUID } from "node:crypto";
import { asc, eq, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/server/db";
import { roles, userRoles } from "@/server/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { ADMIN_ROLE, isPermission, LOCKED_ADMIN_PERMISSIONS, MEMBER_ROLE, PERMISSIONS, type Permission } from "@/lib/permissions";
import { roleSchema, zodFieldErrors } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

export interface RoleItem {
  key: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  isSystem: boolean;
  memberCount: number;
}

/**
 * SQL-Ausdruck: alle Rechte eines Benutzers aus seinen Rollen plus der Rolle MITGLIED.
 * Als Unterabfrage gedacht, damit die Sitzung mit einem einzigen Roundtrip geladen wird.
 */
export function permissionsSql(userId: PgColumn | SQL | string) {
  return sql<string[]>`coalesce((
    select array_agg(distinct p) from ${roles} r, unnest(r.permissions) p
    where r.key = ${MEMBER_ROLE}
       or r.key in (select ur.role from ${userRoles} ur where ur.user_id = ${userId})
  ), '{}')`;
}

export async function loadPermissions(userId: string): Promise<Permission[]> {
  const [row] = await db.select({ p: permissionsSql(userId) }).from(sql`(select 1) as one`);
  return (row?.p ?? []).filter(isPermission);
}

export async function listRoles(): Promise<RoleItem[]> {
  const rows = await db
    .select({
      key: roles.key,
      name: roles.name,
      description: roles.description,
      permissions: roles.permissions,
      isSystem: roles.isSystem,
      memberCount: sql<number>`(select count(*)::int from ${userRoles} where ${userRoles.role} = ${roles.key})`,
    })
    .from(roles)
    .orderBy(asc(roles.sortOrder), asc(roles.name));
  return rows.map((r) => ({ ...r, permissions: r.permissions.filter(isPermission), memberCount: Number(r.memberCount) }));
}

/** Legt eine Rolle an (key = null) oder ändert Name, Beschreibung und Rechte. Gibt den Schlüssel zurück. */
export async function saveRole(actor: Actor, key: string | null, raw: unknown) {
  assertCan(actor, "roles:manage");
  const parsed = roleSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  const { name, description } = parsed.data;
  let permissions = PERMISSIONS.filter((p) => parsed.data.permissions.includes(p));
  if (key === ADMIN_ROLE) permissions = PERMISSIONS.filter((p) => permissions.includes(p) || LOCKED_ADMIN_PERMISSIONS.includes(p));

  const sameName = await db.query.roles.findFirst({ where: sql`lower(${roles.name}) = lower(${name})`, columns: { key: true } });
  if (sameName && sameName.key !== key) throw new AppError("Diese Rolle gibt es schon.", "CONFLICT", { name: "Name bereits vergeben." });

  if (key) {
    const res = await db
      .update(roles)
      .set({ name, description, permissions, updatedAt: new Date() })
      .where(eq(roles.key, key))
      .returning({ key: roles.key });
    if (res.length === 0) throw new NotFoundError("Rolle nicht gefunden.");
    return key;
  }
  const [{ max }] = await db.select({ max: sql<number>`coalesce(max(${roles.sortOrder}), 0)::int` }).from(roles);
  const [row] = await db
    .insert(roles)
    .values({ key: randomUUID(), name, description, permissions, sortOrder: Number(max) + 1 })
    .returning({ key: roles.key });
  return row.key;
}

/** Löscht eine selbst angelegte Rolle; Mitglieder verlieren sie dabei automatisch. */
export async function deleteRole(actor: Actor, key: string) {
  assertCan(actor, "roles:manage");
  const role = await db.query.roles.findFirst({ where: eq(roles.key, key) });
  if (!role) throw new NotFoundError("Rolle nicht gefunden.");
  if (role.isSystem) throw new AppError(`Die Rolle „${role.name}“ ist fest eingebaut und kann nicht gelöscht werden.`);
  await db.delete(roles).where(eq(roles.key, key));
}
