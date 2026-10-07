import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { events, gameResults, games, gameSessions, profiles, users } from "@/server/db/schema";
import { AppError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { displayName } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { computeRanks } from "@/lib/scoring";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

export async function createGameSession(actor: Actor, eventId: string, gameId: string, participantIds: string[]) {
  assertCan(actor, "results:enter");
  const unique = Array.from(new Set(participantIds));
  if (unique.length === 0) throw new AppError("Bitte mindestens einen Mitspieler auswählen.");

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw new NotFoundError("Termin nicht gefunden.");
  if (event.status === "ABGESAGT") throw new AppError("Für abgesagte Termine können keine Spiele erfasst werden.");

  const game = await db.query.games.findFirst({ where: eq(games.id, gameId) });
  if (!game || !game.active) throw new NotFoundError("Spiel nicht gefunden.");

  const valid = await db
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, unique), inArray(users.status, ["AKTIV", "PASSIV"])));
  if (valid.length !== unique.length) throw new AppError("Mindestens ein ausgewählter Spieler ist ungültig.");

  return db.transaction(async (tx) => {
    const [session] = await tx.insert(gameSessions).values({ eventId, gameId, createdById: actor.id }).returning({ id: gameSessions.id });
    await tx.insert(gameResults).values(unique.map((userId) => ({ sessionId: session.id, userId })));
    return session.id;
  });
}

export async function getGameSession(sessionId: string) {
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session) return null;
  const game = await db.query.games.findFirst({ where: eq(games.id, session.gameId) });
  const event = await db.query.events.findFirst({ where: eq(events.id, session.eventId) });
  const participants = await db
    .select({
      userId: gameResults.userId,
      score: gameResults.score,
      rank: gameResults.rank,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      nickname: profiles.nickname,
      avatarImageId: profiles.avatarImageId,
    })
    .from(gameResults)
    .innerJoin(profiles, eq(profiles.userId, gameResults.userId))
    .where(eq(gameResults.sessionId, sessionId))
    .orderBy(asc(profiles.firstName));
  return {
    ...session,
    game: game!,
    event: event!,
    participants: participants.map((p) => ({ ...p, displayName: displayName(p) })),
  };
}

function canEditSession(actor: Actor, session: { status: string; createdById: string | null }) {
  if (hasPermission(actor, "results:manage")) return true;
  return session.status === "LAUFEND" && hasPermission(actor, "results:enter");
}

export async function saveScores(
  actor: Actor,
  sessionId: string,
  scores: { userId: string; score: number | null }[],
  finish: boolean,
) {
  assertCan(actor, "results:enter");
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session) throw new NotFoundError("Spielrunde nicht gefunden.");
  if (!canEditSession(actor, session)) throw new ForbiddenError("Abgeschlossene Runden kann nur ein Admin ändern.");
  const game = await db.query.games.findFirst({ where: eq(games.id, session.gameId) });
  if (!game) throw new NotFoundError("Spiel nicht gefunden.");

  const current = await db.select({ userId: gameResults.userId }).from(gameResults).where(eq(gameResults.sessionId, sessionId));
  const allowed = new Set(current.map((c) => c.userId));
  for (const s of scores) {
    if (!allowed.has(s.userId)) throw new AppError("Unbekannter Spieler in dieser Runde.");
    if (s.score !== null && (!Number.isInteger(s.score) || s.score < -9999 || s.score > 99999)) {
      throw new AppError("Bitte nur ganze Zahlen als Ergebnis eintragen.");
    }
  }
  const merged = current.map((c) => ({ userId: c.userId, score: scores.find((s) => s.userId === c.userId)?.score ?? null }));
  if (finish && merged.every((m) => m.score === null)) throw new AppError("Zum Abschließen bitte mindestens ein Ergebnis eintragen.");

  const ranked = computeRanks(merged, game.scoringMode);
  await db.transaction(async (tx) => {
    for (const r of ranked) {
      await tx
        .update(gameResults)
        .set({ score: r.score, rank: r.rank })
        .where(and(eq(gameResults.sessionId, sessionId), eq(gameResults.userId, r.userId)));
    }
    await tx
      .update(gameSessions)
      .set(finish ? { status: "ABGESCHLOSSEN", finishedAt: new Date() } : { status: session.status })
      .where(eq(gameSessions.id, sessionId));
  });
  return ranked;
}

export async function reopenGameSession(actor: Actor, sessionId: string) {
  assertCan(actor, "results:manage");
  await db.update(gameSessions).set({ status: "LAUFEND", finishedAt: null }).where(eq(gameSessions.id, sessionId));
}

export async function deleteGameSession(actor: Actor, sessionId: string) {
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session) throw new NotFoundError("Spielrunde nicht gefunden.");
  const isOwnOpen = session.status === "LAUFEND" && session.createdById === actor.id;
  if (!isOwnOpen && !hasPermission(actor, "results:manage")) {
    throw new ForbiddenError("Nur ein Admin oder der Ersteller einer laufenden Runde kann sie löschen.");
  }
  await db.delete(gameSessions).where(eq(gameSessions.id, sessionId));
}

export async function listSessionsForEvent(eventId: string) {
  const sessions = await db
    .select({
      id: gameSessions.id,
      status: gameSessions.status,
      createdAt: gameSessions.createdAt,
      gameName: games.name,
      scoreLabel: games.scoreLabel,
    })
    .from(gameSessions)
    .innerJoin(games, eq(games.id, gameSessions.gameId))
    .where(eq(gameSessions.eventId, eventId))
    .orderBy(desc(gameSessions.createdAt));
  if (sessions.length === 0) return [];
  const winners = await db
    .select({ sessionId: gameResults.sessionId, firstName: profiles.firstName, lastName: profiles.lastName, nickname: profiles.nickname, score: gameResults.score })
    .from(gameResults)
    .innerJoin(profiles, eq(profiles.userId, gameResults.userId))
    .where(and(inArray(gameResults.sessionId, sessions.map((s) => s.id)), eq(gameResults.rank, 1)));
  return sessions.map((s) => ({
    ...s,
    winners: winners.filter((w) => w.sessionId === s.id).map((w) => ({ name: displayName(w), score: w.score })),
  }));
}
