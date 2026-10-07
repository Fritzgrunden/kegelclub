import "server-only";
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { eventParticipations, events, gameResults, games, gameSessions, profiles } from "@/server/db/schema";
import { computeLeaderboard, placementPoints, type ResultRow } from "@/lib/leaderboard";
import { SCORING_STRATEGIES } from "@/lib/scoring";
import { displayName } from "@/lib/format";
import { zonedToUtc } from "@/lib/dates";

function yearRange(year?: number) {
  if (!year) return [];
  return [gte(events.startsAt, zonedToUtc(`${year}-01-01`, "00:00")), lt(events.startsAt, zonedToUtc(`${year + 1}-01-01`, "00:00"))];
}

/** Alle gewerteten Ergebnisse abgeschlossener Runden (optional für ein Jahr). */
async function loadRankedResults(year?: number, userId?: string) {
  const rows = await db
    .select({
      userId: gameResults.userId,
      sessionId: gameResults.sessionId,
      rank: gameResults.rank,
      score: gameResults.score,
      gameId: gameSessions.gameId,
      gameName: games.name,
      scoreLabel: games.scoreLabel,
      scoringMode: games.scoringMode,
      eventId: events.id,
      eventTitle: events.title,
      startsAt: events.startsAt,
    })
    .from(gameResults)
    .innerJoin(gameSessions, eq(gameSessions.id, gameResults.sessionId))
    .innerJoin(games, eq(games.id, gameSessions.gameId))
    .innerJoin(events, eq(events.id, gameSessions.eventId))
    .where(and(eq(gameSessions.status, "ABGESCHLOSSEN"), isNotNull(gameResults.rank), ...yearRange(year)));

  const participantCount = new Map<string, number>();
  for (const r of rows) participantCount.set(r.sessionId, (participantCount.get(r.sessionId) ?? 0) + 1);
  return rows
    .filter((r) => !userId || r.userId === userId)
    .map((r) => ({ ...r, rank: r.rank as number, participantCount: participantCount.get(r.sessionId) ?? 1 }));
}

export async function getLeaderboard(year?: number) {
  const results = await loadRankedResults(year);
  const people = await db.select().from(profiles);
  const names = new Map(people.map((p) => [p.userId, { name: displayName(p), ...p }]));
  const board = computeLeaderboard(results as ResultRow[], (id) => names.get(id)?.name ?? "");
  return board.map((row) => ({
    ...row,
    displayName: names.get(row.userId)?.name ?? "Ehemaliges Mitglied",
    firstName: names.get(row.userId)?.firstName ?? "?",
    lastName: names.get(row.userId)?.lastName ?? "?",
    avatarImageId: names.get(row.userId)?.avatarImageId ?? null,
  }));
}

export async function getPersonalStats(userId: string, year?: number) {
  const results = await loadRankedResults(year, userId);
  const evenings = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(eventParticipations)
    .innerJoin(events, eq(events.id, eventParticipations.eventId))
    .where(
      and(
        eq(eventParticipations.userId, userId),
        eq(eventParticipations.status, "ZUGESAGT"),
        eq(events.kind, "KEGELABEND"),
        lt(events.startsAt, new Date()),
        sql`${events.status} <> 'ABGESAGT'`,
        ...yearRange(year),
      ),
    );

  // Persönliche Bestleistung je Spiel (je nach Wertungsart höchster oder niedrigster Wert).
  const bestByGame = new Map<string, { gameName: string; scoreLabel: string; score: number; date: Date }>();
  for (const r of results) {
    if (r.score === null) continue;
    const prev = bestByGame.get(r.gameId);
    if (!prev || SCORING_STRATEGIES[r.scoringMode].compare(r.score, prev.score) < 0) {
      bestByGame.set(r.gameId, { gameName: r.gameName, scoreLabel: r.scoreLabel, score: r.score, date: r.startsAt });
    }
  }

  return {
    eveningsAttended: Number(evenings[0]?.n ?? 0),
    gamesPlayed: results.length,
    wins: results.filter((r) => r.rank === 1).length,
    podiums: results.filter((r) => r.rank <= 3).length,
    points: results.reduce((s, r) => s + placementPoints(r.rank, r.participantCount), 0),
    bestRank: results.length ? Math.min(...results.map((r) => r.rank)) : null,
    bestByGame: [...bestByGame.values()].sort((a, b) => a.gameName.localeCompare(b.gameName, "de")),
  };
}

export async function getRecentResults(userId: string, limit = 5) {
  const rows = await db
    .select({
      sessionId: gameResults.sessionId,
      rank: gameResults.rank,
      score: gameResults.score,
      gameName: games.name,
      scoreLabel: games.scoreLabel,
      startsAt: events.startsAt,
    })
    .from(gameResults)
    .innerJoin(gameSessions, eq(gameSessions.id, gameResults.sessionId))
    .innerJoin(games, eq(games.id, gameSessions.gameId))
    .innerJoin(events, eq(events.id, gameSessions.eventId))
    .where(and(eq(gameResults.userId, userId), eq(gameSessions.status, "ABGESCHLOSSEN")))
    .orderBy(desc(events.startsAt), desc(gameSessions.createdAt))
    .limit(limit);
  return rows;
}

export async function getClubTotals(year?: number) {
  const [evenings] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.kind, "KEGELABEND"), lt(events.startsAt, new Date()), sql`${events.status} <> 'ABGESAGT'`, ...yearRange(year)));
  const [sessions] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(gameSessions)
    .innerJoin(events, eq(events.id, gameSessions.eventId))
    .where(and(eq(gameSessions.status, "ABGESCHLOSSEN"), ...yearRange(year)));
  return { evenings: Number(evenings.n), games: Number(sessions.n) };
}
