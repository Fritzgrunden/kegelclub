"use client";

import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Undo2 } from "lucide-react";
import { computeRanks, SCORING_STRATEGIES } from "@/lib/scoring";
import type { ScoringMode } from "@/server/db/schema";
import { saveScoresAction } from "@/server/actions/games";
import { Avatar } from "@/components/ui/avatar";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";
import { Spinner } from "@/components/ui/fields";
import { cn } from "@/components/ui/cn";

interface Participant {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarImageId: string | null;
  score: number | null;
}

type Scores = Record<string, number | null>;

/**
 * Ergebniseingabe für den laufenden Kegelabend:
 * Spieler antippen → Wurf (Anzahl Holz) auf dem Tastenfeld antippen → nächster Spieler ist automatisch dran.
 * Zusätzlich direkte Eingabe und +/- pro Spieler.
 */
export function ScoreBoard({
  sessionId,
  scoringMode,
  scoreLabel,
  participants,
}: {
  sessionId: string;
  scoringMode: ScoringMode;
  scoreLabel: string;
  participants: Participant[];
}) {
  const [scores, setScores] = useState<Scores>(() => Object.fromEntries(participants.map((p) => [p.userId, p.score])));
  const [history, setHistory] = useState<Scores[]>([]);
  const [active, setActive] = useState(participants[0]?.userId ?? "");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const ranks = useMemo(() => {
    const r = computeRanks(participants.map((p) => ({ userId: p.userId, score: scores[p.userId] ?? null })), scoringMode);
    return new Map(r.map((x) => [x.userId, x.rank]));
  }, [scores, participants, scoringMode]);

  const update = (userId: string, value: number | null) => {
    setHistory((h) => [...h.slice(-30), scores]);
    setScores((s) => ({ ...s, [userId]: value }));
    setDirty(true);
    setMessage(null);
  };

  const addThrow = (pins: number) => {
    if (!active) return;
    update(active, (scores[active] ?? 0) + pins);
    const idx = participants.findIndex((p) => p.userId === active);
    setActive(participants[(idx + 1) % participants.length].userId);
  };

  const undo = () => {
    const prev = history.at(-1);
    if (!prev) return;
    setScores(prev);
    setHistory((h) => h.slice(0, -1));
    setDirty(true);
  };

  const save = (finish: boolean) => {
    setConfirming(false);
    startTransition(async () => {
      const payload = participants.map((p) => ({ userId: p.userId, score: scores[p.userId] ?? null }));
      const res = await saveScoresAction(sessionId, payload, finish);
      setMessage({ ok: res.ok, text: res.message ?? (res.ok ? "Gespeichert." : "Speichern fehlgeschlagen.") });
      if (res.ok) setDirty(false);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-kreide-dim">
        Wertung: {SCORING_STRATEGIES[scoringMode].label} ({scoreLabel}). Spieler antippen, dann Würfe eintragen.
      </p>

      <ul className="tafel flex flex-col gap-1 rounded-md p-2 sm:p-3">
        {participants.map((p) => {
          const score = scores[p.userId];
          const rank = ranks.get(p.userId);
          const isActive = active === p.userId;
          return (
            <li
              key={p.userId}
              className={cn("flex items-center gap-2 rounded-lg px-2 py-2 transition-colors", isActive ? "bg-messing/20 ring-2 ring-messing" : "")}
            >
              <button type="button" onClick={() => setActive(p.userId)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2.5 text-left" aria-pressed={isActive}>
                <span className="kreide w-7 shrink-0 text-center font-display text-xl font-bold text-messing-hell">{rank ?? "–"}</span>
                <Avatar person={p} size="sm" />
                <span className="kreide truncate text-lg font-semibold">{p.displayName}</span>
              </button>
              <button
                type="button"
                aria-label={`${p.displayName} minus 1`}
                onClick={() => update(p.userId, Math.max((score ?? 0) - 1, 0))}
                className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-kreide/25 text-kreide hover:bg-black/20"
              >
                <Minus size={22} />
              </button>
              <input
                aria-label={`${scoreLabel} von ${p.displayName}`}
                inputMode="numeric"
                pattern="[0-9]*"
                value={score ?? ""}
                placeholder="–"
                onFocus={() => setActive(p.userId)}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  update(p.userId, v === "" ? null : Math.min(Number(v), 99999));
                }}
                className="kreide h-14 w-[4.5ch] shrink-0 rounded-xl border border-kreide/25 bg-black/20 text-center font-display text-3xl font-bold tabular-nums focus:border-messing focus:outline-none"
              />
              <button
                type="button"
                aria-label={`${p.displayName} plus 1`}
                onClick={() => update(p.userId, (score ?? 0) + 1)}
                className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-kreide/25 text-kreide hover:bg-black/20"
              >
                <Plus size={22} />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Wurf-Tastenfeld */}
      <section aria-label="Wurf eintragen" className="rounded-2xl border border-eiche bg-theke p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm text-kreide-dim">
            Wurf für <strong className="text-kreide">{participants.find((p) => p.userId === active)?.displayName}</strong>
          </p>
          <button type="button" onClick={undo} disabled={history.length === 0} className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-kreide-dim hover:bg-theke-2 disabled:opacity-40">
            <Undo2 size={16} aria-hidden /> Rückgängig
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => addThrow(n)}
              className={cn(
                "min-h-14 rounded-xl font-display text-2xl font-bold active:scale-95",
                n === 9 ? "bg-messing text-bahn" : n === 0 ? "bg-theke-2 text-kreide-dim" : "bg-theke-2 text-kreide",
              )}
              aria-label={n === 0 ? "Pudel, 0 Holz" : `${n} Holz`}
            >
              {n === 0 ? "P" : n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-kreide-dim">P = Pudel (0). Der nächste Spieler ist automatisch an der Reihe.</p>
      </section>

      {message && <Alert tone={message.ok ? "success" : "error"}>{message.text}</Alert>}

      <div className="sticky bottom-20 z-10 grid grid-cols-2 gap-3 rounded-2xl bg-bahn/90 py-2 backdrop-blur lg:bottom-4">
        <button type="button" disabled={pending} onClick={() => save(false)} className={buttonClass("secondary", "xl")}>
          {pending && <Spinner />} {dirty ? "Speichern" : "Gespeichert"}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirming(true)} className={buttonClass("primary", "xl")}>
          Abschließen
        </button>
      </div>

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="finish-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl border border-eiche bg-theke p-5">
            <h2 id="finish-title" className="font-display text-xl font-bold">Runde abschließen?</h2>
            <p className="mt-2 text-kreide-dim">Die Platzierungen werden gespeichert und zählen für die Rangliste. Danach kann nur noch ein Admin Ergebnisse ändern.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button type="button" className={buttonClass("secondary", "lg")} onClick={() => setConfirming(false)}>Weiterspielen</button>
              <button type="button" className={buttonClass("primary", "lg")} onClick={() => save(true)}>Abschließen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
