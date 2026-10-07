"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { deleteGame, saveGame } from "@/server/services/games";
import { createGameSession, deleteGameSession, reopenGameSession, saveScores } from "@/server/services/results";
import { requireActor } from "@/server/auth/session";
import { optStr, runAction, str } from "./utils";

export async function startGameSessionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let target = "";
  const result = await runAction(async () => {
    const actor = await requireActor();
    const gameId = str(fd, "gameId");
    if (!gameId) throw new AppError("Bitte ein Spiel auswählen.");
    const players = fd.getAll("players").filter((v): v is string => typeof v === "string");
    const id = await createGameSession(actor, str(fd, "eventId"), gameId, players);
    target = `/spielrunden/${id}`;
  });
  if (result.ok) redirect(target);
  return result;
}

const scoresSchema = z.array(z.object({ userId: z.string().uuid(), score: z.number().int().nullable() })).max(100);

export async function saveScoresAction(sessionId: string, scores: unknown, finish: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const parsed = scoresSchema.safeParse(scores);
    if (!parsed.success || typeof sessionId !== "string") throw new AppError("Ungültige Eingabe.");
    await saveScores(actor, sessionId, parsed.data, Boolean(finish));
    revalidatePath("/", "layout");
    return finish ? "Runde abgeschlossen." : "Zwischenstand gespeichert.";
  });
}

export async function deleteGameSessionAction(fd: FormData): Promise<ActionResult> {
  const back = `/termine/${str(fd, "eventId")}`;
  const result = await runAction(async () => {
    const actor = await requireActor();
    await deleteGameSession(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
  if (result.ok) redirect(back);
  return result;
}

export async function reopenGameSessionAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await reopenGameSession(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
}

export async function saveGameAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let slug = "";
  const result = await runAction(async () => {
    const actor = await requireActor();
    const input = {
      name: str(fd, "name"),
      slug: str(fd, "slug"),
      shortDescription: str(fd, "shortDescription"),
      goal: str(fd, "goal"),
      players: str(fd, "players"),
      procedure: str(fd, "procedure"),
      scoring: str(fd, "scoring"),
      example: str(fd, "example"),
      rules: str(fd, "rules").split(/\r?\n/).map((r) => r.trim()).filter(Boolean),
      scoringMode: str(fd, "scoringMode"),
      scoreLabel: str(fd, "scoreLabel") || "Punkte",
      active: fd.get("active") === "on",
      sortOrder: Number(str(fd, "sortOrder") || 0),
    };
    await saveGame(actor, optStr(fd, "id") ?? null, input);
    slug = input.slug.toLowerCase().trim();
    revalidatePath("/", "layout");
  });
  if (result.ok) redirect(`/spiele/${slug}`);
  return result;
}

export async function deleteGameAction(fd: FormData): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActor();
    await deleteGame(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
  if (result.ok) redirect("/spiele");
  return result;
}
