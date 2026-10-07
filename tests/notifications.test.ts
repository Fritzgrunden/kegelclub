import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/server/db/client";
import { pushSubscriptions } from "@/server/db/schema";
import { createPenalty, savePenaltyType } from "@/server/services/penalties";
import { notifyNewRegistration, notifyPenaltyCreated } from "@/server/services/notifications";
import { removeSubscription, saveSubscription, sendPushToUsers, setPushSenderForTests } from "@/server/services/push";
import { createTestUser, truncateAll } from "./helpers";

interface Sent {
  endpoint: string;
  payload: { title: string; body: string; url?: string };
}

let sent: Sent[] = [];
let responseStatus = 201;

beforeEach(async () => {
  await truncateAll();
  sent = [];
  responseStatus = 201;
  setPushSenderForTests(async (sub, payload) => {
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
    return responseStatus;
  });
});

afterAll(() => setPushSenderForTests(null));

let deviceCounter = 0;
async function subscribe(userId: string) {
  const endpoint = `https://push.example.test/geraet-${++deviceCounter}`;
  await saveSubscription(userId, { endpoint, keys: { p256dh: "schluessel", auth: "geheim" } });
  return endpoint;
}

describe("Push-Abos", () => {
  it("speichert Abos und lehnt ungültige ab", async () => {
    const peter = await createTestUser();
    await subscribe(peter.id);
    await expect(saveSubscription(peter.id, { endpoint: "kein-link", keys: {} })).rejects.toThrow("Ungültiges Push-Abo");
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(1);
  });

  it("ein Gerät wechselt den Besitzer, wenn sich jemand anderes darauf anmeldet", async () => {
    const peter = await createTestUser();
    const max = await createTestUser();
    const endpoint = await subscribe(peter.id);
    await saveSubscription(max.id, { endpoint, keys: { p256dh: "neu", auth: "neu" } });

    await sendPushToUsers([peter.id], { title: "x", body: "y" });
    expect(sent).toHaveLength(0);
    await sendPushToUsers([max.id], { title: "x", body: "y" });
    expect(sent).toHaveLength(1);
  });

  it("man kann nur eigene Abos entfernen", async () => {
    const peter = await createTestUser();
    const max = await createTestUser();
    const endpoint = await subscribe(peter.id);
    await removeSubscription(max.id, endpoint);
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(1);
    await removeSubscription(peter.id, endpoint);
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("abgelaufene Abos (HTTP 410) werden automatisch gelöscht", async () => {
    const peter = await createTestUser();
    await subscribe(peter.id);
    responseStatus = 410;
    expect(await sendPushToUsers([peter.id], { title: "x", body: "y" })).toBe(0);
    expect(await getDb().select().from(pushSubscriptions)).toHaveLength(0);
  });

  it("ein fehlerhafter Push-Dienst bricht nichts ab", async () => {
    const peter = await createTestUser();
    await subscribe(peter.id);
    setPushSenderForTests(async () => {
      throw new Error("Netzwerk weg");
    });
    await expect(sendPushToUsers([peter.id], { title: "x", body: "y" })).resolves.toBe(0);
  });
});

describe("Benachrichtigungen", () => {
  it("neue Registrierung geht an alle aktiven Admins – nicht an Mitglieder oder deaktivierte Admins", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const exAdmin = await createTestUser({ roles: ["ADMIN"], status: "INAKTIV" });
    const mitglied = await createTestUser();
    const neu = await createTestUser({ status: "AUSSTEHEND", firstName: "Neuling" });
    const adminDevice = await subscribe(admin.id);
    await subscribe(exAdmin.id);
    await subscribe(mitglied.id);

    await notifyNewRegistration(neu.id);

    expect(sent).toHaveLength(1);
    expect(sent[0].endpoint).toBe(adminDevice);
    expect(sent[0].payload).toMatchObject({ title: "Neue Registrierung", url: "/verwaltung" });
    expect(sent[0].payload.body).toContain("Neuling");
  });

  it("neue Strafe geht nur an das bestrafte Mitglied – mit Strafart und Betrag", async () => {
    const kassenwart = await createTestUser({ roles: ["KASSENWART"] });
    const peter = await createTestUser();
    const max = await createTestUser();
    const peterDevice = await subscribe(peter.id);
    await subscribe(max.id);
    await subscribe(kassenwart.id);
    const typeId = await savePenaltyType(kassenwart, null, { name: "Pumpe", amountCents: 50, active: true });

    const penaltyId = await createPenalty(kassenwart, {
      userId: peter.id,
      penaltyTypeId: typeId,
      amountCents: null,
      date: "2026-10-12",
      eventId: null,
    });
    await notifyPenaltyCreated(penaltyId);

    expect(sent).toHaveLength(1);
    expect(sent[0].endpoint).toBe(peterDevice);
    expect(sent[0].payload).toMatchObject({ title: "Neue Strafe", url: "/strafen" });
    expect(sent[0].payload.body).toMatch(/^Pumpe: 0,50\s€$/);
  });

  it("alle Geräte eines Mitglieds werden benachrichtigt", async () => {
    const kassenwart = await createTestUser({ roles: ["KASSENWART"] });
    const peter = await createTestUser();
    await subscribe(peter.id);
    await subscribe(peter.id);
    const penaltyId = await createPenalty(kassenwart, {
      userId: peter.id,
      penaltyTypeId: null,
      customLabel: "Handy am Tisch",
      amountCents: 100,
      date: "2026-10-12",
      eventId: null,
    });
    await notifyPenaltyCreated(penaltyId);
    expect(sent).toHaveLength(2);
    expect(sent[0].payload.body).toContain("Handy am Tisch");
  });
});
