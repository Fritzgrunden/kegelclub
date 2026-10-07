import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { events, penalties, penaltyTypes, profiles } from "@/server/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { displayName } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { penaltySchema, penaltyTypeSchema, zodFieldErrors } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

const KASSENWART_ONLY = "Nur der Kassenwart darf Strafen verwalten.";

/* ───────────── Strafkatalog ───────────── */

export async function listPenaltyTypes(opts: { includeInactive?: boolean } = {}) {
  return db
    .select()
    .from(penaltyTypes)
    .where(opts.includeInactive ? undefined : eq(penaltyTypes.active, true))
    .orderBy(asc(penaltyTypes.sortOrder), asc(penaltyTypes.name));
}

export async function savePenaltyType(actor: Actor, id: string | null, raw: unknown) {
  assertCan(actor, "penalty-catalog:manage", KASSENWART_ONLY);
  const parsed = penaltyTypeSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  if (id) {
    const res = await db.update(penaltyTypes).set({ ...parsed.data, updatedAt: new Date() }).where(eq(penaltyTypes.id, id)).returning({ id: penaltyTypes.id });
    if (res.length === 0) throw new NotFoundError("Strafart nicht gefunden.");
    return id;
  }
  const [row] = await db.insert(penaltyTypes).values(parsed.data).returning({ id: penaltyTypes.id });
  return row.id;
}

/** Bereits vergebene Strafarten bleiben erhalten (Historie) – sie können nur deaktiviert werden. */
export async function deletePenaltyType(actor: Actor, id: string) {
  assertCan(actor, "penalty-catalog:manage", KASSENWART_ONLY);
  const used = await db.query.penalties.findFirst({ where: eq(penalties.penaltyTypeId, id), columns: { id: true } });
  if (used) throw new AppError("Diese Strafart wurde bereits vergeben. Setze sie stattdessen auf „inaktiv“.");
  await db.delete(penaltyTypes).where(eq(penaltyTypes.id, id));
}

/* ───────────── Vergebene Strafen ───────────── */

async function resolve(raw: unknown) {
  const parsed = penaltySchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  const input = parsed.data;
  let amountCents = input.amountCents;
  if (input.penaltyTypeId) {
    const type = await db.query.penaltyTypes.findFirst({ where: eq(penaltyTypes.id, input.penaltyTypeId) });
    if (!type) throw new AppError("Strafart nicht gefunden.", "VALIDATION", { penaltyTypeId: "Unbekannte Strafart." });
    amountCents ??= type.amountCents;
  }
  const member = await db.query.profiles.findFirst({ where: eq(profiles.userId, input.userId), columns: { userId: true } });
  if (!member) throw new AppError("Mitglied nicht gefunden.", "VALIDATION", { userId: "Unbekanntes Mitglied." });
  return {
    userId: input.userId,
    penaltyTypeId: input.penaltyTypeId,
    customLabel: input.penaltyTypeId ? null : input.customLabel,
    amountCents: amountCents ?? 0,
    date: input.date,
    eventId: input.eventId,
    comment: input.comment,
  };
}

export async function createPenalty(actor: Actor, raw: unknown) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  const values = await resolve(raw);
  const [row] = await db.insert(penalties).values({ ...values, createdById: actor.id }).returning({ id: penalties.id });
  return row.id;
}

export async function updatePenalty(actor: Actor, id: string, raw: unknown) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  const values = await resolve(raw);
  const res = await db.update(penalties).set({ ...values, updatedAt: new Date() }).where(eq(penalties.id, id)).returning({ id: penalties.id });
  if (res.length === 0) throw new NotFoundError("Strafe nicht gefunden.");
}

export async function deletePenalty(actor: Actor, id: string) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  await db.delete(penalties).where(eq(penalties.id, id));
}

/** Markierung „bezahlt“ – bewusst ohne Kassenbuch (folgt später im Finanzmodul). */
export async function setPenaltyPaid(actor: Actor, id: string, paid: boolean) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  await db.update(penalties).set({ paidAt: paid ? new Date() : null, updatedAt: new Date() }).where(eq(penalties.id, id));
}

export async function getPenalty(id: string) {
  return db.query.penalties.findFirst({ where: eq(penalties.id, id) });
}

export interface PenaltyListItem {
  id: string;
  userId: string;
  memberName: string;
  label: string;
  amountCents: number;
  date: string;
  eventId: string | null;
  eventTitle: string | null;
  comment: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

/** Ohne „penalties:view-all“ sieht man ausschließlich die eigenen Strafen – serverseitig erzwungen. */
export async function listPenalties(actor: Actor, opts: { userId?: string; openOnly?: boolean; limit?: number } = {}): Promise<PenaltyListItem[]> {
  const targetUser = hasPermission(actor, "penalties:view-all") ? opts.userId : actor.id;
  const conditions = [];
  if (targetUser) conditions.push(eq(penalties.userId, targetUser));
  if (opts.openOnly) conditions.push(isNull(penalties.paidAt));

  const rows = await db
    .select({
      id: penalties.id,
      userId: penalties.userId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      typeName: penaltyTypes.name,
      customLabel: penalties.customLabel,
      amountCents: penalties.amountCents,
      date: penalties.date,
      eventId: penalties.eventId,
      eventTitle: events.title,
      comment: penalties.comment,
      paidAt: penalties.paidAt,
      createdAt: penalties.createdAt,
    })
    .from(penalties)
    .innerJoin(profiles, eq(profiles.userId, penalties.userId))
    .leftJoin(penaltyTypes, eq(penaltyTypes.id, penalties.penaltyTypeId))
    .leftJoin(events, eq(events.id, penalties.eventId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(penalties.date), desc(penalties.createdAt))
    .limit(opts.limit ?? 500);

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    memberName: displayName(r),
    label: r.typeName ?? r.customLabel ?? "Sonstige Strafe",
    amountCents: r.amountCents,
    date: r.date,
    eventId: r.eventId,
    eventTitle: r.eventTitle,
    comment: r.comment,
    paidAt: r.paidAt,
    createdAt: r.createdAt,
  }));
}

export async function getOpenPenaltySummary(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${penalties.amountCents}), 0)::int` })
    .from(penalties)
    .where(and(eq(penalties.userId, userId), isNull(penalties.paidAt)));
  return { count: Number(row.n), totalCents: Number(row.total) };
}

/** Offene Beträge je Mitglied (Kassenwart-Übersicht). */
export async function getOpenTotalsByMember(actor: Actor) {
  assertCan(actor, "penalties:view-all");
  const rows = await db
    .select({
      userId: penalties.userId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      avatarImageId: profiles.avatarImageId,
      n: sql<number>`count(*)::int`,
      total: sql<number>`sum(${penalties.amountCents})::int`,
    })
    .from(penalties)
    .innerJoin(profiles, eq(profiles.userId, penalties.userId))
    .where(isNull(penalties.paidAt))
    .groupBy(penalties.userId, profiles.firstName, profiles.lastName, profiles.nickname, profiles.avatarImageId)
    .orderBy(desc(sql`sum(${penalties.amountCents})`));
  return rows.map((r) => ({ ...r, displayName: displayName(r), n: Number(r.n), total: Number(r.total) }));
}
