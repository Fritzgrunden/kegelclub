import type { Permission } from "@/lib/permissions";
import type { Role, UserStatus } from "@/server/db/schema";

export interface SessionUser {
  id: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  /** Alle Rechte aus den Rollen des Benutzers (inkl. MITGLIED) – beim Laden der Sitzung berechnet. */
  permissions: Permission[];
  firstName: string;
  lastName: string;
  nickname: string | null;
  displayName: string;
  avatarImageId: string | null;
  sessionId: string;
}

/** Wer eine Aktion ausführt – reicht für Berechtigungsprüfungen im Service-Layer. */
export type Actor = Pick<SessionUser, "id" | "permissions">;
