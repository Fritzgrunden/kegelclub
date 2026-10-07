import { hasPermission, type Permission } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import type { Actor } from "./types";

/** Zentrale serverseitige Rechteprüfung für den Service-Layer. */
export function assertCan(actor: Actor, permission: Permission, message?: string) {
  if (!hasPermission(actor, permission)) throw new ForbiddenError(message);
}
