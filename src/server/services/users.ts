import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { profiles, userRoles, users, type Role, type UserStatus } from "@/server/db/schema";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { hasPermission } from "@/lib/permissions";
import { displayName } from "@/lib/format";
import { emailSchema, profileSchema, zodFieldErrors } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";
import { deleteImage, storeImage } from "./images";

export interface Member {
  id: string;
  email: string;
  status: UserStatus;
  roles: Role[];
  firstName: string;
  lastName: string;
  nickname: string | null;
  displayName: string;
  birthday: string | null;
  phone: string | null;
  avatarImageId: string | null;
  createdAt: Date;
}

const memberColumns = {
  id: users.id,
  email: users.email,
  status: users.status,
  createdAt: users.createdAt,
  firstName: profiles.firstName,
  lastName: profiles.lastName,
  nickname: profiles.nickname,
  birthday: profiles.birthday,
  phone: profiles.phone,
  avatarImageId: profiles.avatarImageId,
};

async function attachRoles<T extends { id: string; firstName: string; lastName: string; nickname: string | null }>(
  rows: T[],
): Promise<(T & { roles: Role[]; displayName: string })[]> {
  if (rows.length === 0) return [];
  const roleRows = await db
    .select()
    .from(userRoles)
    .where(inArray(userRoles.userId, rows.map((r) => r.id)));
  return rows.map((r) => ({
    ...r,
    roles: roleRows.filter((x) => x.userId === r.id).map((x) => x.role),
    displayName: displayName(r),
  }));
}

/** Mitglieder mit Status AKTIV/PASSIV; optional alle (Admin-Ansicht). */
export async function listMembers(opts: { includeAll?: boolean } = {}): Promise<Member[]> {
  const statuses: UserStatus[] = opts.includeAll ? ["AUSSTEHEND", "AKTIV", "PASSIV", "INAKTIV"] : ["AKTIV", "PASSIV"];
  const rows = await db
    .select(memberColumns)
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.status, statuses))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));
  return attachRoles(rows);
}

/** Mitglieder, die bei Terminen erwartet werden (nur aktive). */
export async function listActiveMemberIds() {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.status, "AKTIV"));
  return rows.map((r) => r.id);
}

export async function getMember(id: string): Promise<Member | null> {
  const rows = await db.select(memberColumns).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(eq(users.id, id));
  const [m] = await attachRoles(rows);
  return m ?? null;
}

/** Datenschutz: Nur man selbst und Verwalter sehen Kontaktdaten. */
export function canSeePrivateData(viewer: Actor, memberId: string) {
  return viewer.id === memberId || hasPermission(viewer, "members:manage");
}

export async function updateProfile(actor: Actor, userId: string, raw: unknown) {
  if (actor.id === userId) assertCan(actor, "profile:edit-own");
  else assertCan(actor, "members:manage");

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  const result = await db.update(profiles).set({ ...parsed.data, updatedAt: new Date() }).where(eq(profiles.userId, userId)).returning();
  if (result.length === 0) throw new NotFoundError("Mitglied nicht gefunden.");
}

export async function updateEmail(actor: Actor, userId: string, rawEmail: string) {
  assertCan(actor, "members:manage");
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new AppError("Bitte eine gültige E-Mail-Adresse angeben.", "VALIDATION", { email: parsed.error.issues[0].message });
  const existing = await db.query.users.findFirst({ where: eq(users.email, parsed.data) });
  if (existing && existing.id !== userId) throw new AppError("Diese E-Mail-Adresse wird bereits verwendet.", "CONFLICT", { email: "Bereits vergeben." });
  await db.update(users).set({ email: parsed.data, updatedAt: new Date() }).where(eq(users.id, userId));
}

async function countActiveAdmins(excludeUserId?: string) {
  const rows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .innerJoin(users, eq(users.id, userRoles.userId))
    .where(and(eq(userRoles.role, "ADMIN"), inArray(users.status, ["AKTIV", "PASSIV"])));
  return rows.filter((r) => r.userId !== excludeUserId).length;
}

export async function setUserStatus(actor: Actor, userId: string, status: UserStatus) {
  assertCan(actor, "members:manage");
  if (actor.id === userId && status !== "AKTIV" && status !== "PASSIV") {
    throw new AppError("Du kannst dein eigenes Konto nicht sperren.");
  }
  const target = await getMember(userId);
  if (!target) throw new NotFoundError("Mitglied nicht gefunden.");
  if (target.roles.includes("ADMIN") && (status === "INAKTIV" || status === "AUSSTEHEND") && (await countActiveAdmins(userId)) === 0) {
    throw new AppError("Der letzte Admin kann nicht gesperrt werden.");
  }
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function setUserRoles(actor: Actor, userId: string, roles: Role[]) {
  assertCan(actor, "roles:assign");
  const next = Array.from(new Set<Role>(["MITGLIED", ...roles]));
  const target = await getMember(userId);
  if (!target) throw new NotFoundError("Mitglied nicht gefunden.");
  if (target.roles.includes("ADMIN") && !next.includes("ADMIN") && (await countActiveAdmins(userId)) === 0) {
    throw new AppError("Es muss mindestens ein Admin übrig bleiben.");
  }
  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.insert(userRoles).values(next.map((role) => ({ userId, role })));
  });
}

/** Nur nicht freigeschaltete Registrierungen dürfen gelöscht werden – sonst Status „INAKTIV“ (Historie bleibt). */
export async function rejectRegistration(actor: Actor, userId: string) {
  assertCan(actor, "members:manage");
  const target = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!target) throw new NotFoundError("Mitglied nicht gefunden.");
  if (target.status !== "AUSSTEHEND") throw new AppError("Nur offene Registrierungen können gelöscht werden.");
  await db.delete(users).where(eq(users.id, userId));
}

export async function setAvatar(actor: Actor, userId: string, file: File) {
  if (actor.id !== userId && !hasPermission(actor, "members:manage")) throw new ForbiddenError();
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!profile) throw new NotFoundError("Mitglied nicht gefunden.");
  const imageId = await storeImage(file, actor.id);
  await db.update(profiles).set({ avatarImageId: imageId, updatedAt: new Date() }).where(eq(profiles.userId, userId));
  if (profile.avatarImageId) await deleteImage(profile.avatarImageId);
  return imageId;
}

export async function removeAvatar(actor: Actor, userId: string) {
  if (actor.id !== userId && !hasPermission(actor, "members:manage")) throw new ForbiddenError();
  const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (!profile?.avatarImageId) return;
  await db.update(profiles).set({ avatarImageId: null }).where(eq(profiles.userId, userId));
  await deleteImage(profile.avatarImageId);
}

export async function countPendingRegistrations() {
  const [row] = await db.select({ n: count() }).from(users).where(eq(users.status, "AUSSTEHEND"));
  return row.n;
}
