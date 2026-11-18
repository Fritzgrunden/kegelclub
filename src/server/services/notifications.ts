import "server-only";
import { and, eq, gte, inArray, isNull, lt, notExists, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { eventParticipations, events, penalties, penaltyTypes, profiles, roles, userRoles, users } from "@/server/db/schema";
import { formatEuro, fullName, penaltyLabel } from "@/lib/format";
import { addDaysYmd, formatTime, formatWeekday, toYmd, zonedToUtc } from "@/lib/dates";
import { formatDeadline, rsvpDeadline } from "@/lib/rsvp";
import { sendMail } from "./mail";
import { sendPushToUsers } from "./push";

/*
 * Benachrichtigungen zu Ereignissen in der App. Alle Funktionen schlucken Fehler,
 * damit sie gefahrlos nach einer erfolgreichen Aktion (z. B. per `after()`) laufen können.
 */

/** Alle, die Mitglieder freischalten dürfen – egal über welche Rolle. */
async function activeAdmins() {
  return db
    .selectDistinct({ id: users.id, email: users.email })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.key, userRoles.role))
    .where(and(inArray(users.status, ["AKTIV", "PASSIV"]), sql`'members:manage' = any(${roles.permissions})`));
}

/** Admins erfahren per Push (und E-Mail, falls konfiguriert), dass jemand auf Freischaltung wartet. */
export async function notifyNewRegistration(userId: string) {
  try {
    const person = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
    if (!person) return;
    const name = fullName(person);
    const admins = await activeAdmins();

    await sendPushToUsers(
      admins.map((a) => a.id),
      { title: "Neue Registrierung", body: `${name} wartet auf Freischaltung.`, url: "/verwaltung" },
    );

    const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    await Promise.all(
      admins.map((a) =>
        sendMail({
          to: a.email,
          subject: `Neue Registrierung: ${name}`,
          text: `Hallo,\n\n${name} hat sich in der Kegelclub-App registriert und wartet auf Freischaltung.\n\n${appUrl}/verwaltung\n`,
        }),
      ),
    );
  } catch (error) {
    console.error("Benachrichtigung „Neue Registrierung“ fehlgeschlagen:", error instanceof Error ? error.message : "unbekannt");
  }
}

/** Das Mitglied erfährt per Push, dass ihm eine Strafe eingetragen wurde. */
export async function notifyPenaltyCreated(penaltyId: string) {
  try {
    const [p] = await db
      .select({
        userId: penalties.userId,
        typeName: penaltyTypes.name,
        customLabel: penalties.customLabel,
        amountCents: penalties.amountCents,
        quantity: penalties.quantity,
        comment: penalties.comment,
      })
      .from(penalties)
      .leftJoin(penaltyTypes, eq(penaltyTypes.id, penalties.penaltyTypeId))
      .where(eq(penalties.id, penaltyId))
      .limit(1);
    if (!p) return;

    const label = penaltyLabel(p.typeName ?? p.customLabel ?? "Sonstige Strafe", p.quantity);
    const body = `${label}: ${formatEuro(p.amountCents)}${p.comment ? ` – ${p.comment}` : ""}`;
    await sendPushToUsers([p.userId], { title: "Neue Strafe", body, url: "/strafen" });
  } catch (error) {
    console.error("Benachrichtigung „Neue Strafe“ fehlgeschlagen:", error instanceof Error ? error.message : "unbekannt");
  }
}

/**
 * Erinnerung am Vortag: Wer zu einem Termin von morgen noch nicht zu- oder abgesagt hat, bekommt eine Push-Nachricht.
 * Läuft einmal täglich am Abend (Vercel Cron, siehe vercel.json). Jeder Termin wird höchstens einmal erinnert
 * (`reminderSentAt`), auch wenn der Aufruf doppelt kommt. Ist die Frist schon abgelaufen, wird nicht mehr erinnert.
 */
export async function sendEventReminders(now = new Date()) {
  const tomorrow = addDaysYmd(toYmd(now), 1);
  const from = zonedToUtc(tomorrow, "00:00");
  const to = zonedToUtc(addDaysYmd(tomorrow, 1), "00:00");

  const due = await db
    .select()
    .from(events)
    .where(and(eq(events.status, "GEPLANT"), isNull(events.reminderSentAt), gte(events.startsAt, from), lt(events.startsAt, to)));

  let reminded = 0;
  let notified = 0;
  for (const event of due) {
    // Erst als erinnert markieren – so verschickt ein paralleler Aufruf nichts doppelt.
    const claimed = await db
      .update(events)
      .set({ reminderSentAt: now })
      .where(and(eq(events.id, event.id), isNull(events.reminderSentAt)))
      .returning({ id: events.id });
    if (claimed.length === 0) continue;

    const deadline = rsvpDeadline(event);
    if (deadline && now >= deadline) continue;

    // Aktive Mitglieder, die zusagen dürfen und noch keine Rückmeldung gegeben haben (passive werden nicht erinnert)
    const recipients = await db
      .selectDistinct({ id: users.id })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.key, userRoles.role))
      .where(
        and(
          eq(users.status, "AKTIV"),
          sql`'events:rsvp' = any(${roles.permissions})`,
          notExists(
            db
              .select({ one: sql`1` })
              .from(eventParticipations)
              .where(and(eq(eventParticipations.eventId, event.id), eq(eventParticipations.userId, users.id))),
          ),
        ),
      );
    if (recipients.length === 0) continue;

    const parts = [`${formatWeekday(event.startsAt)}, ${formatTime(event.startsAt)} Uhr`];
    if (event.location) parts.push(event.location);
    const body = `${parts.join(" · ")} – sagst du zu oder ab?${deadline ? ` Antwort bis ${formatDeadline(deadline)}.` : ""}`;
    try {
      notified += await sendPushToUsers(
        recipients.map((r) => r.id),
        { title: `Morgen: ${event.title}`, body, url: `/termine/${event.id}` },
      );
      reminded++;
    } catch (error) {
      console.error("Erinnerung fehlgeschlagen:", error instanceof Error ? error.message : "unbekannt");
    }
  }
  return { events: due.length, reminded, notified };
}
