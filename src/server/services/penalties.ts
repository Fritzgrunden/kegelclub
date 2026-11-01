import "server-only";
import { and, asc, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import { addDaysYmd, toYmd, zonedToUtc } from "@/lib/dates";
import { db } from "@/server/db";
import { events, penalties, penaltyTypes, profiles } from "@/server/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { displayName, penaltyLabel } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { penaltySchema, penaltyTypeSchema, zodFieldErrors } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";
import { settleCredit } from "./cash";

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
    amountCents: (amountCents ?? 0) * input.quantity,
    quantity: input.quantity,
    date: input.date,
    eventId: input.eventId,
    comment: input.comment,
  };
}

export async function createPenalty(actor: Actor, raw: unknown) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  const values = await resolve(raw);
  const [row] = await db.insert(penalties).values({ ...values, createdById: actor.id }).returning({ id: penalties.id });
  await settleCredit(values.userId);
  return row.id;
}

/** Heutiger Termin (Kegelabend bevorzugt), abgesagte zählen nicht. */
async function todaysEventId(today: string) {
  const todays = await db
    .select({ id: events.id, kind: events.kind })
    .from(events)
    .where(
      and(
        gte(events.startsAt, zonedToUtc(today, "00:00")),
        lt(events.startsAt, zonedToUtc(addDaysYmd(today, 1), "00:00")),
        ne(events.status, "ABGESAGT"),
      ),
    )
    .orderBy(asc(events.startsAt));
  const event = todays.find((e) => e.kind === "KEGELABEND") ?? todays[0];
  return event?.id ?? null;
}

/**
 * Schnellerfassung an der Bahn: nur Mitglied + Strafart. Datum ist heute, der Termin wird automatisch
 * zugeordnet, wenn heute einer stattfindet (Kegelabend bevorzugt).
 */
export async function createQuickPenalty(actor: Actor, userId: string, penaltyTypeId: string, quantity = 1) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  const today = toYmd(new Date());
  return createPenalty(actor, { userId, penaltyTypeId, amountCents: null, quantity, date: today, eventId: await todaysEventId(today) });
}

/**
 * Schnellerfassung mit frei gewähltem Titel und Betrag. Mit `saveToCatalog` wird daraus zugleich
 * eine neue Strafart, die beim nächsten Mal direkt zur Auswahl steht.
 */
export async function createQuickCustomPenalty(actor: Actor, userId: string, label: string, amountCents: number, saveToCatalog = false, quantity = 1) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  if (saveToCatalog) return createQuickPenalty(actor, userId, await savePenaltyType(actor, null, { name: label, amountCents, active: true }), quantity);
  const today = toYmd(new Date());
  return createPenalty(actor, { userId, penaltyTypeId: null, customLabel: label, amountCents, quantity, date: today, eventId: await todaysEventId(today) });
}

export async function updatePenalty(actor: Actor, id: string, raw: unknown) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  const values = await resolve(raw);
  const [before] = await db.select({ userId: penalties.userId }).from(penalties).where(eq(penalties.id, id));
  if (!before) throw new NotFoundError("Strafe nicht gefunden.");
  // Wechselt das Mitglied, gehört das verrechnete Guthaben nicht mehr dazu.
  const reset = before.userId !== values.userId ? { creditCents: 0, paidAt: null } : {};
  await db.update(penalties).set({ ...values, ...reset, updatedAt: new Date() }).where(eq(penalties.id, id));
  await settleCredit(values.userId);
  if (before.userId !== values.userId) await settleCredit(before.userId);
}

/** Freiwerdendes Guthaben bleibt stehen und wird mit der nächsten Strafe verrechnet. */
export async function deletePenalty(actor: Actor, id: string) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  await db.delete(penalties).where(eq(penalties.id, id));
}

/**
 * „Bezahlt“ = der noch offene Rest kam bar in die Kasse. „Offen“ setzt auch eine Verrechnung mit
 * Guthaben zurück – das Guthaben steht dann wieder zur Verfügung.
 */
export async function setPenaltyPaid(actor: Actor, id: string, paid: boolean) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  await db
    .update(penalties)
    .set(paid ? { paidAt: new Date(), updatedAt: new Date() } : { paidAt: null, creditCents: 0, updatedAt: new Date() })
    .where(eq(penalties.id, id));
}

/** Ein Mitglied zahlt alles auf einmal: alle offenen Strafen als bezahlt markieren. Gibt die Anzahl zurück. */
export async function markAllPaidForMember(actor: Actor, userId: string) {
  assertCan(actor, "penalties:manage", KASSENWART_ONLY);
  const res = await db
    .update(penalties)
    .set({ paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(penalties.userId, userId), isNull(penalties.paidAt)))
    .returning({ id: penalties.id });
  return res.length;
}

export async function getPenalty(id: string) {
  return db.query.penalties.findFirst({ where: eq(penalties.id, id) });
}

export interface PenaltyListItem {
  id: string;
  userId: string;
  memberName: string;
  /** Mit Anzahl, z. B. „3× Gosse“. */
  label: string;
  amountCents: number;
  /** Bereits mit Guthaben verrechnet; offen ist `amountCents - creditCents`. */
  creditCents: number;
  quantity: number;
  date: string;
  eventId: string | null;
  eventTitle: string | null;
  comment: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

/** Ohne „penalties:view-all“ sieht man ausschließlich die eigenen Strafen – serverseitig erzwungen. */
export async function listPenalties(
  actor: Actor,
  opts: { userId?: string; eventId?: string; openOnly?: boolean; limit?: number } = {},
): Promise<PenaltyListItem[]> {
  const targetUser = hasPermission(actor, "penalties:view-all") ? opts.userId : actor.id;
  const conditions = [];
  if (targetUser) conditions.push(eq(penalties.userId, targetUser));
  if (opts.eventId) conditions.push(eq(penalties.eventId, opts.eventId));
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
      creditCents: penalties.creditCents,
      quantity: penalties.quantity,
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
    label: penaltyLabel(r.typeName ?? r.customLabel ?? "Sonstige Strafe", r.quantity),
    amountCents: r.amountCents,
    creditCents: r.creditCents,
    quantity: r.quantity,
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
    .select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${penalties.amountCents} - ${penalties.creditCents}), 0)::int` })
    .from(penalties)
    .where(and(eq(penalties.userId, userId), isNull(penalties.paidAt)));
  return { count: Number(row.n), totalCents: Number(row.total) };
}

/* ───────────── Statistik ───────────── */

export interface PenaltyStats {
  totalCount: number;
  totalCents: number;
  /** Sünderkartei: wer hat wie viele Strafen; `count` zählt „3× Gosse“ als 3. */
  members: {
    userId: string;
    displayName: string;
    firstName: string;
    lastName: string;
    avatarImageId: string | null;
    count: number;
    totalCents: number;
    favorite: { label: string; count: number } | null;
  }[];
  /** Häufigste Strafen */
  types: { label: string; count: number; totalCents: number }[];
  /** Teuerste Abende */
  evenings: { eventId: string; title: string; date: string; count: number; totalCents: number }[];
}

/** Lustige Auswertung für alle, die alle Strafen sehen dürfen – optional für ein Jahr. */
export async function getPenaltyStats(actor: Actor, year?: number): Promise<PenaltyStats> {
  assertCan(actor, "penalties:view-all");
  const inYear = year ? and(gte(penalties.date, `${year}-01-01`), lt(penalties.date, `${year + 1}-01-01`)) : undefined;
  // Ohne Parameter, damit SELECT und GROUP BY denselben Ausdruck haben
  const label = sql<string | null>`coalesce(${penaltyTypes.name}, ${penalties.customLabel})`;
  const labelText = (l: string | null) => l ?? "Sonstige Strafe";
  const count = sql<number>`sum(${penalties.quantity})::int`;
  const total = sql<number>`sum(${penalties.amountCents})::int`;

  const [members, perMemberType, types, evenings] = await Promise.all([
    db
      .select({
        userId: penalties.userId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        nickname: profiles.nickname,
        avatarImageId: profiles.avatarImageId,
        count,
        total,
      })
      .from(penalties)
      .innerJoin(profiles, eq(profiles.userId, penalties.userId))
      .where(inYear)
      .groupBy(penalties.userId, profiles.firstName, profiles.lastName, profiles.nickname, profiles.avatarImageId)
      .orderBy(desc(count), desc(total)),
    db
      .select({ userId: penalties.userId, label, count })
      .from(penalties)
      .leftJoin(penaltyTypes, eq(penaltyTypes.id, penalties.penaltyTypeId))
      .where(inYear)
      .groupBy(penalties.userId, label),
    db
      .select({ label, count, total })
      .from(penalties)
      .leftJoin(penaltyTypes, eq(penaltyTypes.id, penalties.penaltyTypeId))
      .where(inYear)
      .groupBy(label)
      .orderBy(desc(count), desc(total))
      .limit(10),
    db
      .select({ eventId: events.id, title: events.title, startsAt: events.startsAt, count, total })
      .from(penalties)
      .innerJoin(events, eq(events.id, penalties.eventId))
      .where(inYear)
      .groupBy(events.id, events.title, events.startsAt)
      .orderBy(desc(total))
      .limit(3),
  ]);

  const favorites = new Map<string, { label: string; count: number }>();
  for (const r of perMemberType) {
    const best = favorites.get(r.userId);
    if (!best || Number(r.count) > best.count) favorites.set(r.userId, { label: labelText(r.label), count: Number(r.count) });
  }

  const memberRows = members.map((m) => ({
    userId: m.userId,
    displayName: displayName(m),
    firstName: m.firstName,
    lastName: m.lastName,
    avatarImageId: m.avatarImageId,
    count: Number(m.count),
    totalCents: Number(m.total),
    favorite: favorites.get(m.userId) ?? null,
  }));
  return {
    totalCount: memberRows.reduce((s, m) => s + m.count, 0),
    totalCents: memberRows.reduce((s, m) => s + m.totalCents, 0),
    members: memberRows,
    types: types.map((t) => ({ label: labelText(t.label), count: Number(t.count), totalCents: Number(t.total) })),
    evenings: evenings.map((e) => ({ eventId: e.eventId, title: e.title, date: toYmd(e.startsAt), count: Number(e.count), totalCents: Number(e.total) })),
  };
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
      total: sql<number>`sum(${penalties.amountCents} - ${penalties.creditCents})::int`,
    })
    .from(penalties)
    .innerJoin(profiles, eq(profiles.userId, penalties.userId))
    .where(isNull(penalties.paidAt))
    .groupBy(penalties.userId, profiles.firstName, profiles.lastName, profiles.nickname, profiles.avatarImageId)
    .orderBy(desc(sql`sum(${penalties.amountCents} - ${penalties.creditCents})`));
  return rows.map((r) => ({ ...r, displayName: displayName(r), n: Number(r.n), total: Number(r.total) }));
}
