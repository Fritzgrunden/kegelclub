/**
 * Rechte sind an Rollen gebunden, nicht an einzelne Benutzer. Welche Rolle welche Rechte hat,
 * steht in der Tabelle `roles` und wird in der Verwaltung gepflegt. Ein neues Recht = Eintrag
 * in PERMISSIONS + PERMISSION_INFO.
 */
export const PERMISSIONS = [
  "profile:edit-own",
  "members:view",
  "events:view",
  "events:rsvp",
  "stats:view",
  "penalties:view-own",
  "penalties:view-all",
  "penalties:manage",
  "penalty-catalog:manage",
  "dues:view-own",
  "dues:view-all",
  "dues:manage",
  "cash:view",
  "cash:manage",
  "members:manage",
  "roles:assign",
  "roles:manage",
  "events:manage",
  "settings:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const isPermission = (p: string): p is Permission => (PERMISSIONS as readonly string[]).includes(p);

/** Systemrollen – fester Schlüssel, nicht löschbar. */
export const MEMBER_ROLE = "MITGLIED";
export const ADMIN_ROLE = "ADMIN";

/** Diese Rechte behält die Admin-Rolle immer, damit sich niemand aus der Verwaltung aussperrt. */
export const LOCKED_ADMIN_PERMISSIONS: readonly Permission[] = ["members:manage", "roles:assign", "roles:manage"];

export const PERMISSION_GROUPS = ["Allgemein", "Strafen", "Beiträge", "Kasse", "Verwaltung"] as const;

export const PERMISSION_INFO: Record<Permission, { label: string; group: (typeof PERMISSION_GROUPS)[number] }> = {
  "profile:edit-own": { label: "Eigenes Profil bearbeiten", group: "Allgemein" },
  "members:view": { label: "Mitgliederliste sehen", group: "Allgemein" },
  "events:view": { label: "Termine sehen", group: "Allgemein" },
  "events:rsvp": { label: "Zu Terminen zu-/absagen", group: "Allgemein" },
  "stats:view": { label: "Statistik sehen", group: "Allgemein" },
  "penalties:view-own": { label: "Eigene Strafen sehen", group: "Strafen" },
  "penalties:view-all": { label: "Strafen aller Mitglieder sehen", group: "Strafen" },
  "penalties:manage": { label: "Strafen vergeben und kassieren", group: "Strafen" },
  "penalty-catalog:manage": { label: "Strafkatalog pflegen", group: "Strafen" },
  "dues:view-own": { label: "Eigene Beiträge sehen", group: "Beiträge" },
  "dues:view-all": { label: "Beiträge aller Mitglieder sehen", group: "Beiträge" },
  "dues:manage": { label: "Beiträge festlegen und kassieren", group: "Beiträge" },
  "cash:view": { label: "Kassenstand und Kassenbuch sehen", group: "Kasse" },
  "cash:manage": { label: "Einnahmen und Ausgaben eintragen", group: "Kasse" },
  "members:manage": { label: "Mitglieder freischalten und bearbeiten", group: "Verwaltung" },
  "roles:assign": { label: "Rollen an Mitglieder vergeben", group: "Verwaltung" },
  "roles:manage": { label: "Rollen anlegen und Rechte festlegen", group: "Verwaltung" },
  "events:manage": { label: "Termine anlegen und bearbeiten", group: "Verwaltung" },
  "settings:manage": { label: "Vereinseinstellungen ändern", group: "Verwaltung" },
};

export function hasPermission(user: { permissions: readonly Permission[] } | null | undefined, permission: Permission) {
  if (!user) return false;
  return user.permissions.includes(permission);
}
