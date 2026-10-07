/**
 * Demo-Daten: npm run db:seed            (nur in leere Datenbank)
 *             npm run db:seed -- --reset (ACHTUNG: löscht vorher ALLE Daten)
 * Alle Demo-Konten erhalten das Passwort aus SEED_DEMO_PASSWORD.
 */
import "./load-env";
import { sql } from "drizzle-orm";
import { getDb, resetDbConnection } from "../src/server/db/client";
import { eventParticipations, events, profiles, userRoles, users, type Role, type UserStatus } from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/crypto";
import { createEvent, updateEvent } from "../src/server/services/events";
import { saveGame } from "../src/server/services/games";
import { createGameSession, saveScores } from "../src/server/services/results";
import { createPenalty, savePenaltyType, setPenaltyPaid } from "../src/server/services/penalties";
import { updateSettings } from "../src/server/services/settings";
import { addDaysYmd, toYmd } from "../src/lib/dates";
import { DEFAULT_GAMES } from "./data/games";

// Reproduzierbarer Zufall
let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const MEMBERS: { first: string; last: string; nick?: string; roles: Role[]; status?: UserStatus; birthday: string }[] = [
  { first: "Max", last: "Mustermann", nick: "Maxe", roles: ["ADMIN"], birthday: "1978-03-14" },
  { first: "Erika", last: "Musterfrau", nick: "Kassen-Erika", roles: ["KASSENWART"], birthday: "1982-10-21" },
  { first: "Peter", last: "Beispiel", roles: [], birthday: "1975-07-02" },
  { first: "Klaus", last: "Probe", nick: "Klausi", roles: [], birthday: "1969-12-24" },
  { first: "Anna", last: "Demo", roles: [], birthday: "1990-05-30" },
  { first: "Jürgen", last: "Testmann", nick: "Jupp", roles: [], birthday: "1964-01-09" },
  { first: "Sabine", last: "Platzhalter", roles: [], birthday: "1987-08-17" },
  { first: "Dieter", last: "Muster", nick: "Didi", roles: [], birthday: "1971-11-05" },
  { first: "Monika", last: "Exempel", roles: [], status: "PASSIV", birthday: "1980-04-11" },
  { first: "Neu", last: "Anwärter", roles: [], status: "AUSSTEHEND", birthday: "1995-02-28" },
];

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD ?? "";
  if (password.length < 10) {
    throw new Error("Bitte SEED_DEMO_PASSWORD (mind. 10 Zeichen) in .env setzen – es gibt bewusst kein Standardpasswort.");
  }
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error("Seed in Produktion nur mit ALLOW_SEED=1.");
  }
  const db = getDb();
  const reset = process.argv.includes("--reset");
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  if (Number(n) > 0 && !reset) {
    throw new Error("Die Datenbank enthält bereits Benutzer. Mit `npm run db:seed -- --reset` werden ALLE Daten gelöscht und neu angelegt.");
  }
  if (reset) {
    await db.execute(sql`
      truncate table penalties, penalty_types, game_results, game_sessions, game_rules, games, event_participations,
      events, event_series, password_reset_tokens, sessions, rate_limits, user_roles, profiles, images, users, settings cascade`);
  }

  console.log("→ Mitglieder");
  const hash = await hashPassword(password);
  const people: { id: string; roles: Role[]; status: UserStatus; email: string }[] = [];
  for (const m of MEMBERS) {
    const email = `${m.first.toLowerCase().replace("ü", "ue")}@demo.kegelclub.test`;
    const status = m.status ?? "AKTIV";
    const [u] = await db.insert(users).values({ email, passwordHash: hash, status }).returning({ id: users.id });
    await db.insert(profiles).values({ userId: u.id, firstName: m.first, lastName: m.last, nickname: m.nick ?? null, birthday: m.birthday });
    const roles: Role[] = ["MITGLIED", ...m.roles];
    await db.insert(userRoles).values(roles.map((role) => ({ userId: u.id, role })));
    people.push({ id: u.id, roles, status, email });
  }
  const admin = people[0];
  const kassenwart = people[1];
  const active = people.filter((p) => p.status === "AKTIV");

  await updateSettings(admin, { clubName: "Kegelclub Alle Neune (Demo)", defaultLocation: "Gaststätte Zur Goldenen Kugel, Bahn 2", defaultTime: "19:00" });

  console.log("→ Kegelspiele");
  const gameIds: Record<string, string> = {};
  for (const g of DEFAULT_GAMES) gameIds[g.slug] = await saveGame(admin, null, g);

  console.log("→ Kegelabende (Serie alle 2 Wochen) & Events");
  const today = toYmd(new Date());
  // Freitag vor ca. 12 Wochen als Serienstart
  let start = addDaysYmd(today, -84);
  while (new Date(start + "T12:00:00Z").getUTCDay() !== 5) start = addDaysYmd(start, 1);
  const series = await createEvent(admin, {
    kind: "KEGELABEND",
    title: "Kegelabend",
    description: "Unser regulärer Kegelabend. Bitte bis Donnerstag zu- oder absagen, damit wir die Bahn passend buchen können.",
    location: "Gaststätte Zur Goldenen Kugel, Bahn 2",
    date: start,
    time: "19:00",
    recurrence: "ZWEIWOECHENTLICH",
    seriesEndDate: addDaysYmd(today, 180),
  });

  const seriesEvents = await db.select().from(events).where(sql`${events.seriesId} = ${series.seriesId}`).orderBy(events.startsAt);
  const past = seriesEvents.filter((e) => e.startsAt < new Date());
  const future = seriesEvents.filter((e) => e.startsAt >= new Date());

  // Ein zukünftiger Termin wird einzeln verschoben (Beispiel für Ausnahme in der Serie)
  if (future[2]) {
    await updateEvent(admin, future[2].id, {
      title: "Kegelabend (verschoben wegen Schützenfest)",
      date: addDaysYmd(toYmd(future[2].startsAt), 1),
      time: "18:00",
      location: "Gaststätte Zur Goldenen Kugel, Bahn 1",
      description: "Ausnahmsweise Samstag, da die Gaststätte freitags belegt ist.",
    }, "EINZELN");
  }

  const tour = await createEvent(admin, {
    kind: "EVENT", eventType: "KEGELTOUR", title: "Kegeltour Sauerland",
    description: "Abfahrt mit dem Bus am Vereinslokal. Übernachtung im Gasthof, Kegeln am Samstagabend. Kosten ca. 120 € p. P.",
    location: "Treffpunkt: Vereinslokal", date: addDaysYmd(today, 24), time: "09:00", endDate: addDaysYmd(today, 26), endTime: "18:00",
  });
  const xmas = await createEvent(admin, {
    kind: "EVENT", eventType: "WEIHNACHTSFEIER", title: "Weihnachtsfeier",
    description: "Mit Grünkohlessen und Wichteln (Wert max. 10 €).", location: "Gaststätte Zur Goldenen Kugel, Saal",
    date: `${today.slice(0, 4)}-12-12`, time: "18:30",
  });
  await createEvent(admin, {
    kind: "EVENT", eventType: "SOMMERFEST", title: "Sommerfest am See", description: "Grillen, Boule und kaltes Bier.",
    location: "Grillhütte am Stadtsee", date: addDaysYmd(today, -60), time: "15:00", endTime: "22:00",
  });

  console.log("→ Zu- und Absagen");
  const rsvp = async (eventId: string, ratio: number) => {
    for (const p of active) {
      const r = rand();
      if (r < ratio) await db.insert(eventParticipations).values({ eventId, userId: p.id, status: "ZUGESAGT" });
      else if (r < ratio + 0.15) await db.insert(eventParticipations).values({ eventId, userId: p.id, status: "ABGESAGT" });
    }
  };
  for (const e of past) await rsvp(e.id, 0.8);
  for (const e of future.slice(0, 3)) await rsvp(e.id, 0.5);
  await rsvp(tour.eventId, 0.6);
  await rsvp(xmas.eventId, 0.4);

  console.log("→ Spielrunden & Ergebnisse");
  const ranges: Record<string, [number, number]> = {
    neuner: [18, 38], abraeumen: [2, 8], tannenbaum: [3, 9], hausnummern: [300, 980],
    fuchsjagd: [0, 6], kranzkegeln: [20, 60], "plus-minus": [0, 30], einunddreissig: [4, 12],
  };
  for (const e of past) {
    const confirmed = (await db.select().from(eventParticipations).where(sql`${eventParticipations.eventId} = ${e.id} and ${eventParticipations.status} = 'ZUGESAGT'`)).map((r) => r.userId);
    if (confirmed.length < 2) continue;
    const slugs = Object.keys(gameIds).sort(() => rand() - 0.5).slice(0, randInt(2, 3));
    for (const slug of slugs) {
      const sessionId = await createGameSession(admin, e.id, gameIds[slug], confirmed);
      const [min, max] = ranges[slug];
      await saveScores(admin, sessionId, confirmed.map((userId) => ({ userId, score: randInt(min, max) })), true);
    }
  }

  console.log("→ Strafkatalog & Strafen");
  const catalog = [
    ["Zu spät gekommen", 200, "Ab 15 Minuten nach Beginn"],
    ["Handy auf der Bahn", 100, null],
    ["Pudel (Fehlwurf)", 50, "Kugel in der Rinne"],
    ["Unentschuldigt gefehlt", 500, "Keine Absage bis zum Vortag"],
    ["Kugel fallen gelassen", 50, null],
    ["Falsche Bahn", 100, "Auf die Nachbarbahn geworfen"],
  ] as const;
  const typeIds: string[] = [];
  for (const [i, [name, cents, description]] of catalog.entries()) {
    typeIds.push(await savePenaltyType(kassenwart, null, { name, amountCents: cents, description: description ?? undefined, active: true }));
    void i;
  }
  for (const e of past) {
    for (let i = 0; i < randInt(1, 4); i++) {
      const id = await createPenalty(kassenwart, {
        userId: pick(active).id,
        penaltyTypeId: pick(typeIds),
        amountCents: null,
        date: toYmd(e.startsAt),
        eventId: e.id,
        comment: rand() < 0.2 ? "Mit Ansage!" : undefined,
        customLabel: undefined,
      });
      if (e !== past.at(-1) && rand() < 0.6) await setPenaltyPaid(kassenwart, id, true);
    }
  }
  await createPenalty(kassenwart, {
    userId: people[3].id, penaltyTypeId: null, customLabel: "Lokalrunde vergessen", amountCents: 300,
    date: past.length ? toYmd(past.at(-1)!.startsAt) : today, eventId: past.at(-1)?.id ?? null, comment: "Geburtstagsrunde nachholen",
  });

  console.log("\n✔ Demo-Daten angelegt. Anmeldung z. B. mit:");
  console.log(`   Admin:       ${admin.email}`);
  console.log(`   Kassenwart:  ${kassenwart.email}`);
  console.log(`   Mitglied:    ${people[2].email}`);
  console.log("   Passwort:    (Wert aus SEED_DEMO_PASSWORD)");
}

main()
  .then(() => resetDbConnection())
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error("✖", e instanceof Error ? e.message : e);
    await resetDbConnection();
    process.exit(1);
  });
