import { beforeEach, describe, expect, it } from "vitest";
import {
  createPenalty,
  createQuickPenalty,
  deletePenalty,
  deletePenaltyType,
  getOpenPenaltySummary,
  listPenalties,
  markAllPaidForMember,
  savePenaltyType,
  setPenaltyPaid,
  updatePenalty,
} from "@/server/services/penalties";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { addDaysYmd, toYmd, zonedToUtc } from "@/lib/dates";
import { createTestUser, truncateAll } from "./helpers";

beforeEach(truncateAll);

async function setup() {
  const kassenwart = await createTestUser({ roles: ["KASSENWART"] });
  const admin = await createTestUser({ roles: ["ADMIN"] });
  const peter = await createTestUser({ firstName: "Peter" });
  const max = await createTestUser({ firstName: "Max" });
  const typeId = await savePenaltyType(kassenwart, null, { name: "Zu spät gekommen", amountCents: 200, active: true });
  return { kassenwart, admin, peter, max, typeId };
}

const penaltyFor = (userId: string, typeId: string | null, extra: object = {}) => ({
  userId,
  penaltyTypeId: typeId,
  customLabel: undefined,
  amountCents: null,
  date: "2026-10-12",
  eventId: null,
  comment: undefined,
  ...extra,
});

describe("Strafen", () => {
  it("Kassenwart vergibt eine Strafe – Betrag kommt aus dem Katalog", async () => {
    const { kassenwart, peter, typeId } = await setup();
    await createPenalty(kassenwart, penaltyFor(peter.id, typeId));
    const list = await listPenalties(kassenwart, { userId: peter.id });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ label: "Zu spät gekommen", amountCents: 200, date: "2026-10-12" });
  });

  it("nur der Kassenwart darf Strafen zuordnen – Mitglieder und Admins nicht", async () => {
    const { admin, peter, max, typeId } = await setup();
    await expect(createPenalty(max, penaltyFor(peter.id, typeId))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createPenalty(admin, penaltyFor(peter.id, typeId))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createPenalty(peter, penaltyFor(peter.id, typeId))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("nur der Kassenwart darf Strafen bearbeiten, löschen und den Katalog pflegen", async () => {
    const { kassenwart, admin, peter, typeId } = await setup();
    const id = await createPenalty(kassenwart, penaltyFor(peter.id, typeId));
    await expect(updatePenalty(admin, id, penaltyFor(peter.id, typeId))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deletePenalty(peter, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setPenaltyPaid(peter, id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(savePenaltyType(admin, null, { name: "X", amountCents: 100, active: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await deletePenalty(kassenwart, id);
    expect(await listPenalties(kassenwart)).toHaveLength(0);
  });

  it("Mitglieder sehen ausschließlich ihre eigenen Strafen", async () => {
    const { kassenwart, peter, max, typeId } = await setup();
    await createPenalty(kassenwart, penaltyFor(peter.id, typeId));
    await createPenalty(kassenwart, penaltyFor(max.id, typeId));
    const forMax = await listPenalties(max, { userId: peter.id });
    expect(forMax).toHaveLength(1);
    expect(forMax[0].userId).toBe(max.id);
  });

  it("sonstige Strafe mit eigenem Betrag und Bezahlt-Status", async () => {
    const { kassenwart, peter } = await setup();
    const id = await createPenalty(kassenwart, penaltyFor(peter.id, null, { customLabel: "Pudel geworfen", amountCents: 50 }));
    expect(await getOpenPenaltySummary(peter.id)).toEqual({ count: 1, totalCents: 50 });
    await setPenaltyPaid(kassenwart, id, true);
    expect(await getOpenPenaltySummary(peter.id)).toEqual({ count: 0, totalCents: 0 });
  });

  it("sonstige Strafe ohne Bezeichnung wird abgelehnt", async () => {
    const { kassenwart, peter } = await setup();
    await expect(createPenalty(kassenwart, penaltyFor(peter.id, null, { amountCents: 50 }))).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("bereits vergebene Strafart kann nicht gelöscht werden", async () => {
    const { kassenwart, peter, typeId } = await setup();
    await createPenalty(kassenwart, penaltyFor(peter.id, typeId));
    await expect(deletePenaltyType(kassenwart, typeId)).rejects.toThrow(/inaktiv/);
  });
});

describe("Schnellerfassung & Kassieren", () => {
  async function addEvent(kind: "KEGELABEND" | "EVENT", startsAt: Date, status: "GEPLANT" | "ABGESAGT" = "GEPLANT") {
    const [e] = await getDb().insert(events).values({ kind, title: kind, startsAt, status }).returning({ id: events.id });
    return e.id;
  }

  it("Schnellerfassung: Datum heute, Betrag aus Katalog, heutiger Kegelabend wird zugeordnet", async () => {
    const { kassenwart, peter, typeId } = await setup();
    const today = toYmd(new Date());
    await addEvent("EVENT", zonedToUtc(today, "10:00"));
    const evening = await addEvent("KEGELABEND", zonedToUtc(today, "19:00"));
    await addEvent("KEGELABEND", zonedToUtc(addDaysYmd(today, 1), "19:00"));

    await createQuickPenalty(kassenwart, peter.id, typeId);
    const [p] = await listPenalties(kassenwart, { userId: peter.id });
    expect(p).toMatchObject({ label: "Zu spät gekommen", amountCents: 200, date: today, eventId: evening });
  });

  it("Schnellerfassung ohne heutigen Termin – abgesagte Termine zählen nicht", async () => {
    const { kassenwart, peter, typeId } = await setup();
    await addEvent("KEGELABEND", zonedToUtc(toYmd(new Date()), "19:00"), "ABGESAGT");
    await createQuickPenalty(kassenwart, peter.id, typeId);
    const [p] = await listPenalties(kassenwart, { userId: peter.id });
    expect(p.eventId).toBeNull();
  });

  it("Schnellerfassung nur durch den Kassenwart", async () => {
    const { admin, peter, typeId } = await setup();
    await expect(createQuickPenalty(admin, peter.id, typeId)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(createQuickPenalty(peter, peter.id, typeId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("„Alles bezahlt“ markiert nur die offenen Strafen dieses Mitglieds", async () => {
    const { kassenwart, admin, peter, max, typeId } = await setup();
    await createPenalty(kassenwart, penaltyFor(peter.id, typeId));
    await createPenalty(kassenwart, penaltyFor(peter.id, typeId));
    const alreadyPaid = await createPenalty(kassenwart, penaltyFor(peter.id, typeId));
    await setPenaltyPaid(kassenwart, alreadyPaid, true);
    await createPenalty(kassenwart, penaltyFor(max.id, typeId));

    await expect(markAllPaidForMember(admin, peter.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await markAllPaidForMember(kassenwart, peter.id)).toBe(2);
    expect(await getOpenPenaltySummary(peter.id)).toEqual({ count: 0, totalCents: 0 });
    expect(await getOpenPenaltySummary(max.id)).toEqual({ count: 1, totalCents: 200 });
  });
});
