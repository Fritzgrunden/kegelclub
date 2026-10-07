"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/fields";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/components/ui/cn";
import { startGameSessionAction } from "@/server/actions/games";

interface Player {
  userId: string;
  displayName: string;
  firstName: string;
  lastName: string;
  avatarImageId: string | null;
  confirmed: boolean;
}

/** Spiel wählen → Mitspieler antippen → los. Zugesagte Mitglieder sind vorausgewählt. */
export function StartGameForm({
  eventId,
  games,
  players,
  preselectedGameId,
}: {
  eventId: string;
  games: { id: string; name: string; shortDescription: string }[];
  players: Player[];
  preselectedGameId?: string;
}) {
  const [gameId, setGameId] = useState(preselectedGameId ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(players.filter((p) => p.confirmed).map((p) => p.userId)));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ActionForm action={startGameSessionAction} className="flex flex-col gap-6">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="gameId" value={gameId} />
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="players" value={id} />
      ))}

      <section>
        <h2 className="mb-3 font-display text-xl font-bold">1. Spiel wählen</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {games.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={gameId === g.id}
              onClick={() => setGameId(g.id)}
              className={cn(
                "min-h-16 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                gameId === g.id ? "border-messing bg-messing/15" : "border-eiche bg-theke hover:border-messing/50",
              )}
            >
              <span className="block font-display text-lg font-bold">{g.name}</span>
              <span className="block text-sm text-kreide-dim">{g.shortDescription}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">2. Wer spielt mit? <span className="text-kreide-dim">({selected.size})</span></h2>
          <div className="flex gap-1">
            <button type="button" className="min-h-10 rounded-lg px-3 text-sm text-messing-hell hover:bg-theke-2" onClick={() => setSelected(new Set(players.map((p) => p.userId)))}>
              Alle
            </button>
            <button type="button" className="min-h-10 rounded-lg px-3 text-sm text-kreide-dim hover:bg-theke-2" onClick={() => setSelected(new Set())}>
              Keiner
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {players.map((p) => {
            const on = selected.has(p.userId);
            return (
              <button
                key={p.userId}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(p.userId)}
                className={cn(
                  "relative flex min-h-16 items-center gap-2.5 rounded-xl border-2 px-2.5 text-left transition-colors",
                  on ? "border-zusage bg-zusage/10" : "border-eiche bg-theke opacity-70",
                )}
              >
                <Avatar person={p} size="sm" />
                <span className="truncate font-medium">{p.displayName}</span>
                {on && <Check size={18} className="absolute right-2 top-2 text-zusage" aria-hidden />}
              </button>
            );
          })}
        </div>
      </section>

      <SubmitButton size="xl" pendingText="Starte …" className="sticky bottom-20 w-full lg:bottom-4">
        Los geht’s!
      </SubmitButton>
    </ActionForm>
  );
}
