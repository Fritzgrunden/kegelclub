import "server-only";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { addMonthsYmd, toYmd } from "@/lib/dates";
import { db } from "@/server/db";
import { dues, profiles, settings, users } from "@/server/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { displayName } from "@/lib/format";
import { duesAmountSchema, monthSchema } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

/*
 * Monatsbeiträge: Der Kassenwart legt einen Standardbeitrag fest (optional je Mitglied abweichend)
 * und erzeugt pro Monat die Beiträge aller aktiven und passiven Mitglieder. Der Betrag wird dabei
 * festgeschrieben – spätere Änderungen am Beitrag gelten erst für neu angelegte Monate.
 */

const DEFAULT_KEY = "duesDefaultCents";
const MANAGE_ONLY = "Nur der Kassenwart darf Beiträge verwalten.";

/** "2026-10" für den aktuellen Monat in Vereinszeit. */
export const currentMonth = () => toYmd(new Date()).slice(0, 7);
export const shiftMonth = (month: string, by: number) => addMonthsYmd(`${month}-01`, by, 1).slice(0, 7);
const monthDate = (month: string) => `${month}-01`;

function parseMonth(month: string) {
  const parsed = monthSchema.safeParse(month);
  if (!parsed.success) throw new AppError("Ungültiger Monat.");
  return parsed.data;
}

function parseCents(cents: number) {
  const parsed = duesAmountSchema.safeParse(cents);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message, "VALIDATION", { amount: parsed.error.issues[0].message });
  return parsed.data;
}

/* ───────────── Beitragshöhe ───────────── */

export async function getDuesDefaultCents() {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, DEFAULT_KEY) });
  return row ? Number(row.value) || 0 : 0;
}

export async function setDuesDefault(actor: Actor, cents: number) {
  assertCan(actor, "dues:manage", MANAGE_ONLY);
  const value = String(parseCents(cents));
  await db.insert(settings).values({ key: DEFAULT_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Abweichende Beiträge je Mitglied; null = Standardbeitrag, 0 = beitragsfrei. */
export async function setMemberDuesAmounts(actor: Actor, amounts: Record<string, number | null>) {
  assertCan(actor, "dues:manage", MANAGE_ONLY);
  const entries = Object.entries(amounts).map(([userId, cents]) => [userId, cents === null ? null : parseCents(cents)] as const);
  await db.transaction(async (tx) => {
    for (const [userId, duesCents] of entries) {
      await tx.update(profiles).set({ duesCents, updatedAt: new Date() }).where(eq(profiles.userId, userId));
    }
  });
}

/* ───────────── Monatsübersicht ───────────── */

export interface DuesMonthRow {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarImageId: string | null;
  /** Abweichender Beitrag des Mitglieds (null = Standard). */
  overrideCents: number | null;
  entry: { id: string; amountCents: number; paidAt: Date | null } | null;
}

/** Alle aktiven/passiven Mitglieder plus alle, die in diesem Monat einen Beitrag haben. */
export async function getDuesMonth(actor: Actor, month: string): Promise<DuesMonthRow[]> {
  assertCan(actor, "dues:view-all");
  const date = monthDate(parseMonth(month));
  const rows = await db
    .select({
      userId: users.id,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      avatarImageId: profiles.avatarImageId,
      overrideCents: profiles.duesCents,
      entryId: dues.id,
      amountCents: dues.amountCents,
      paidAt: dues.paidAt,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(dues, and(eq(dues.userId, users.id), eq(dues.month, date)))
    .where(or(inArray(users.status, ["AKTIV", "PASSIV"]), sql`${dues.id} is not null`))
    .orderBy(asc(profiles.firstName), asc(profiles.lastName));
  return rows.map((r) => ({
    userId: r.userId,
    displayName: displayName(r),
    firstName: r.firstName,
    lastName: r.lastName,
    avatarImageId: r.avatarImageId,
    overrideCents: r.overrideCents,
    entry: r.entryId ? { id: r.entryId, amountCents: r.amountCents!, paidAt: r.paidAt } : null,
  }));
}

/**
 * Legt die Beiträge eines Monats für alle aktiven und passiven Mitglieder an, die noch keinen haben.
 * Mehrfach aufrufbar (z. B. nach Neuaufnahme). Beitragsfreie Mitglieder (0 €) werden übersprungen.
 */
export async function createDuesForMonth(actor: Actor, month: string) {
  assertCan(actor, "dues:manage", MANAGE_ONLY);
  const date = monthDate(parseMonth(month));
  const defaultCents = await getDuesDefaultCents();
  const members = await db
    .select({ userId: users.id, overrideCents: profiles.duesCents, existing: dues.id })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(dues, and(eq(dues.userId, users.id), eq(dues.month, date)))
    .where(inArray(users.status, ["AKTIV", "PASSIV"]));

  const values = members
    .filter((m) => !m.existing)
    .map((m) => ({ userId: m.userId, month: date, amountCents: m.overrideCents ?? defaultCents, createdById: actor.id }))
    .filter((v) => v.amountCents > 0);
  if (values.length === 0) {
    if (defaultCents === 0 && members.every((m) => m.overrideCents === null)) {
      throw new AppError("Bitte zuerst die Höhe des Monatsbeitrags festlegen.");
    }
    return 0;
  }
  const res = await db.insert(dues).values(values).onConflictDoNothing().returning({ id: dues.id });
  return res.length;
}

export async function setDuesPaid(actor: Actor, id: string, paid: boolean) {
  assertCan(actor, "dues:manage", MANAGE_ONLY);
  const res = await db.update(dues).set({ paidAt: paid ? new Date() : null, updatedAt: new Date() }).where(eq(dues.id, id)).returning({ id: dues.id });
  if (res.length === 0) throw new NotFoundError("Beitrag nicht gefunden.");
}

/** Beitrag für diesen Monat erlassen bzw. versehentlich angelegten Eintrag entfernen. */
export async function deleteDues(actor: Actor, id: string) {
  assertCan(actor, "dues:manage", MANAGE_ONLY);
  await db.delete(dues).where(eq(dues.id, id));
}

/** Alle offenen Beiträge eines Mitglieds als bezahlt markieren. Gibt die Anzahl zurück. */
export async function markAllDuesPaidForMember(actor: Actor, userId: string) {
  assertCan(actor, "dues:manage", MANAGE_ONLY);
  const res = await db
    .update(dues)
    .set({ paidAt: new Date(), updatedAt: new Date() })
    .where(and(eq(dues.userId, userId), isNull(dues.paidAt)))
    .returning({ id: dues.id });
  return res.length;
}

/* ───────────── Offene Beiträge ───────────── */

export interface DuesItem {
  id: string;
  month: string;
  amountCents: number;
  paidAt: Date | null;
}

/** Eigene Beiträge, neueste zuerst. Andere Mitglieder sind über diese Funktion nie sichtbar. */
export async function listOwnDues(actor: Actor, limit = 36): Promise<DuesItem[]> {
  assertCan(actor, "dues:view-own");
  const rows = await db
    .select({ id: dues.id, month: dues.month, amountCents: dues.amountCents, paidAt: dues.paidAt })
    .from(dues)
    .where(eq(dues.userId, actor.id))
    .orderBy(desc(dues.month))
    .limit(limit);
  return rows.map((r) => ({ ...r, month: r.month.slice(0, 7) }));
}

export async function getOpenDuesSummary(userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int`, total: sql<number>`coalesce(sum(${dues.amountCents}), 0)::int` })
    .from(dues)
    .where(and(eq(dues.userId, userId), isNull(dues.paidAt)));
  return { count: Number(row.n), totalCents: Number(row.total) };
}

/** Offene Beiträge je Mitglied über alle Monate (Kassenwart-Übersicht). */
export async function getOpenDuesByMember(actor: Actor) {
  assertCan(actor, "dues:view-all");
  const rows = await db
    .select({
      userId: dues.userId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      avatarImageId: profiles.avatarImageId,
      n: sql<number>`count(*)::int`,
      total: sql<number>`sum(${dues.amountCents})::int`,
    })
    .from(dues)
    .innerJoin(profiles, eq(profiles.userId, dues.userId))
    .where(isNull(dues.paidAt))
    .groupBy(dues.userId, profiles.firstName, profiles.lastName, profiles.nickname, profiles.avatarImageId)
    .orderBy(desc(sql`sum(${dues.amountCents})`));
  return rows.map((r) => ({ ...r, displayName: displayName(r), n: Number(r.n), total: Number(r.total) }));
}
