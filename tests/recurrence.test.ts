import { describe, expect, it } from "vitest";
import { generateOccurrenceDates, monthWeekLabel, monthWeekOf, recurrenceLabel } from "@/lib/recurrence";
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

  it("jeden 2. Freitag im Monat – erster Termin ist der erste passende ab dem Startdatum, auch über den Jahreswechsel", () => {
    // 01.11.2026 ist ein Sonntag; der 2. Freitag im November ist der 13.
    expect(
      generateOccurrenceDates({ startDate: "2026-11-01", recurrence: "MONATLICH_WOCHENTAG", monthWeek: 2, weekday: 5, endDate: "2027-02-28" }),
    ).toEqual(["2026-11-13", "2026-12-11", "2027-01-08", "2027-02-12"]);
    expect(recurrenceLabel({ recurrence: "MONATLICH_WOCHENTAG", startDate: "2026-11-01", monthWeek: 2, weekday: 5 })).toBe("Jeden Monat am 2. Freitag");
  });

  it("liegt der Start nach dem 2. Freitag, beginnt die Serie im Folgemonat", () => {
    expect(
      generateOccurrenceDates({ startDate: "2026-11-14", recurrence: "MONATLICH_WOCHENTAG", monthWeek: 2, weekday: 5, endDate: "2026-12-31" }),
    ).toEqual(["2026-12-11"]);
  });

  it("jeden letzten Freitag – auch in Monaten mit nur 4 Freitagen", () => {
    expect(
      generateOccurrenceDates({ startDate: "2027-01-01", recurrence: "MONATLICH_WOCHENTAG", monthWeek: 5, weekday: 5, endDate: "2027-03-31" }),
    ).toEqual(["2027-01-29", "2027-02-26", "2027-03-26"]);
    expect(monthWeekLabel(5, 5)).toBe("letzten Freitag");
  });

  it("schlägt Wochentag und „der wievielte“ aus einem Datum vor", () => {
    expect(monthWeekOf("2026-11-21")).toEqual({ weekday: 6, monthWeek: 3 }); // 3. Samstag
    expect(monthWeekOf("2026-10-31")).toEqual({ weekday: 6, monthWeek: 5 }); // letzter Samstag
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
