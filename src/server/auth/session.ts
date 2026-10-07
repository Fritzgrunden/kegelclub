import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasPermission, type Permission } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import { getUserBySessionToken } from "@/server/services/auth";
import type { SessionUser } from "./types";

export const SESSION_COOKIE = "kc_session";

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Aktueller Benutzer (pro Request gecacht). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = await getSessionToken();
  if (!token) return null;
  return getUserBySessionToken(token);
});

/** Für Seiten: leitet ohne Login zur Anmeldung weiter. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Für Seiten: zeigt die Berechtigungsfehlerseite. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) redirect("/kein-zugriff");
  return user;
}

/** Für Server Actions: wirft Fehler statt Redirect. */
export async function requireActor(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError("Bitte melde dich erneut an.");
  return user;
}

/** Schlüssel zur Ratenbegrenzung (IP hinter Proxy/Vercel). */
export async function getClientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}
