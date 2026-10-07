import { beforeEach, describe, expect, it } from "vitest";
import { createEvent } from "@/server/services/events";
import { saveGame } from "@/server/services/games";
import { createGameSession, getGameSession, reopenGameSession, saveScores } from "@/server/services/results";
import { getLeaderboard, getPersonalStats } from "@/server/services/stats";
import { createTestUser, truncateAll } from "./helpers";

beforeEach(truncateAll);

const gameInput = (overrides: object = {}) => ({
  name: "Neuner",
  slug: "neuner",
  shortDescription: "Kurz",
  goal: "Ziel",
  players: "ab 2",
  procedure: "Ablauf",
  scoring: "Wertung",
  example: "Beispiel",
  rules: ["Regel 1"],
  scoringMode: "HOECHSTE_GEWINNT",
  scoreLabel: "Holz",
  active: true,
  sortOrder: 1,
  ...overrides,
});

async function setup() {
  const admin = await createTestUser({ roles: ["ADMIN"] });
  const max = await createTestUser({ firstName: "Max" });
  const peter = await createTestUser({ firstName: "Peter" });
  const klaus = await createTestUser({ firstName: "Klaus" });
  const { eventId } = await createEvent(admin, { kind: "KEGELABEND", title: "K", date: "2026-03-06", time: "19:00" });
  const gameId = await saveGame(admin, null, gameInput());
  return { admin, max, peter, klaus, eventId, gameId };
}

describe("Ergebniserfassung", () => {
  it("Mitglieder erfassen Ergebnisse, Plätze werden berechnet", async () => {
    const { max, peter, klaus, eventId, gameId } = await setup();
    const sessionId = await createGameSession(max, eventId, gameId, [max.id, peter.id, klaus.id]);
    await saveScores(max, sessionId, [
      { userId: max.id, score: 42 },
      { userId: peter.id, score: 37 },
      { userId: klaus.id, score: 35 },
    ], true);

    const s = await getGameSession(sessionId);
    expect(s!.status).toBe("ABGESCHLOSSEN");
    const ranks = Object.fromEntries(s!.participants.map((p) => [p.firstName, p.rank]));
    expect(ranks).toEqual({ Max: 1, Peter: 2, Klaus: 3 });
  });

  it("abgeschlossene Runden darf nur ein Admin ändern", async () => {
    const { admin, max, peter, eventId, gameId } = await setup();
    const sessionId = await createGameSession(max, eventId, gameId, [max.id, peter.id]);
    await saveScores(max, sessionId, [{ userId: max.id, score: 5 }, { userId: peter.id, score: 3 }], true);
    await expect(saveScores(peter, sessionId, [{ userId: peter.id, score: 99 }], true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(reopenGameSession(peter, sessionId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await saveScores(admin, sessionId, [{ userId: max.id, score: 5 }, { userId: peter.id, score: 9 }], true);
    const s = await getGameSession(sessionId);
    expect(s!.participants.find((p) => p.userId === peter.id)!.rank).toBe(1);
  });

  it("lehnt fremde Spieler in einer Runde ab", async () => {
    const { max, peter, klaus, eventId, gameId } = await setup();
    const sessionId = await createGameSession(max, eventId, gameId, [max.id, peter.id]);
    await expect(saveScores(max, sessionId, [{ userId: klaus.id, score: 3 }], false)).rejects.toThrow(/Unbekannter Spieler/);
  });
});

describe("Rangliste & Statistik", () => {
  it("berechnet Rangliste und persönliche Statistik aus abgeschlossenen Runden", async () => {
    const { admin, max, peter, klaus, eventId, gameId } = await setup();
    const lowGame = await saveGame(admin, null, gameInput({ name: "Abräumen", slug: "abraeumen", scoringMode: "NIEDRIGSTE_GEWINNT", scoreLabel: "Würfe" }));

    const s1 = await createGameSession(max, eventId, gameId, [max.id, peter.id, klaus.id]);
    await saveScores(max, s1, [{ userId: max.id, score: 42 }, { userId: peter.id, score: 37 }, { userId: klaus.id, score: 35 }], true);
    const s2 = await createGameSession(max, eventId, lowGame, [max.id, peter.id, klaus.id]);
    await saveScores(max, s2, [{ userId: max.id, score: 9 }, { userId: peter.id, score: 6 }, { userId: klaus.id, score: 12 }], true);
    // Laufende Runde zählt nicht
    const s3 = await createGameSession(max, eventId, gameId, [max.id, klaus.id]);
    await saveScores(max, s3, [{ userId: klaus.id, score: 99 }], false);

    const board = await getLeaderboard(2026);
    expect(board.map((b) => [b.displayName, b.points])).toEqual([
      ["Max Demo", 5],
      ["Peter Demo", 5],
      ["Klaus Demo", 2],
    ]);

    const stats = await getPersonalStats(peter.id, 2026);
    expect(stats).toMatchObject({ gamesPlayed: 2, wins: 1, points: 5, bestRank: 1 });
    expect(stats.bestByGame.find((g) => g.gameName === "Abräumen")!.score).toBe(6);
    expect(await getLeaderboard(2025)).toEqual([]);
  });
});
