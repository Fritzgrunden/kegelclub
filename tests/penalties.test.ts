import { beforeEach, describe, expect, it } from "vitest";
import {
  createPenalty,
  deletePenalty,
  deletePenaltyType,
  getOpenPenaltySummary,
  listPenalties,
  savePenaltyType,
  setPenaltyPaid,
  updatePenalty,
} from "@/server/services/penalties";
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
