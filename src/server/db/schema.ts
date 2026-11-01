import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  integer,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────── Enums ───────────── */

export const userStatusEnum = pgEnum("user_status", ["AUSSTEHEND", "AKTIV", "PASSIV", "INAKTIV"]);
export const eventKindEnum = pgEnum("event_kind", ["KEGELABEND", "EVENT"]);
export const eventTypeEnum = pgEnum("event_type", [
  "KEGELTOUR",
  "WEIHNACHTSFEIER",
  "SOMMERFEST",
  "VEREINSFEIER",
  "GEBURTSTAG",
  "AUSFLUG",
  "SONSTIGES",
]);
export const eventStatusEnum = pgEnum("event_status", ["GEPLANT", "ABGESAGT", "ABGESCHLOSSEN"]);
export const recurrenceEnum = pgEnum("recurrence", [
  "KEINE",
  "TAEGLICH",
  "WOECHENTLICH",
  "ZWEIWOECHENTLICH",
  "MONATLICH",
  "INDIVIDUELL",
  /** z. B. jeden 2. Freitag im Monat – siehe `monthWeek` und `weekday` der Serie. */
  "MONATLICH_WOCHENTAG",
]);
export const rsvpEnum = pgEnum("rsvp_status", ["ZUGESAGT", "ABGESAGT"]);
export const cashEntryKindEnum = pgEnum("cash_entry_kind", ["EINNAHME", "AUSGABE"]);

/* ───────────── Benutzer & Authentifizierung ───────────── */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  status: userStatusEnum("status").notNull().default("AUSSTEHEND"),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  nickname: text("nickname"),
  birthday: date("birthday", { mode: "string" }),
  phone: text("phone"),
  avatarImageId: uuid("avatar_image_id").references(() => images.id, { onDelete: "set null" }),
  /** Individueller Monatsbeitrag; null = Standardbeitrag des Vereins. */
  duesCents: integer("dues_cents"),
  updatedAt: updatedAt(),
});

/**
 * Rollen mit frei wählbaren Rechten. MITGLIED und ADMIN sind Systemrollen (nicht löschbar),
 * weitere Rollen legt der Admin selbst an. Der Schlüssel neuer Rollen ist eine zufällige ID.
 */
export const roles = pgTable("roles", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  permissions: text("permissions").array().notNull().default([]),
  isSystem: boolean("is_system").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Mehrere Rollen pro Benutzer möglich (z. B. Admin + Kassenwart). MITGLIED gilt implizit für alle. */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role")
      .notNull()
      .references(() => roles.key, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256-Hash des Session-Tokens; das Token selbst wird nie gespeichert. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

/** Web-Push-Abo eines Geräts. Ein Benutzer kann mehrere Geräte haben. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user_idx").on(t.userId)],
);

/* ───────────── Termine ───────────── */

/** Regel einer wiederkehrenden Terminserie. Einzeltermine liegen in `events`. */
export const eventSeries = pgTable("event_series", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: eventKindEnum("kind").notNull(),
  eventType: eventTypeEnum("event_type"),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startDate: date("start_date", { mode: "string" }).notNull(),
  startTime: text("start_time").notNull(),
  recurrence: recurrenceEnum("recurrence").notNull(),
  intervalDays: integer("interval_days"),
  /** Bei MONATLICH_WOCHENTAG: der wievielte im Monat (1–4, 5 = letzter) … */
  monthWeek: integer("month_week"),
  /** … und welcher Wochentag (0 = Sonntag … 6 = Samstag). */
  weekday: integer("weekday"),
  endDate: date("end_date", { mode: "string" }),
  imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Ein konkreter Termin – Kegelabend oder Event. Gehört optional zu einer Serie. */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seriesId: uuid("series_id").references(() => eventSeries.id, { onDelete: "set null" }),
    /** Ursprüngliches Datum innerhalb der Serie (bleibt auch bei Verschiebung erhalten). */
    seriesDate: date("series_date", { mode: "string" }),
    kind: eventKindEnum("kind").notNull(),
    eventType: eventTypeEnum("event_type"),
    title: text("title").notNull(),
    description: text("description"),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: eventStatusEnum("status").notNull().default("GEPLANT"),
    imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
    /** true, sobald dieser Serientermin einzeln geändert wurde – Serienänderungen überschreiben ihn dann nicht mehr. */
    isDetached: boolean("is_detached").notNull().default(false),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("events_starts_at_idx").on(t.startsAt),
    uniqueIndex("events_series_date_idx").on(t.seriesId, t.seriesDate),
  ],
);

/** Rückmeldung eines Mitglieds. Kein Datensatz = noch keine Rückmeldung. */
export const eventParticipations = pgTable(
  "event_participations",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: rsvpEnum("status").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

/* ───────────── Strafen ───────────── */

export const penaltyTypes = pgTable("penalty_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const penalties = pgTable(
  "penalties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    penaltyTypeId: uuid("penalty_type_id").references(() => penaltyTypes.id, { onDelete: "restrict" }),
    /** Nur bei „sonstiger Strafe“ ohne Katalogeintrag gesetzt. */
    customLabel: text("custom_label"),
    /** Gesamtbetrag zum Zeitpunkt der Vergabe (Katalogpreise können sich später ändern) – schon mal `quantity`. */
    amountCents: integer("amount_cents").notNull(),
    /** Wie oft die Strafe passiert ist, z. B. 3× Gosse. */
    quantity: integer("quantity").notNull().default(1),
    /** Teil des Betrags, der mit Guthaben (Auslagen des Mitglieds) verrechnet wurde – der Rest ist bar zu zahlen. */
    creditCents: integer("credit_cents").notNull().default(0),
    date: date("date", { mode: "string" }).notNull(),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    comment: text("comment"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("penalties_user_idx").on(t.userId)],
);

/* ───────────── Kasse ───────────── */

/**
 * Kassenbuch: Einnahmen und Ausgaben, die nicht schon als Strafe oder Beitrag erfasst sind.
 * Eine Ausgabe mit `paidByUserId` hat ein Mitglied aus eigener Tasche ausgelegt: Sie verändert
 * den Kassenstand nicht, sondern wird dem Mitglied als Guthaben gutgeschrieben.
 */
export const cashEntries = pgTable(
  "cash_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: cashEntryKindEnum("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    description: text("description").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    paidByUserId: uuid("paid_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("cash_entries_date_idx").on(t.date), index("cash_entries_paid_by_idx").on(t.paidByUserId)],
);

/* ───────────── Monatsbeiträge ───────────── */

/** Beitrag eines Mitglieds für einen Monat. Betrag wird beim Anlegen festgeschrieben. */
export const dues = pgTable(
  "dues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Erster Tag des Monats, z. B. 2026-10-01. */
    month: date("month", { mode: "string" }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("dues_user_month_idx").on(t.userId, t.month), index("dues_month_idx").on(t.month)],
);

/* ───────────── Einstellungen ───────────── */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** Schlüssel einer Rolle (MITGLIED, KASSENWART, ADMIN oder ID einer selbst angelegten Rolle). */
export type Role = string;
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type EventKind = (typeof eventKindEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type Recurrence = (typeof recurrenceEnum.enumValues)[number];
export type RsvpStatus = (typeof rsvpEnum.enumValues)[number];
export type CashEntryKind = (typeof cashEntryKindEnum.enumValues)[number];
