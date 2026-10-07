import { z } from "zod";
import { isValidYmd } from "./dates";

const trimmed = (max: number) => z.string().trim().max(max, `Maximal ${max} Zeichen.`);
const optionalText = (max: number) =>
  trimmed(max).optional().transform((v) => (v ? v : null));

export const ymd = z.string().refine(isValidYmd, "Bitte ein gültiges Datum angeben.");
export const optionalYmd = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isValidYmd(v), "Bitte ein gültiges Datum angeben.");
export const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Bitte eine gültige Uhrzeit angeben (HH:MM).");

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Bitte eine gültige E-Mail-Adresse angeben.")
  .max(200);

export const passwordSchema = z
  .string()
  .min(10, "Das Passwort muss mindestens 10 Zeichen lang sein.")
  .max(200, "Das Passwort ist zu lang.");

export const profileSchema = z.object({
  firstName: trimmed(60).min(1, "Bitte den Vornamen angeben."),
  lastName: trimmed(60).min(1, "Bitte den Nachnamen angeben."),
  nickname: optionalText(40),
  birthday: optionalYmd,
  phone: optionalText(40),
});

export const registerSchema = profileSchema.extend({
  email: emailSchema,
  password: passwordSchema,
});

export const eventInputSchema = z
  .object({
    kind: z.enum(["KEGELABEND", "EVENT"]),
    eventType: z
      .enum(["KEGELTOUR", "WEIHNACHTSFEIER", "SOMMERFEST", "VEREINSFEIER", "GEBURTSTAG", "AUSFLUG", "SONSTIGES"])
      .optional()
      .nullable(),
    title: trimmed(120).min(1, "Bitte einen Titel angeben."),
    description: optionalText(4000),
    location: optionalText(200),
    date: ymd,
    time: hm,
    endDate: optionalYmd,
    endTime: z.string().optional().transform((v) => (v ? v : null)),
    recurrence: z.enum(["KEINE", "TAEGLICH", "WOECHENTLICH", "ZWEIWOECHENTLICH", "MONATLICH", "INDIVIDUELL"]).default("KEINE"),
    intervalDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
    seriesEndDate: optionalYmd,
  })
  .superRefine((v, ctx) => {
    if (v.recurrence === "INDIVIDUELL" && !v.intervalDays) {
      ctx.addIssue({ code: "custom", path: ["intervalDays"], message: "Bitte das Intervall in Tagen angeben." });
    }
    if (v.seriesEndDate && v.seriesEndDate < v.date) {
      ctx.addIssue({ code: "custom", path: ["seriesEndDate"], message: "Das Serienende liegt vor dem ersten Termin." });
    }
    if (v.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(v.endTime)) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "Bitte eine gültige Uhrzeit angeben." });
    }
    if (v.endDate && v.endDate < v.date) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Das Ende liegt vor dem Beginn." });
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

export const penaltyTypeSchema = z.object({
  name: trimmed(100).min(1, "Bitte eine Bezeichnung angeben."),
  description: optionalText(500),
  amountCents: z.number().int().min(0, "Der Betrag darf nicht negativ sein.").max(100000, "Der Betrag ist zu hoch."),
  active: z.boolean().default(true),
});

export const penaltySchema = z
  .object({
    userId: z.string().uuid("Bitte ein Mitglied auswählen."),
    penaltyTypeId: z.string().uuid().nullable(),
    customLabel: optionalText(100),
    amountCents: z.number().int().min(0).max(100000).nullable(),
    date: ymd,
    eventId: z.string().uuid().nullable(),
    comment: optionalText(500),
  })
  .superRefine((v, ctx) => {
    if (!v.penaltyTypeId && !v.customLabel) {
      ctx.addIssue({ code: "custom", path: ["customLabel"], message: "Bitte eine Strafart wählen oder eine Bezeichnung eingeben." });
    }
    if (!v.penaltyTypeId && v.amountCents === null) {
      ctx.addIssue({ code: "custom", path: ["amountCents"], message: "Bitte einen Betrag angeben." });
    }
  });

export type PenaltyInput = z.infer<typeof penaltySchema>;

export const gameSchema = z.object({
  name: trimmed(80).min(1, "Bitte einen Namen angeben."),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,60}$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche (2–60 Zeichen)."),
  shortDescription: trimmed(200).min(1, "Bitte eine Kurzbeschreibung angeben."),
  goal: trimmed(2000).min(1, "Bitte das Ziel beschreiben."),
  players: trimmed(100).min(1, "Bitte die Spielerzahl angeben."),
  procedure: trimmed(5000).min(1, "Bitte den Ablauf beschreiben."),
  scoring: trimmed(2000).min(1, "Bitte die Wertung beschreiben."),
  example: trimmed(3000).min(1, "Bitte ein Beispiel angeben."),
  rules: z.array(trimmed(500)).max(30),
  scoringMode: z.enum(["HOECHSTE_GEWINNT", "NIEDRIGSTE_GEWINNT"]),
  scoreLabel: trimmed(30).min(1),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});

export type GameInput = z.infer<typeof gameSchema>;

/** Wandelt ZodError in { feld: meldung } um. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
