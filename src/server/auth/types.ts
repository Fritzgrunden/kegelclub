import type { Role, UserStatus } from "@/server/db/schema";

export interface SessionUser {
  id: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  firstName: string;
  lastName: string;
  nickname: string | null;
  displayName: string;
  avatarImageId: string | null;
  sessionId: string;
}

/** Wer eine Aktion ausführt – reicht für Berechtigungsprüfungen im Service-Layer. */
export type Actor = Pick<SessionUser, "id" | "roles">;
