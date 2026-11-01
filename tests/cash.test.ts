import { beforeEach, describe, expect, it } from "vitest";
import { createCashEntry, deleteCashEntry, getAdvancesOfUser, getCashSummary, listCredits } from "@/server/services/cash";
import { createPenalty, getOpenPenaltySummary, listPenalties, setPenaltyPaid } from "@/server/services/penalties";
import { getDb } from "@/server/db/client";
import { dues } from "@/server/db/schema";
import { createTestUser, truncateAll } from "./helpers";

beforeEach(truncateAll);

async function setup() {
  const kassenwart = await createTestUser({ roles: ["KASSENWART"] });
  const fritz = await createTestUser({ firstName: "Fritz" });
  return { kassenwart, fritz };
}

const today = "2026-11-01";
const entry = (kind: "EINNAHME" | "AUSGABE", amountCents: number, paidByUserId: string | null = null) => ({
  kind,
  amountCents,
  description: kind === "EINNAHME" ? "Spende" : "Runde",
  date: today,
  paidByUserId,
});
const penalty = (userId: string, amountCents: number, date: string) => ({
  userId,
  penaltyTypeId: null,
  customLabel: "Gosse",
  amountCents,
  date,
  eventId: null,
  comment: undefined,
});

describe("Kasse", () => {
  it("Kassenstand = bezahlte Strafen + bezahlte Beiträge + Einnahmen − Ausgaben aus der Kasse", async () => {
    const { kassenwart, fritz } = await setup();
    const paid = await createPenalty(kassenwart, penalty(fritz.id, 300, "2026-10-01"));
    await createPenalty(kassenwart, penalty(fritz.id, 900, "2026-10-02")); // offen – zählt nicht
    await setPenaltyPaid(kassenwart, paid, true);
    await getDb().insert(dues).values({ userId: fritz.id, month: "2026-10-01", amountCents: 2000, paidAt: new Date() });
    await createCashEntry(kassenwart, entry("EINNAHME", 1000));
    await createCashEntry(kassenwart, entry("AUSGABE", 500));

    expect(await getCashSummary(fritz)).toMatchObject({
      balanceCents: 300 + 2000 + 1000 - 500,
      penaltiesCents: 300,
      duesCents: 2000,
      incomeCents: 1000,
      expenseCents: 500,
      advancedCents: 0,
    });
  });

  it("Auslage eines Mitglieds wird mit offenen Strafen verrechnet (älteste zuerst, auch teilweise) – Kasse bleibt gleich", async () => {
    const { kassenwart, fritz } = await setup();
    await createPenalty(kassenwart, penalty(fritz.id, 800, "2026-10-02"));
    await createPenalty(kassenwart, penalty(fritz.id, 500, "2026-10-01"));
    await createPenalty(kassenwart, penalty(fritz.id, 400, "2026-10-03"));

    await createCashEntry(kassenwart, entry("AUSGABE", 1500, fritz.id));

    const list = await listPenalties(kassenwart, { userId: fritz.id });
    const byAmount = Object.fromEntries(list.map((p) => [p.amountCents, { paid: Boolean(p.paidAt), credit: p.creditCents }]));
    expect(byAmount).toEqual({
      500: { paid: true, credit: 500 },
      800: { paid: true, credit: 800 },
      400: { paid: false, credit: 200 },
    });
    expect(await getOpenPenaltySummary(fritz.id)).toEqual({ count: 1, totalCents: 200 });
    expect(await getCashSummary(fritz)).toMatchObject({ balanceCents: 0, advancedCents: 1500 });
    expect(await listCredits(fritz)).toEqual([]);

    // Den Rest zahlt Fritz bar – nur der fehlende Teil landet in der Kasse
    const open = list.find((p) => p.amountCents === 400)!;
    await setPenaltyPaid(kassenwart, open.id, true);
    expect((await getCashSummary(fritz)).balanceCents).toBe(200);
  });

  it("übriges Guthaben bleibt stehen und begleicht die nächste Strafe automatisch", async () => {
    const { kassenwart, fritz } = await setup();
    await createPenalty(kassenwart, penalty(fritz.id, 1000, "2026-10-01"));
    await createCashEntry(kassenwart, entry("AUSGABE", 1500, fritz.id));
    expect(await listCredits(fritz)).toMatchObject([{ userId: fritz.id, creditCents: 500 }]);

    await createPenalty(kassenwart, penalty(fritz.id, 300, "2026-10-08"));
    expect(await getOpenPenaltySummary(fritz.id)).toEqual({ count: 0, totalCents: 0 });
    expect(await listCredits(fritz)).toMatchObject([{ creditCents: 200 }]);
  });

  it("Löschen einer Auslage öffnet die damit verrechneten Strafen wieder", async () => {
    const { kassenwart, fritz } = await setup();
    await createPenalty(kassenwart, penalty(fritz.id, 500, "2026-10-01"));
    await createPenalty(kassenwart, penalty(fritz.id, 500, "2026-10-02"));
    const id = await createCashEntry(kassenwart, entry("AUSGABE", 1000, fritz.id));
    expect(await getOpenPenaltySummary(fritz.id)).toEqual({ count: 0, totalCents: 0 });

    await deleteCashEntry(kassenwart, id);
    expect(await getOpenPenaltySummary(fritz.id)).toEqual({ count: 2, totalCents: 1000 });
    expect(await getCashSummary(fritz)).toMatchObject({ balanceCents: 0, advancedCents: 0 });
  });

  it("Strafe auf „offen“ zurücksetzen gibt das verrechnete Guthaben frei", async () => {
    const { kassenwart, fritz } = await setup();
    const id = await createPenalty(kassenwart, penalty(fritz.id, 500, "2026-10-01"));
    await createCashEntry(kassenwart, entry("AUSGABE", 500, fritz.id));
    await setPenaltyPaid(kassenwart, id, false);
    expect(await listCredits(fritz)).toMatchObject([{ creditCents: 500 }]);
    expect(await getOpenPenaltySummary(fritz.id)).toEqual({ count: 1, totalCents: 500 });
  });

  it("alle sehen die Kasse, eintragen darf nur der Kassenwart", async () => {
    const { kassenwart, fritz } = await setup();
    await expect(getCashSummary(fritz)).resolves.toBeTruthy();
    await expect(createCashEntry(fritz, entry("EINNAHME", 100))).rejects.toMatchObject({ code: "FORBIDDEN" });
    const id = await createCashEntry(kassenwart, entry("EINNAHME", 100));
    await expect(deleteCashEntry(fritz, id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("prüft Eingaben", async () => {
    const { kassenwart, fritz } = await setup();
    await expect(createCashEntry(kassenwart, entry("EINNAHME", 100, fritz.id))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createCashEntry(kassenwart, entry("AUSGABE", 0))).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(createCashEntry(kassenwart, { ...entry("AUSGABE", 100), description: " " })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("Mitgliederseite: eigene Auslagen und freies Guthaben; fremde mit Kassen-Recht (hat jedes Mitglied)", async () => {
    const { kassenwart, fritz } = await setup();
    const anna = await createTestUser({ firstName: "Anna" });
    await createPenalty(kassenwart, penalty(fritz.id, 500, "2026-10-01"));
    await createCashEntry(kassenwart, entry("AUSGABE", 1500, fritz.id));

    const own = await getAdvancesOfUser(fritz, fritz.id);
    expect(own.entries).toMatchObject([{ amountCents: 1500, description: "Runde" }]);
    expect(own.creditCents).toBe(1000); // 15 € ausgelegt − 5 € Strafe verrechnet
    expect((await getAdvancesOfUser(kassenwart, fritz.id)).creditCents).toBe(1000);
    expect((await getAdvancesOfUser(anna, fritz.id)).entries).toHaveLength(1);
  });
});
