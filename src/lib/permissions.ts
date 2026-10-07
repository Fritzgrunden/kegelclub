import type { Role } from "@/server/db/schema";

/**
 * Rechte sind an Rollen gebunden, nicht an einzelne Benutzer.
 * Eine neue Rolle = neuer Enum-Wert in schema.ts + Eintrag in ROLE_PERMISSIONS.
 */
export const PERMISSIONS = [
  "profile:edit-own",
  "members:view",
  "events:view",
  "events:rsvp",
  "games:view",
  "results:enter",
  "stats:view",
  "penalties:view-own",
  "penalties:view-all",
  "penalties:manage",
  "penalty-catalog:manage",
  "members:manage",
  "roles:assign",
  "events:manage",
  "games:manage",
  "results:manage",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES: readonly Role[] = ["MITGLIED", "KASSENWART", "ADMIN"];

export const ROLE_LABELS: Record<Role, string> = {
  MITGLIED: "Mitglied",
  KASSENWART: "Kassenwart",
  ADMIN: "Admin",
};

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  MITGLIED: [
    "profile:edit-own",
    "members:view",
    "events:view",
    "events:rsvp",
    "games:view",
    "results:enter",
    "stats:view",
    "penalties:view-own",
  ],
  // Nur der Kassenwart darf Strafen vergeben und den Katalog pflegen.
  KASSENWART: ["penalties:view-all", "penalties:manage", "penalty-catalog:manage"],
  ADMIN: [
    "members:manage",
    "roles:assign",
    "events:manage",
    "games:manage",
    "results:manage",
    "settings:manage",
    "penalties:view-all",
  ],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const result = new Set<Permission>(ROLE_PERMISSIONS.MITGLIED);
  for (const role of roles) for (const p of ROLE_PERMISSIONS[role] ?? []) result.add(p);
  return result;
}

export function hasPermission(user: { roles: readonly Role[] } | null | undefined, permission: Permission) {
  if (!user) return false;
  return permissionsFor(user.roles).has(permission);
}
