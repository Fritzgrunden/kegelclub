/**
 * Ranglisten-Berechnung (Jahres- bzw. Gesamtwertung)
 * ───────────────────────────────────────────────────
 * Jedes Spiel hat andere Punktskalen, deshalb werden keine Rohpunkte summiert,
 * sondern Platzierungspunkte vergeben:
 *
 *   Platzierungspunkte = Anzahl gewerteter Teilnehmer − Platz + 1
 *
 * Beispiel 5 Spieler: Platz 1 → 5 Pkt., Platz 2 → 4 Pkt., … Platz 5 → 1 Pkt.
 * Gleichstand: gleicher Platz → gleiche Punkte.
 * Sortierung: Punkte ↓, Siege ↓, Spiele ↑, Name.
 * Anpassen: `placementPoints` oder `compareRows` ändern.
 */

export interface ResultRow {
  userId: string;
  sessionId: string;
  rank: number;
  participantCount: number;
}

export interface LeaderboardRow {
  userId: string;
  points: number;
  games: number;
  wins: number;
  podiums: number;
  averageRank: number;
  position: number;
}

export function placementPoints(rank: number, participantCount: number) {
  return Math.max(participantCount - rank + 1, 0);
}

type Row = Omit<LeaderboardRow, "position">;

function compareRows(a: Row, b: Row) {
  return b.points - a.points || b.wins - a.wins || a.games - b.games;
}

export function computeLeaderboard(rows: readonly ResultRow[], nameOf: (userId: string) => string = (id) => id): LeaderboardRow[] {
  const acc = new Map<string, { points: number; games: number; wins: number; podiums: number; rankSum: number }>();
  for (const r of rows) {
    const a = acc.get(r.userId) ?? { points: 0, games: 0, wins: 0, podiums: 0, rankSum: 0 };
    a.points += placementPoints(r.rank, r.participantCount);
    a.games += 1;
    a.rankSum += r.rank;
    if (r.rank === 1) a.wins += 1;
    if (r.rank <= 3) a.podiums += 1;
    acc.set(r.userId, a);
  }
  const list: Row[] = [...acc.entries()].map(([userId, a]) => ({
    userId,
    points: a.points,
    games: a.games,
    wins: a.wins,
    podiums: a.podiums,
    averageRank: Math.round((a.rankSum / a.games) * 10) / 10,
  }));
  list.sort((a, b) => compareRows(a, b) || nameOf(a.userId).localeCompare(nameOf(b.userId), "de"));

  const result: LeaderboardRow[] = [];
  list.forEach((row, i) => {
    const prev = result[i - 1];
    const position = prev && compareRows(prev, row) === 0 ? prev.position : i + 1;
    result.push({ ...row, position });
  });
  return result;
}
