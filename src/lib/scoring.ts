import type { ScoringMode } from "@/server/db/schema";

/**
 * Wertungslogik für Spielrunden.
 * Neue Wertungsart: Enum-Wert in schema.ts ergänzen und hier eine Strategie registrieren.
 */
export interface ScoringStrategy {
  label: string;
  /** < 0, wenn a besser ist als b */
  compare(a: number, b: number): number;
}

export const SCORING_STRATEGIES: Record<ScoringMode, ScoringStrategy> = {
  HOECHSTE_GEWINNT: { label: "Höchster Wert gewinnt", compare: (a, b) => b - a },
  NIEDRIGSTE_GEWINNT: { label: "Niedrigster Wert gewinnt", compare: (a, b) => a - b },
};

export interface ScoreEntry {
  userId: string;
  score: number | null;
}

export interface RankedEntry extends ScoreEntry {
  rank: number | null;
}

/**
 * Platzierungen nach Wettkampf-Regel („1-2-2-4“):
 * Gleicher Wert = gleicher Platz, der folgende Platz wird übersprungen.
 * Teilnehmer ohne Ergebnis erhalten keinen Platz und stehen am Ende.
 */
export function computeRanks(entries: readonly ScoreEntry[], mode: ScoringMode): RankedEntry[] {
  const strategy = SCORING_STRATEGIES[mode];
  const scored = entries.filter((e): e is { userId: string; score: number } => e.score !== null);
  const unscored = entries.filter((e) => e.score === null);
  const sorted = [...scored].sort((a, b) => strategy.compare(a.score, b.score));

  const ranked: RankedEntry[] = [];
  sorted.forEach((entry, i) => {
    const prev = ranked[i - 1];
    const rank = prev && prev.score === entry.score ? prev.rank : i + 1;
    ranked.push({ ...entry, rank });
  });
  return [...ranked, ...unscored.map((e) => ({ ...e, rank: null }))];
}
