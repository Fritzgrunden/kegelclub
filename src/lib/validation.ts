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
    recurrence: z.enum(["KEINE", "TAEGLICH", "WOECHENTLICH", "ZWEIWOECHENTLICH", "MONATLICH", "INDIVIDUELL", "MONATLICH_WOCHENTAG"]).default("KEINE"),
    intervalDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
    monthWeek: z.coerce.number().int().min(1).max(5).optional().nullable(),
    weekday: z.coerce.number().int().min(0).max(6).optional().nullable(),
    seriesEndDate: optionalYmd,
  })
  .superRefine((v, ctx) => {
    if (v.recurrence === "INDIVIDUELL" && !v.intervalDays) {
      ctx.addIssue({ code: "custom", path: ["intervalDays"], message: "Bitte das Intervall in Tagen angeben." });
    }
    if (v.recurrence === "MONATLICH_WOCHENTAG" && (v.monthWeek == null || v.weekday == null)) {
      ctx.addIssue({ code: "custom", path: ["monthWeek"], message: "Bitte wählen, an welchem Wochentag im Monat." });
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

export const roleSchema = z.object({
  name: trimmed(40).min(1, "Bitte einen Namen angeben."),
  description: optionalText(200),
  permissions: z.array(z.string()).default([]),
});

const centsField = z.number().int().min(0, "Der Betrag darf nicht negativ sein.").max(100000, "Der Betrag ist zu hoch.");
export const duesAmountSchema = centsField;
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Ungültiger Monat.");

export const penaltySchema = z
  .object({
    userId: z.string().uuid("Bitte ein Mitglied auswählen."),
    penaltyTypeId: z.string().uuid().nullable(),
    customLabel: optionalText(100),
    /** Betrag für ein Mal; gespeichert wird Betrag × Anzahl. */
    amountCents: z.number().int().min(0).max(100000).nullable(),
    quantity: z.number({ invalid_type_error: "Bitte eine Anzahl angeben." }).int("Bitte eine ganze Zahl angeben.").min(1, "Mindestens 1.").max(99, "Höchstens 99.").default(1),
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

export const cashEntrySchema = z
  .object({
    kind: z.enum(["EINNAHME", "AUSGABE"], { message: "Bitte Einnahme oder Ausgabe wählen." }),
    amountCents: z.number({ invalid_type_error: "Bitte einen Betrag angeben." }).int().min(1, "Der Betrag muss größer als 0 sein.").max(1000000, "Der Betrag ist zu hoch."),
    description: trimmed(100).min(1, "Bitte angeben, wofür."),
    date: ymd,
    /** Nur bei Ausgaben: Mitglied hat aus eigener Tasche bezahlt. */
    paidByUserId: z.string().uuid("Unbekanntes Mitglied.").nullable(),
  })
  .refine((v) => v.kind === "AUSGABE" || v.paidByUserId === null, { path: ["paidByUserId"], message: "Nur bei Ausgaben möglich." });

/** Wandelt ZodError in { feld: meldung } um. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}
