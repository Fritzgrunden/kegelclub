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
  serial,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ───────────── Enums ───────────── */

export const roleEnum = pgEnum("role", ["MITGLIED", "KASSENWART", "ADMIN"]);
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
]);
export const rsvpEnum = pgEnum("rsvp_status", ["ZUGESAGT", "ABGESAGT"]);
export const scoringModeEnum = pgEnum("scoring_mode", ["HOECHSTE_GEWINNT", "NIEDRIGSTE_GEWINNT"]);
export const gameSessionStatusEnum = pgEnum("game_session_status", ["LAUFEND", "ABGESCHLOSSEN"]);

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
  updatedAt: updatedAt(),
});

/** Mehrere Rollen pro Benutzer möglich (z. B. Admin + Kassenwart). MITGLIED gilt implizit für alle. */
export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
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

/* ───────────── Kegelspiele ───────────── */

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  shortDescription: text("short_description").notNull(),
  goal: text("goal").notNull(),
  players: text("players").notNull(),
  procedure: text("procedure").notNull(),
  scoring: text("scoring").notNull(),
  example: text("example").notNull(),
  scoringMode: scoringModeEnum("scoring_mode").notNull().default("HOECHSTE_GEWINNT"),
  scoreLabel: text("score_label").notNull().default("Punkte"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const gameRules = pgTable("game_rules", {
  id: serial("id").primaryKey(),
  gameId: uuid("game_id")
    .notNull()
    .references(() => games.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  text: text("text").notNull(),
});

/** Eine gespielte Runde eines Kegelspiels an einem Termin. */
export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "restrict" }),
    status: gameSessionStatusEnum("status").notNull().default("LAUFEND"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("game_sessions_event_idx").on(t.eventId)],
);

/** Teilnehmer einer Spielrunde inkl. Ergebnis (GameParticipant + GameResult zusammengeführt). */
export const gameResults = pgTable(
  "game_results",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score"),
    rank: integer("rank"),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.userId] })],
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
    /** Betrag zum Zeitpunkt der Vergabe (Katalogpreise können sich später ändern). */
    amountCents: integer("amount_cents").notNull(),
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

/* ───────────── Einstellungen ───────────── */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Role = (typeof roleEnum.enumValues)[number];
export type UserStatus = (typeof userStatusEnum.enumValues)[number];
export type EventKind = (typeof eventKindEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
export type EventStatus = (typeof eventStatusEnum.enumValues)[number];
export type Recurrence = (typeof recurrenceEnum.enumValues)[number];
export type RsvpStatus = (typeof rsvpEnum.enumValues)[number];
export type ScoringMode = (typeof scoringModeEnum.enumValues)[number];
