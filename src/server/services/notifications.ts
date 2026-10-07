import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { penalties, penaltyTypes, profiles, userRoles, users } from "@/server/db/schema";
import { formatEuro, fullName } from "@/lib/format";
import { sendMail } from "./mail";
import { sendPushToUsers } from "./push";

/*
 * Benachrichtigungen zu Ereignissen in der App. Alle Funktionen schlucken Fehler,
 * damit sie gefahrlos nach einer erfolgreichen Aktion (z. B. per `after()`) laufen können.
 */

async function activeAdmins() {
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "ADMIN")))
    .where(inArray(users.status, ["AKTIV", "PASSIV"]));
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
        comment: penalties.comment,
      })
      .from(penalties)
      .leftJoin(penaltyTypes, eq(penaltyTypes.id, penalties.penaltyTypeId))
      .where(eq(penalties.id, penaltyId))
      .limit(1);
    if (!p) return;

    const label = p.typeName ?? p.customLabel ?? "Sonstige Strafe";
    const body = `${label}: ${formatEuro(p.amountCents)}${p.comment ? ` – ${p.comment}` : ""}`;
    await sendPushToUsers([p.userId], { title: "Neue Strafe", body, url: "/strafen" });
  } catch (error) {
    console.error("Benachrichtigung „Neue Strafe“ fehlgeschlagen:", error instanceof Error ? error.message : "unbekannt");
  }
}
