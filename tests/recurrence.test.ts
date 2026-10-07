import { describe, expect, it } from "vitest";
import { generateOccurrenceDates } from "@/lib/recurrence";
import { formatDateTime, toHm, zonedToUtc } from "@/lib/dates";

describe("Wiederkehrende Termine (Regel)", () => {
  it("erzeugt alle 2 Wochen bis zum Enddatum", () => {
    expect(
      generateOccurrenceDates({ startDate: "2026-10-02", recurrence: "ZWEIWOECHENTLICH", endDate: "2026-11-15" }),
    ).toEqual(["2026-10-02", "2026-10-16", "2026-10-30", "2026-11-13"]);
  });

  it("monatlich am 31. nutzt den Monatsletzten", () => {
    expect(generateOccurrenceDates({ startDate: "2026-01-31", recurrence: "MONATLICH", endDate: "2026-04-30" })).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("individuelles Intervall", () => {
    expect(
      generateOccurrenceDates({ startDate: "2026-01-01", recurrence: "INDIVIDUELL", intervalDays: 10, endDate: "2026-01-25" }),
    ).toEqual(["2026-01-01", "2026-01-11", "2026-01-21"]);
  });

  it("ohne Enddatum begrenzt auf ein Jahr", () => {
    const dates = generateOccurrenceDates({ startDate: "2026-01-02", recurrence: "WOECHENTLICH" });
    expect(dates.length).toBe(53);
    expect(dates.at(-1)! <= "2027-01-02").toBe(true);
  });

  it("keine Wiederholung = genau ein Termin", () => {
    expect(generateOccurrenceDates({ startDate: "2026-05-05", recurrence: "KEINE" })).toEqual(["2026-05-05"]);
  });

  it("behält 19:00 Uhr Ortszeit über die Zeitumstellung hinweg", () => {
    const summer = zonedToUtc("2026-10-23", "19:00");
    const winter = zonedToUtc("2026-10-30", "19:00");
    expect(summer.toISOString()).toBe("2026-10-23T17:00:00.000Z");
    expect(winter.toISOString()).toBe("2026-10-30T18:00:00.000Z");
    expect(toHm(summer)).toBe("19:00");
    expect(toHm(winter)).toBe("19:00");
    expect(formatDateTime(winter)).toBe("30.10.2026, 19:00 Uhr");
  });
});
