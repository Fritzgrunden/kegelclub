import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, lte, max, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  eventParticipations,
  eventSeries,
  events,
  profiles,
  users,
  type EventKind,
  type EventStatus,
  type RsvpStatus,
} from "@/server/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { addDaysYmd, toYmd, zonedToUtc } from "@/lib/dates";
import { displayName } from "@/lib/format";
import { generateOccurrenceDates } from "@/lib/recurrence";
import { eventInputSchema, zodFieldErrors, type EventInput } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

export type EventRow = typeof events.$inferSelect;
export type EditScope = "EINZELN" | "SERIE";
export type DeleteScope = "EINZELN" | "FOLGENDE";

function parseInput(raw: unknown): EventInput {
  const parsed = eventInputSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  const input = parsed.data;
  if (input.kind === "KEGELABEND") input.eventType = null;
  else input.eventType ??= "SONSTIGES";
  return input;
}

function computeEnd(input: EventInput, startsAt: Date): Date | null {
  if (!input.endDate && !input.endTime) return null;
  const endsAt = zonedToUtc(input.endDate ?? input.date, input.endTime ?? "23:59");
  if (endsAt <= startsAt) {
    throw new AppError("Das Ende muss nach dem Beginn liegen.", "VALIDATION", { endTime: "Das Ende muss nach dem Beginn liegen." });
  }
  return endsAt;
}

/* ───────────── Anlegen ───────────── */

export async function createEvent(actor: Actor, raw: unknown, imageId: string | null = null) {
  assertCan(actor, "events:manage");
  const input = parseInput(raw);

  const common = {
    kind: input.kind,
    eventType: input.eventType ?? null,
    title: input.title,
    description: input.description,
    location: input.location,
    imageId,
    createdById: actor.id,
  };

  if (input.recurrence === "KEINE") {
    const startsAt = zonedToUtc(input.date, input.time);
    const [row] = await db
      .insert(events)
      .values({ ...common, startsAt, endsAt: computeEnd(input, startsAt) })
      .returning({ id: events.id });
    return { eventId: row.id, seriesId: null, count: 1 };
  }

  let dates: string[];
  try {
    dates = generateOccurrenceDates({
      startDate: input.date,
      recurrence: input.recurrence,
      intervalDays: input.intervalDays,
      endDate: input.seriesEndDate,
    });
  } catch (e) {
    throw new AppError(e instanceof Error ? e.message : "Ungültige Wiederholung.");
  }
  if (dates.length === 0) throw new AppError("Mit diesen Angaben entsteht kein einziger Termin.");

  return db.transaction(async (tx) => {
    const [series] = await tx
      .insert(eventSeries)
      .values({
        ...common,
        startDate: input.date,
        startTime: input.time,
        recurrence: input.recurrence,
        intervalDays: input.recurrence === "INDIVIDUELL" ? input.intervalDays : null,
        endDate: input.seriesEndDate,
      })
      .returning({ id: eventSeries.id });

    const inserted = await tx
      .insert(events)
      .values(dates.map((d) => ({ ...common, seriesId: series.id, seriesDate: d, startsAt: zonedToUtc(d, input.time) })))
      .returning({ id: events.id, startsAt: events.startsAt });
    inserted.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return { eventId: inserted[0].id, seriesId: series.id, count: inserted.length };
  });
}

/* ───────────── Bearbeiten ───────────── */

/**
 * scope = EINZELN: nur dieser Termin; ein Serientermin wird dabei „abgekoppelt“ (isDetached),
 *                  damit spätere Serienänderungen ihn nicht überschreiben.
 * scope = SERIE:   Serienregel + alle zukünftigen, nicht abgekoppelten Termine.
 *                  Ein späteres Serienende verlängert die Serie, ein früheres entfernt überzählige Termine.
 *                  Der Wiederholungsrhythmus selbst bleibt unverändert (dafür neue Serie anlegen).
 */
export async function updateEvent(actor: Actor, eventId: string, raw: unknown, scope: EditScope = "EINZELN") {
  assertCan(actor, "events:manage");
  const existing = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!existing) throw new NotFoundError("Termin nicht gefunden.");
  const input = parseInput({ ...(raw as object), kind: existing.kind });

  if (scope === "EINZELN" || !existing.seriesId) {
    const startsAt = zonedToUtc(input.date, input.time);
    await db
      .update(events)
      .set({
        eventType: input.eventType ?? null,
        title: input.title,
        description: input.description,
        location: input.location,
        startsAt,
        endsAt: computeEnd(input, startsAt),
        isDetached: existing.seriesId !== null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));
    return { updated: 1 };
  }

  const seriesId = existing.seriesId;
  const series = await db.query.eventSeries.findFirst({ where: eq(eventSeries.id, seriesId) });
  if (!series) throw new NotFoundError("Serie nicht gefunden.");
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(eventSeries)
      .set({
        eventType: input.eventType ?? null,
        title: input.title,
        description: input.description,
        location: input.location,
        startTime: input.time,
        endDate: input.seriesEndDate,
        updatedAt: now,
      })
      .where(eq(eventSeries.id, seriesId));

    const future = await tx
      .select({ id: events.id, seriesDate: events.seriesDate })
      .from(events)
      .where(and(eq(events.seriesId, seriesId), eq(events.isDetached, false), gte(events.startsAt, now)));

    for (const ev of future) {
      if (!ev.seriesDate) continue;
      await tx
        .update(events)
        .set({
          eventType: input.eventType ?? null,
          title: input.title,
          description: input.description,
          location: input.location,
          startsAt: zonedToUtc(ev.seriesDate, input.time),
          updatedAt: now,
        })
        .where(eq(events.id, ev.id));
    }

    // Serienende verkürzt → zukünftige Termine nach dem Ende entfernen.
    if (input.seriesEndDate) {
      await tx
        .delete(events)
        .where(and(eq(events.seriesId, seriesId), gte(events.startsAt, now), sql`${events.seriesDate} > ${input.seriesEndDate}`));
    }

    // Serienende verlängert → fehlende Termine nach dem letzten vorhandenen ergänzen.
    const [{ last }] = await tx.select({ last: max(events.seriesDate) }).from(events).where(eq(events.seriesId, seriesId));
    const all = generateOccurrenceDates({
      startDate: series.startDate,
      recurrence: series.recurrence,
      intervalDays: series.intervalDays,
      endDate: input.seriesEndDate,
    });
    const today = toYmd(now);
    const missing = all.filter((d) => (!last || d > last) && d >= today);
    if (missing.length > 0) {
      await tx.insert(events).values(
        missing.map((d) => ({
          seriesId,
          seriesDate: d,
          kind: series.kind,
          eventType: input.eventType ?? null,
          title: input.title,
          description: input.description,
          location: input.location,
          imageId: series.imageId,
          startsAt: zonedToUtc(d, input.time),
          createdById: actor.id,
        })),
      );
    }
    return { updated: future.length, added: missing.length };
  });
}

export async function setEventImage(actor: Actor, eventId: string, imageId: string | null) {
  assertCan(actor, "events:manage");
  await db.update(events).set({ imageId, updatedAt: new Date() }).where(eq(events.id, eventId));
}

export async function setEventStatus(actor: Actor, eventId: string, status: EventStatus) {
  assertCan(actor, "events:manage");
  const res = await db.update(events).set({ status, updatedAt: new Date() }).where(eq(events.id, eventId)).returning({ id: events.id });
  if (res.length === 0) throw new NotFoundError("Termin nicht gefunden.");
}

export async function deleteEvent(actor: Actor, eventId: string, scope: DeleteScope = "EINZELN") {
  assertCan(actor, "events:manage");
  const existing = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!existing) throw new NotFoundError("Termin nicht gefunden.");

  if (scope === "FOLGENDE" && existing.seriesId && existing.seriesDate) {
    const seriesId = existing.seriesId;
    const fromDate = existing.seriesDate;
    await db.transaction(async (tx) => {
      await tx.delete(events).where(and(eq(events.seriesId, seriesId), sql`${events.seriesDate} >= ${fromDate}`));
      await tx.update(eventSeries).set({ endDate: addDaysYmd(fromDate, -1), updatedAt: new Date() }).where(eq(eventSeries.id, seriesId));
    });
    return;
  }
  await db.delete(events).where(eq(events.id, eventId));
}

/* ───────────── Lesen ───────────── */

export async function getEvent(eventId: string) {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;
  const series = event.seriesId ? await db.query.eventSeries.findFirst({ where: eq(eventSeries.id, event.seriesId) }) : null;
  return { ...event, series: series ?? null };
}

export interface ListOptions {
  kind?: EventKind;
  from?: Date;
  to?: Date;
  order?: "asc" | "desc";
  limit?: number;
  includeCancelled?: boolean;
}

export async function listEvents(opts: ListOptions = {}) {
  const conditions = [];
  if (opts.kind) conditions.push(eq(events.kind, opts.kind));
  if (opts.from) conditions.push(gte(events.startsAt, opts.from));
  if (opts.to) conditions.push(lt(events.startsAt, opts.to));
  if (opts.includeCancelled === false) conditions.push(sql`${events.status} <> 'ABGESAGT'`);
  const rows = await db
    .select()
    .from(events)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(opts.order === "desc" ? desc(events.startsAt) : asc(events.startsAt))
    .limit(opts.limit ?? 500);
  return rows;
}

/** Termine, die noch laufen oder kommen (Beginn ab heute 00:00 bzw. vor max. 6 Std.). */
export function upcomingThreshold() {
  return new Date(Date.now() - 6 * 60 * 60 * 1000);
}

export async function getNextEvent(kind?: EventKind) {
  const [next] = await listEvents({ kind, from: upcomingThreshold(), limit: 1, includeCancelled: false });
  return next ?? null;
}

/* ───────────── Teilnahme ───────────── */

export async function setParticipation(actor: Actor, eventId: string, status: RsvpStatus) {
  assertCan(actor, "events:rsvp");
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId), columns: { id: true, status: true } });
  if (!event) throw new NotFoundError("Termin nicht gefunden.");
  if (event.status === "ABGESAGT") throw new AppError("Dieser Termin wurde abgesagt.");
  await db
    .insert(eventParticipations)
    .values({ eventId, userId: actor.id, status })
    .onConflictDoUpdate({
      target: [eventParticipations.eventId, eventParticipations.userId],
      set: { status, updatedAt: new Date() },
    });
}

export async function clearParticipation(actor: Actor, eventId: string) {
  assertCan(actor, "events:rsvp");
  await db.delete(eventParticipations).where(and(eq(eventParticipations.eventId, eventId), eq(eventParticipations.userId, actor.id)));
}

export interface ParticipantInfo {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarImageId: string | null;
}

export interface ParticipationOverview {
  zugesagt: ParticipantInfo[];
  abgesagt: ParticipantInfo[];
  offen: ParticipantInfo[];
}

/** Zusagen/Absagen; „offen“ = aktive Mitglieder ohne Rückmeldung. */
export async function getParticipationOverview(eventId: string): Promise<ParticipationOverview> {
  const members = await db
    .select({
      userId: users.id,
      status: users.status,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      avatarImageId: profiles.avatarImageId,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(inArray(users.status, ["AKTIV", "PASSIV"]))
    .orderBy(asc(profiles.firstName));
  const responses = await db.select().from(eventParticipations).where(eq(eventParticipations.eventId, eventId));
  const byUser = new Map(responses.map((r) => [r.userId, r.status]));

  const result: ParticipationOverview = { zugesagt: [], abgesagt: [], offen: [] };
  for (const m of members) {
    const info: ParticipantInfo = {
      userId: m.userId,
      displayName: displayName(m),
      firstName: m.firstName,
      lastName: m.lastName,
      avatarImageId: m.avatarImageId,
    };
    const status = byUser.get(m.userId);
    if (status === "ZUGESAGT") result.zugesagt.push(info);
    else if (status === "ABGESAGT") result.abgesagt.push(info);
    else if (m.status === "AKTIV") result.offen.push(info);
  }
  return result;
}

export interface ParticipationCounts {
  zugesagt: number;
  abgesagt: number;
  offen: number;
}

export async function getParticipationCounts(eventIds: string[]): Promise<Map<string, ParticipationCounts>> {
  const result = new Map<string, ParticipationCounts>();
  if (eventIds.length === 0) return result;
  const [{ active }] = await db.select({ active: sql<number>`count(*)::int` }).from(users).where(eq(users.status, "AKTIV"));
  const rows = await db
    .select({
      eventId: eventParticipations.eventId,
      status: eventParticipations.status,
      userStatus: users.status,
      n: sql<number>`count(*)::int`,
    })
    .from(eventParticipations)
    .innerJoin(users, eq(users.id, eventParticipations.userId))
    .where(and(inArray(eventParticipations.eventId, eventIds), inArray(users.status, ["AKTIV", "PASSIV"])))
    .groupBy(eventParticipations.eventId, eventParticipations.status, users.status);

  for (const id of eventIds) {
    const own = rows.filter((r) => r.eventId === id);
    const zugesagt = own.filter((r) => r.status === "ZUGESAGT").reduce((s, r) => s + Number(r.n), 0);
    const abgesagt = own.filter((r) => r.status === "ABGESAGT").reduce((s, r) => s + Number(r.n), 0);
    const answeredActive = own.filter((r) => r.userStatus === "AKTIV").reduce((s, r) => s + Number(r.n), 0);
    result.set(id, { zugesagt, abgesagt, offen: Math.max(Number(active) - answeredActive, 0) });
  }
  return result;
}

export async function getMyParticipation(userId: string, eventIds: string[]) {
  if (eventIds.length === 0) return new Map<string, RsvpStatus>();
  const rows = await db
    .select()
    .from(eventParticipations)
    .where(and(eq(eventParticipations.userId, userId), inArray(eventParticipations.eventId, eventIds)));
  return new Map(rows.map((r) => [r.eventId, r.status]));
}

/** Teilnahmen eines Mitglieds (für Profil/Statistik). */
export async function listParticipationsOfUser(userId: string, opts: { past: boolean; limit?: number }) {
  const now = new Date();
  return db
    .select({ id: events.id, title: events.title, kind: events.kind, startsAt: events.startsAt, status: eventParticipations.status })
    .from(eventParticipations)
    .innerJoin(events, eq(events.id, eventParticipations.eventId))
    .where(
      and(
        eq(eventParticipations.userId, userId),
        eq(eventParticipations.status, "ZUGESAGT"),
        opts.past ? lt(events.startsAt, now) : gte(events.startsAt, now),
        sql`${events.status} <> 'ABGESAGT'`,
      ),
    )
    .orderBy(opts.past ? desc(events.startsAt) : asc(events.startsAt))
    .limit(opts.limit ?? 10);
}

/** Termine im Zeitraum (für Kalender). */
export async function listEventsBetween(from: Date, to: Date) {
  return db.select().from(events).where(and(gte(events.startsAt, from), lte(events.startsAt, to))).orderBy(asc(events.startsAt));
}
