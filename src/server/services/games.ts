import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { gameRules, games, gameSessions } from "@/server/db/schema";
import { AppError, NotFoundError } from "@/lib/errors";
import { gameSchema, zodFieldErrors } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

export type Game = typeof games.$inferSelect;
export type GameWithRules = Game & { rules: string[] };

export async function listGames(opts: { includeInactive?: boolean } = {}) {
  return db
    .select()
    .from(games)
    .where(opts.includeInactive ? undefined : eq(games.active, true))
    .orderBy(asc(games.sortOrder), asc(games.name));
}

async function withRules(game: Game | undefined): Promise<GameWithRules | null> {
  if (!game) return null;
  const rules = await db.select().from(gameRules).where(eq(gameRules.gameId, game.id)).orderBy(asc(gameRules.position));
  return { ...game, rules: rules.map((r) => r.text) };
}

export async function getGameBySlug(slug: string) {
  return withRules(await db.query.games.findFirst({ where: eq(games.slug, slug) }));
}

export async function getGameById(id: string) {
  return withRules(await db.query.games.findFirst({ where: eq(games.id, id) }));
}

export async function saveGame(actor: Actor, id: string | null, raw: unknown) {
  assertCan(actor, "games:manage");
  const parsed = gameSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  const { rules, ...data } = parsed.data;

  const slugOwner = await db.query.games.findFirst({ where: eq(games.slug, data.slug), columns: { id: true } });
  if (slugOwner && slugOwner.id !== id) {
    throw new AppError("Diese Kurzadresse wird bereits verwendet.", "CONFLICT", { slug: "Bereits vergeben." });
  }

  return db.transaction(async (tx) => {
    let gameId = id;
    if (gameId) {
      const res = await tx.update(games).set({ ...data, updatedAt: new Date() }).where(eq(games.id, gameId)).returning({ id: games.id });
      if (res.length === 0) throw new NotFoundError("Spiel nicht gefunden.");
      await tx.delete(gameRules).where(eq(gameRules.gameId, gameId));
    } else {
      const [row] = await tx.insert(games).values(data).returning({ id: games.id });
      gameId = row.id;
    }
    const cleanRules = rules.filter(Boolean);
    if (cleanRules.length) {
      await tx.insert(gameRules).values(cleanRules.map((text, position) => ({ gameId: gameId!, position, text })));
    }
    return gameId;
  });
}

/** Spiele mit gespeicherten Ergebnissen werden nicht gelöscht, sondern deaktiviert. */
export async function deleteGame(actor: Actor, id: string) {
  assertCan(actor, "games:manage");
  const used = await db.query.gameSessions.findFirst({ where: eq(gameSessions.gameId, id), columns: { id: true } });
  if (used) {
    await db.update(games).set({ active: false, updatedAt: new Date() }).where(eq(games.id, id));
    return "deaktiviert" as const;
  }
  await db.delete(games).where(eq(games.id, id));
  return "geloescht" as const;
}
