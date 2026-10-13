import { beforeEach, describe, expect, it } from "vitest";
import {
  createDuesForMonth,
  deleteDues,
  getDuesMonth,
  getOpenDuesByMember,
  getOpenDuesSummary,
  listOwnDues,
  markAllDuesPaidForMember,
  setDuesDefault,
  setDuesPaid,
  setMemberDuesAmounts,
  shiftMonth,
} from "@/server/services/dues";
import { createTestUser, truncateAll } from "./helpers";

beforeEach(truncateAll);

async function setup() {
  const kassenwart = await createTestUser({ roles: ["KASSENWART"], firstName: "Kasse" });
  const admin = await createTestUser({ roles: ["ADMIN"], firstName: "Admin" });
  const peter = await createTestUser({ firstName: "Peter" });
  const passiv = await createTestUser({ firstName: "Paul", status: "PASSIV" });
  const gesperrt = await createTestUser({ firstName: "Gerd", status: "INAKTIV" });
  return { kassenwart, admin, peter, passiv, gesperrt };
}

describe("Monatsbeiträge", () => {
  it("ohne festgelegten Beitrag kann kein Monat angelegt werden", async () => {
    const { kassenwart } = await setup();
    await expect(createDuesForMonth(kassenwart, "2026-10")).rejects.toThrow(/Höhe des Monatsbeitrags/);
  });

  it("Monat anlegen: aktive und passive Mitglieder, mit Standard- oder eigenem Betrag, beitragsfreie übersprungen", async () => {
    const { kassenwart, admin, peter, passiv, gesperrt } = await setup();
    await setDuesDefault(kassenwart, 500);
    await setMemberDuesAmounts(kassenwart, { [passiv.id]: 250, [admin.id]: 0 });

    expect(await createDuesForMonth(kassenwart, "2026-10")).toBe(3); // Kasse, Peter, Paul
    const rows = await getDuesMonth(kassenwart, "2026-10");
    const byId = new Map(rows.map((r) => [r.userId, r]));
    expect(byId.get(peter.id)?.entry?.amountCents).toBe(500);
    expect(byId.get(passiv.id)?.entry?.amountCents).toBe(250);
    expect(byId.get(admin.id)?.entry).toBeNull();
    expect(byId.has(gesperrt.id)).toBe(false);

    // Erneut anlegen erzeugt keine Doppel – und spätere Beitragsänderungen ändern bestehende Monate nicht.
    await setDuesDefault(kassenwart, 700);
    expect(await createDuesForMonth(kassenwart, "2026-10")).toBe(0);
    expect((await getDuesMonth(kassenwart, "2026-10")).find((r) => r.userId === peter.id)?.entry?.amountCents).toBe(500);
    await createDuesForMonth(kassenwart, "2026-11");
    expect((await getDuesMonth(kassenwart, "2026-11")).find((r) => r.userId === peter.id)?.entry?.amountCents).toBe(700);
  });

  it("bezahlen, erlassen und „Alles bezahlt“", async () => {
    const { kassenwart, peter } = await setup();
    await setDuesDefault(kassenwart, 500);
    await createDuesForMonth(kassenwart, "2026-09");
    await createDuesForMonth(kassenwart, "2026-10");
    await createDuesForMonth(kassenwart, "2026-11");
    expect(await getOpenDuesSummary(peter.id)).toEqual({ count: 3, totalCents: 1500 });

    const own = await listOwnDues(peter);
    expect(own.map((d) => d.month)).toEqual(["2026-11", "2026-10", "2026-09"]);
    await setDuesPaid(kassenwart, own[2].id, true);
    await deleteDues(kassenwart, own[1].id);
    expect(await getOpenDuesSummary(peter.id)).toEqual({ count: 1, totalCents: 500 });
    expect((await getOpenDuesByMember(kassenwart)).find((t) => t.userId === peter.id)?.total).toBe(500);

    expect(await markAllDuesPaidForMember(kassenwart, peter.id)).toBe(1);
    expect(await getOpenDuesSummary(peter.id)).toEqual({ count: 0, totalCents: 0 });
  });

  it("nur der Kassenwart verwaltet Beiträge; Mitglieder sehen nur die eigenen", async () => {
    const { kassenwart, admin, peter } = await setup();
    await expect(setDuesDefault(admin, 500)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(setDuesDefault(peter, 500)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setDuesDefault(kassenwart, 500);
    await expect(createDuesForMonth(admin, "2026-10")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await createDuesForMonth(kassenwart, "2026-10");

    const [own] = await listOwnDues(peter);
    await expect(setDuesPaid(peter, own.id, true)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(markAllDuesPaidForMember(admin, peter.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getDuesMonth(peter, "2026-10")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(getDuesMonth(admin, "2026-10")).resolves.toHaveLength(4); // Admin darf lesen
    expect((await listOwnDues(kassenwart)).every((d) => d.id !== own.id)).toBe(true);
  });

  it("ungültige Monate und Beträge werden abgelehnt", async () => {
    const { kassenwart } = await setup();
    await expect(createDuesForMonth(kassenwart, "2026-13")).rejects.toThrow(/Ungültiger Monat/);
    await expect(setDuesDefault(kassenwart, -1)).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("Monate weiterblättern über den Jahreswechsel", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});
