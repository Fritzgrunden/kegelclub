import "server-only";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { eventParticipations, events, profiles, users } from "@/server/db/schema";
import { displayName } from "@/lib/format";
import { zonedToUtc } from "@/lib/dates";

/** Vergangene, nicht abgesagte Kegelabende – optional für ein Jahr. */
function pastEvenings(year?: number) {
  return [
    eq(events.kind, "KEGELABEND"),
    lt(events.startsAt, new Date()),
    sql`${events.status} <> 'ABGESAGT'`,
    ...(year ? [gte(events.startsAt, zonedToUtc(`${year}-01-01`, "00:00")), lt(events.startsAt, zonedToUtc(`${year + 1}-01-01`, "00:00"))] : []),
  ];
}

export interface AttendanceRow {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarImageId: string | null;
  attended: number;
  /** Anteil an allen Kegelabenden im Zeitraum, 0–100 */
  percent: number;
}

/** Anwesenheit: Wer war bei wie vielen Kegelabenden dabei (Zusage zählt)? */
export async function getAttendance(year?: number): Promise<{ evenings: number; members: AttendanceRow[] }> {
  const attended = sql<number>`count(${eventParticipations.eventId})::int`;
  const [[{ evenings }], rows] = await Promise.all([
    db.select({ evenings: sql<number>`count(*)::int` }).from(events).where(and(...pastEvenings(year))),
    db
      .select({
        userId: users.id,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        nickname: profiles.nickname,
        avatarImageId: profiles.avatarImageId,
        attended,
      })
      .from(users)
      .innerJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(
        eventParticipations,
        and(
          eq(eventParticipations.userId, users.id),
          eq(eventParticipations.status, "ZUGESAGT"),
          sql`${eventParticipations.eventId} in (select ${events.id} from ${events} where ${and(...pastEvenings(year))})`,
        ),
      )
      .where(inArray(users.status, ["AKTIV", "PASSIV"]))
      .groupBy(users.id, profiles.firstName, profiles.lastName, profiles.nickname, profiles.avatarImageId)
      .orderBy(desc(attended), profiles.firstName),
  ]);
  const total = Number(evenings);
  return {
    evenings: total,
    members: rows.map((r) => ({
      userId: r.userId,
      displayName: displayName(r),
      firstName: r.firstName,
      lastName: r.lastName,
      avatarImageId: r.avatarImageId,
      attended: Number(r.attended),
      percent: total ? Math.round((Number(r.attended) / total) * 100) : 0,
    })),
  };
}

/** Anzahl besuchter Kegelabende eines Mitglieds. */
export async function getEveningsAttended(userId: string, year?: number) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventParticipations)
    .innerJoin(events, eq(events.id, eventParticipations.eventId))
    .where(and(eq(eventParticipations.userId, userId), eq(eventParticipations.status, "ZUGESAGT"), ...pastEvenings(year)));
  return Number(row?.n ?? 0);
}
