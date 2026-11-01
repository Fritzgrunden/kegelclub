import "server-only";
import { and, asc, desc, eq, gt, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { cashEntries, dues, penalties, profiles, users, type CashEntryKind } from "@/server/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { displayName } from "@/lib/format";
import { cashEntrySchema, zodFieldErrors } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

/*
 * Kasse: Der Kassenstand ergibt sich aus allem, was bar hereinkam oder hinausging –
 * bezahlte Strafen und Beiträge, sonstige Einnahmen, Ausgaben aus der Kasse.
 *
 * Legt ein Mitglied eine Ausgabe aus eigener Tasche aus (z. B. eine Runde), bleibt der Kassenstand
 * unverändert. Das Mitglied bekommt den Betrag als Guthaben, das automatisch mit seinen offenen
 * Strafen verrechnet wird (älteste zuerst, auch teilweise). Was übrig bleibt, wird mit späteren
 * Strafen verrechnet.
 */

const MANAGE_ONLY = "Nur der Kassenwart darf Einnahmen und Ausgaben eintragen.";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function creditBalance(tx: Tx, userId: string) {
  const [row] = await tx
    .select({
      advanced: sql<number>`coalesce((select sum(${cashEntries.amountCents}) from ${cashEntries} where ${cashEntries.paidByUserId} = ${userId} and ${cashEntries.kind} = 'AUSGABE'), 0)::int`,
      used: sql<number>`coalesce((select sum(${penalties.creditCents}) from ${penalties} where ${penalties.userId} = ${userId}), 0)::int`,
    })
    .from(sql`(select 1) as one`);
  return Number(row.advanced) - Number(row.used);
}

/**
 * Bringt verrechnetes Guthaben und Auslagen eines Mitglieds in Einklang: Freies Guthaben begleicht
 * offene Strafen; ist mehr verrechnet als ausgelegt (z. B. Auslage gelöscht), werden die zuletzt
 * verrechneten Strafen wieder geöffnet.
 */
export async function settleCredit(userId: string) {
  await db.transaction(async (tx) => {
    // Betrag einer Strafe wurde nachträglich gesenkt
    await tx
      .update(penalties)
      .set({ creditCents: sql`${penalties.amountCents}` })
      .where(and(eq(penalties.userId, userId), gt(penalties.creditCents, penalties.amountCents)));

    let balance = await creditBalance(tx, userId);

    if (balance < 0) {
      const credited = await tx
        .select({ id: penalties.id, creditCents: penalties.creditCents })
        .from(penalties)
        .where(and(eq(penalties.userId, userId), gt(penalties.creditCents, 0)))
        .orderBy(desc(penalties.date), desc(penalties.createdAt));
      for (const p of credited) {
        if (balance >= 0) break;
        const take = Math.min(p.creditCents, -balance);
        await tx.update(penalties).set({ creditCents: p.creditCents - take, paidAt: null, updatedAt: new Date() }).where(eq(penalties.id, p.id));
        balance += take;
      }
    }

    if (balance > 0) {
      const open = await tx
        .select({ id: penalties.id, amountCents: penalties.amountCents, creditCents: penalties.creditCents })
        .from(penalties)
        .where(and(eq(penalties.userId, userId), isNull(penalties.paidAt)))
        .orderBy(asc(penalties.date), asc(penalties.createdAt));
      for (const p of open) {
        if (balance <= 0) break;
        const use = Math.min(balance, p.amountCents - p.creditCents);
        if (use <= 0) continue;
        const credit = p.creditCents + use;
        await tx
          .update(penalties)
          .set({ creditCents: credit, paidAt: credit >= p.amountCents ? new Date() : null, updatedAt: new Date() })
          .where(eq(penalties.id, p.id));
        balance -= use;
      }
    }
  });
}

/* ───────────── Einträge ───────────── */

export async function createCashEntry(actor: Actor, raw: unknown) {
  assertCan(actor, "cash:manage", MANAGE_ONLY);
  const parsed = cashEntrySchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  const input = parsed.data;
  if (input.paidByUserId) {
    const member = await db.query.users.findFirst({ where: eq(users.id, input.paidByUserId), columns: { id: true } });
    if (!member) throw new AppError("Mitglied nicht gefunden.", "VALIDATION", { paidByUserId: "Unbekanntes Mitglied." });
  }
  const [row] = await db.insert(cashEntries).values({ ...input, createdById: actor.id }).returning({ id: cashEntries.id });
  if (input.paidByUserId) await settleCredit(input.paidByUserId);
  return row.id;
}

export async function deleteCashEntry(actor: Actor, id: string) {
  assertCan(actor, "cash:manage", MANAGE_ONLY);
  const [row] = await db.delete(cashEntries).where(eq(cashEntries.id, id)).returning({ paidByUserId: cashEntries.paidByUserId });
  if (!row) throw new NotFoundError("Eintrag nicht gefunden.");
  if (row.paidByUserId) await settleCredit(row.paidByUserId);
}

/* ───────────── Übersicht ───────────── */

export interface CashSummary {
  balanceCents: number;
  penaltiesCents: number;
  duesCents: number;
  incomeCents: number;
  expenseCents: number;
  /** Von Mitgliedern ausgelegt und mit Strafen verrechnet – ändert den Kassenstand nicht. */
  advancedCents: number;
}

export async function getCashSummary(actor: Actor): Promise<CashSummary> {
  assertCan(actor, "cash:view");
  const [row] = await db
    .select({
      penalties: sql<number>`coalesce((select sum(${penalties.amountCents} - ${penalties.creditCents}) from ${penalties} where ${penalties.paidAt} is not null), 0)::int`,
      dues: sql<number>`coalesce((select sum(${dues.amountCents}) from ${dues} where ${dues.paidAt} is not null), 0)::int`,
      income: sql<number>`coalesce((select sum(${cashEntries.amountCents}) from ${cashEntries} where ${cashEntries.kind} = 'EINNAHME'), 0)::int`,
      expense: sql<number>`coalesce((select sum(${cashEntries.amountCents}) from ${cashEntries} where ${cashEntries.kind} = 'AUSGABE' and ${cashEntries.paidByUserId} is null), 0)::int`,
      advanced: sql<number>`coalesce((select sum(${cashEntries.amountCents}) from ${cashEntries} where ${cashEntries.kind} = 'AUSGABE' and ${cashEntries.paidByUserId} is not null), 0)::int`,
    })
    .from(sql`(select 1) as one`);
  const s = { penaltiesCents: Number(row.penalties), duesCents: Number(row.dues), incomeCents: Number(row.income), expenseCents: Number(row.expense) };
  return { ...s, balanceCents: s.penaltiesCents + s.duesCents + s.incomeCents - s.expenseCents, advancedCents: Number(row.advanced) };
}

export interface CashEntryItem {
  id: string;
  kind: CashEntryKind;
  amountCents: number;
  description: string;
  date: string;
  paidByUserId: string | null;
  paidByName: string | null;
}

export async function listCashEntries(actor: Actor, limit = 200): Promise<CashEntryItem[]> {
  assertCan(actor, "cash:view");
  const rows = await db
    .select({
      id: cashEntries.id,
      kind: cashEntries.kind,
      amountCents: cashEntries.amountCents,
      description: cashEntries.description,
      date: cashEntries.date,
      paidByUserId: cashEntries.paidByUserId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
    })
    .from(cashEntries)
    .leftJoin(profiles, eq(profiles.userId, cashEntries.paidByUserId))
    .orderBy(desc(cashEntries.date), desc(cashEntries.createdAt))
    .limit(limit);
  return rows.map(({ firstName, lastName, nickname, ...r }) => ({
    ...r,
    paidByName: firstName && lastName ? displayName({ firstName, lastName, nickname }) : null,
  }));
}

/** Mitglieder mit noch nicht verrechnetem Guthaben. */
export async function listCredits(actor: Actor) {
  assertCan(actor, "cash:view");
  const rows = await db
    .select({
      userId: cashEntries.paidByUserId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      credit: sql<number>`(sum(${cashEntries.amountCents}) - coalesce((select sum(p.credit_cents) from ${penalties} p where p.user_id = ${cashEntries.paidByUserId}), 0))::int`,
    })
    .from(cashEntries)
    .innerJoin(profiles, eq(profiles.userId, cashEntries.paidByUserId))
    .where(and(isNotNull(cashEntries.paidByUserId), eq(cashEntries.kind, "AUSGABE")))
    .groupBy(cashEntries.paidByUserId, profiles.firstName, profiles.lastName, profiles.nickname);
  return rows
    .map((r) => ({ userId: r.userId!, displayName: displayName(r), creditCents: Number(r.credit) }))
    .filter((r) => r.creditCents > 0)
    .sort((a, b) => b.creditCents - a.creditCents);
}
