import "server-only";
import { cache } from "react";
import { z } from "zod";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { AppError } from "@/lib/errors";
import { zodFieldErrors } from "@/lib/validation";
import { assertCan } from "@/server/auth/guard";
import type { Actor } from "@/server/auth/types";

export const settingsSchema = z.object({
  clubName: z.string().trim().min(1, "Bitte einen Vereinsnamen angeben.").max(80),
  defaultLocation: z.string().trim().max(200),
  defaultTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Bitte eine gültige Uhrzeit angeben."),
});

export type AppSettings = z.infer<typeof settingsSchema>;

const DEFAULTS: AppSettings = {
  clubName: process.env.CLUB_NAME || "Kegelclub",
  defaultLocation: "",
  defaultTime: "19:00",
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...DEFAULTS, ...map } as AppSettings;
});

export async function updateSettings(actor: Actor, raw: unknown) {
  assertCan(actor, "settings:manage");
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("Bitte die markierten Felder prüfen.", "VALIDATION", zodFieldErrors(parsed.error));
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(parsed.data)) {
      await tx.insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
    }
  });
}
