import "server-only";
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { passwordResetTokens, profiles, sessions, userRoles, users, type Role } from "@/server/db/schema";
import { AppError } from "@/lib/errors";
import { displayName } from "@/lib/format";
import { emailSchema, passwordSchema, registerSchema, zodFieldErrors } from "@/lib/validation";
import { generateToken, getDummyHash, hashPassword, hashToken, verifyPassword } from "@/server/auth/crypto";
import { consumeRateLimit, resetRateLimit } from "@/server/auth/rate-limit";
import type { SessionUser } from "@/server/auth/types";
import { sendMail } from "./mail";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const LOGIN_LIMIT = { attempts: 8, windowMs: 15 * 60 * 1000 };
const RESET_LIMIT = { attempts: 3, windowMs: 60 * 60 * 1000 };
const REGISTER_LIMIT = { attempts: 5, windowMs: 60 * 60 * 1000 };

/* ───────────── Registrierung ───────────── */

/**
 * Neue Konten starten mit Status AUSSTEHEND und müssen von einem Admin freigeschaltet werden.
 * So kann sich niemand Fremdes Zugang zu den Vereinsdaten verschaffen.
 */
export async function registerUser(raw: unknown, clientKey = "unknown") {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  const input = parsed.data;

  if (!(await consumeRateLimit(`register:${clientKey}`, REGISTER_LIMIT.attempts, REGISTER_LIMIT.windowMs))) {
    throw new AppError("Zu viele Registrierungen. Bitte später erneut versuchen.", "RATE_LIMIT");
  }

  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email), columns: { id: true } });
  if (existing) {
    throw new AppError("Für diese E-Mail-Adresse existiert bereits ein Konto.", "CONFLICT", {
      email: "Diese E-Mail-Adresse ist bereits registriert.",
    });
  }

  const passwordHash = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: input.email, passwordHash, status: "AUSSTEHEND" })
      .returning({ id: users.id, status: users.status });
    await tx.insert(profiles).values({
      userId: user.id,
      firstName: input.firstName,
      lastName: input.lastName,
      nickname: input.nickname,
      birthday: input.birthday,
      phone: input.phone,
    });
    await tx.insert(userRoles).values({ userId: user.id, role: "MITGLIED" });
    return user;
  });
}

/* ───────────── Login / Sessions ───────────── */

export async function authenticate(rawEmail: string, password: string, clientKey = "unknown") {
  const emailParse = emailSchema.safeParse(rawEmail);
  const email = emailParse.success ? emailParse.data : rawEmail.toLowerCase().trim();
  const limitKey = `login:${clientKey}:${email}`;

  if (!(await consumeRateLimit(limitKey, LOGIN_LIMIT.attempts, LOGIN_LIMIT.windowMs))) {
    throw new AppError("Zu viele Anmeldeversuche. Bitte in 15 Minuten erneut versuchen.", "RATE_LIMIT");
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  const valid = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  if (!user || !valid) throw new AppError("E-Mail oder Passwort ist falsch.", "UNAUTHORIZED");

  if (user.status === "AUSSTEHEND") {
    throw new AppError("Dein Konto wartet noch auf die Freischaltung durch einen Admin.", "FORBIDDEN");
  }
  if (user.status === "INAKTIV") throw new AppError("Dieses Konto ist deaktiviert.", "FORBIDDEN");

  await resetRateLimit(limitKey);
  return createSession(user.id);
}

export async function createSession(userId: string) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function getUserBySessionToken(token: string): Promise<SessionUser | null> {
  const sessionId = hashToken(token);
  const row = await db
    .select({
      id: users.id,
      email: users.email,
      status: users.status,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      avatarImageId: profiles.avatarImageId,
      expiresAt: sessions.expiresAt,
      // Rollen in derselben Abfrage – spart auf jeder Seite einen Datenbank-Roundtrip.
      roles: sql<Role[]>`coalesce((select array_agg(${userRoles.role}::text) from ${userRoles} where ${userRoles.userId} = ${users.id}), '{}')`,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  const s = row[0];
  if (!s) return null;
  if (s.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }
  if (s.status !== "AKTIV" && s.status !== "PASSIV") return null;

  return {
    id: s.id,
    email: s.email,
    status: s.status,
    roles: s.roles,
    firstName: s.firstName,
    lastName: s.lastName,
    nickname: s.nickname,
    displayName: displayName(s),
    avatarImageId: s.avatarImageId,
    sessionId,
  };
}

export async function deleteSession(token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}

/* ───────────── Passwort vergessen / zurücksetzen ───────────── */

/**
 * Antwortet nach außen immer gleich – unabhängig davon, ob die E-Mail existiert.
 * Gibt das Token nur intern zurück (für Tests); der Aufrufer darf es nie an den Client weitergeben.
 */
export async function requestPasswordReset(rawEmail: string, clientKey = "unknown"): Promise<string | null> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new AppError("Bitte eine gültige E-Mail-Adresse angeben.");
  const email = parsed.data;

  if (!(await consumeRateLimit(`reset:${clientKey}:${email}`, RESET_LIMIT.attempts, RESET_LIMIT.windowMs))) {
    throw new AppError("Zu viele Anfragen. Bitte später erneut versuchen.", "RATE_LIMIT");
  }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user || user.status === "INAKTIV") return null;

  const token = generateToken();
  await db.insert(passwordResetTokens).values({
    id: hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  await sendMail({
    to: user.email,
    subject: "Passwort zurücksetzen",
    text:
      `Hallo,\n\nüber folgenden Link kannst du ein neues Passwort für den Kegelclub festlegen:\n\n` +
      `${appUrl}/passwort-zuruecksetzen?token=${token}\n\n` +
      `Der Link ist 60 Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.\n`,
  });
  return token;
}

export async function resetPassword(token: string, newPassword: string) {
  const pw = passwordSchema.safeParse(newPassword);
  if (!pw.success) throw new AppError(pw.error.issues[0].message, "VALIDATION", { password: pw.error.issues[0].message });

  const record = await db.query.passwordResetTokens.findFirst({
    where: and(
      eq(passwordResetTokens.id, hashToken(token)),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
    ),
  });
  if (!record) throw new AppError("Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.");

  const passwordHash = await hashPassword(pw.data);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordChangedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, record.userId));
    await tx.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.userId, record.userId));
    // Alle Sitzungen beenden – falls jemand Fremdes angemeldet war.
    await tx.delete(sessions).where(eq(sessions.userId, record.userId));
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, keepSessionId?: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new AppError("Benutzer nicht gefunden.", "NOT_FOUND");
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError("Das aktuelle Passwort ist falsch.", "VALIDATION", { currentPassword: "Das aktuelle Passwort ist falsch." });
  }
  const pw = passwordSchema.safeParse(newPassword);
  if (!pw.success) throw new AppError(pw.error.issues[0].message, "VALIDATION", { newPassword: pw.error.issues[0].message });

  const passwordHash = await hashPassword(pw.data);
  await db.update(users).set({ passwordHash, passwordChangedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
  // Andere Geräte abmelden, aktuelle Sitzung behalten.
  await db
    .delete(sessions)
    .where(keepSessionId ? and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)) : eq(sessions.userId, userId));
}
