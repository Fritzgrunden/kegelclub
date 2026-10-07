import { describe, expect, it } from "vitest";
import { computeRanks } from "@/lib/scoring";
import { computeLeaderboard, placementPoints } from "@/lib/leaderboard";

describe("Ergebnisberechnung", () => {
  it("vergibt Plätze nach höchster Punktzahl", () => {
    const r = computeRanks(
      [
        { userId: "peter", score: 37 },
        { userId: "max", score: 42 },
        { userId: "klaus", score: 35 },
      ],
      "HOECHSTE_GEWINNT",
    );
    expect(r.map((x) => [x.userId, x.rank])).toEqual([
      ["max", 1],
      ["peter", 2],
      ["klaus", 3],
    ]);
  });

  it("teilt Plätze bei Gleichstand und überspringt den Folgeplatz (1-2-2-4)", () => {
    const r = computeRanks(
      [
        { userId: "a", score: 10 },
        { userId: "b", score: 8 },
        { userId: "c", score: 8 },
        { userId: "d", score: 5 },
      ],
      "HOECHSTE_GEWINNT",
    );
    expect(r.map((x) => x.rank)).toEqual([1, 2, 2, 4]);
  });

  it("unterstützt „niedrigster Wert gewinnt“", () => {
    const r = computeRanks(
      [
        { userId: "a", score: 12 },
        { userId: "b", score: 7 },
      ],
      "NIEDRIGSTE_GEWINNT",
    );
    expect(r[0]).toMatchObject({ userId: "b", rank: 1 });
  });

  it("wertet Spieler ohne Ergebnis nicht", () => {
    const r = computeRanks(
      [
        { userId: "a", score: null },
        { userId: "b", score: 3 },
      ],
      "HOECHSTE_GEWINNT",
    );
    expect(r).toEqual([
      { userId: "b", score: 3, rank: 1 },
      { userId: "a", score: null, rank: null },
    ]);
  });
});

describe("Ranglistenberechnung", () => {
  it("berechnet Platzierungspunkte", () => {
    expect(placementPoints(1, 5)).toBe(5);
    expect(placementPoints(5, 5)).toBe(1);
  });

  it("summiert Punkte, zählt Siege und sortiert korrekt", () => {
    const board = computeLeaderboard([
      { userId: "max", sessionId: "s1", rank: 1, participantCount: 3 },
      { userId: "peter", sessionId: "s1", rank: 2, participantCount: 3 },
      { userId: "klaus", sessionId: "s1", rank: 3, participantCount: 3 },
      { userId: "peter", sessionId: "s2", rank: 1, participantCount: 3 },
      { userId: "max", sessionId: "s2", rank: 2, participantCount: 3 },
      { userId: "klaus", sessionId: "s2", rank: 3, participantCount: 3 },
      { userId: "max", sessionId: "s3", rank: 1, participantCount: 2 },
      { userId: "klaus", sessionId: "s3", rank: 2, participantCount: 2 },
    ]);
    expect(board.map((b) => [b.userId, b.points, b.wins, b.position])).toEqual([
      ["max", 7, 2, 1],
      ["peter", 5, 1, 2],
      ["klaus", 3, 0, 3],
    ]);
  });

  it("vergibt bei identischer Bilanz denselben Ranglistenplatz", () => {
    const board = computeLeaderboard([
      { userId: "a", sessionId: "s1", rank: 1, participantCount: 2 },
      { userId: "b", sessionId: "s2", rank: 1, participantCount: 2 },
    ]);
    expect(board.map((b) => b.position)).toEqual([1, 1]);
  });
});
