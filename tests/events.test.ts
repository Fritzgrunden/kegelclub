import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { events } from "@/server/db/schema";
import { toHm, toYmd } from "@/lib/dates";
import {
  createEvent,
  deleteEvent,
  getParticipationCounts,
  getParticipationOverview,
  setEventStatus,
  setParticipation,
  updateEvent,
} from "@/server/services/events";
import { createTestUser, truncateAll } from "./helpers";

beforeEach(truncateAll);

function future(days: number) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

describe("Wiederkehrende Kegelabende", () => {
  it("legt eine Serie mit Einzelterminen an", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const start = future(3);
    const res = await createEvent(admin, {
      kind: "KEGELABEND",
      title: "Kegelabend",
      date: start,
      time: "19:00",
      location: "Kegelbahn Zur Goldenen Kugel",
      recurrence: "ZWEIWOECHENTLICH",
      seriesEndDate: future(3 + 14 * 4),
    });
    expect(res.count).toBe(5);
    const rows = await getDb().select().from(events).where(eq(events.seriesId, res.seriesId!));
    expect(rows.every((r) => toHm(r.startsAt) === "19:00")).toBe(true);
  });

  it("einzelner Termin kann verschoben werden, ohne die Serie zu ändern", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const res = await createEvent(admin, {
      kind: "KEGELABEND", title: "Kegelabend", date: future(2), time: "19:00", recurrence: "WOECHENTLICH", seriesEndDate: future(30),
    });
    const all = await getDb().select().from(events).where(eq(events.seriesId, res.seriesId!));
    const second = all.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[1];

    await updateEvent(admin, second.id, { title: "Verschoben wegen Stadtfest", date: future(10), time: "20:00" }, "EINZELN");
    const moved = await getDb().query.events.findFirst({ where: eq(events.id, second.id) });
    expect(moved!.isDetached).toBe(true);
    expect(toHm(moved!.startsAt)).toBe("20:00");

    // Serienänderung überschreibt den abgekoppelten Termin nicht
    await updateEvent(admin, res.eventId, { title: "Kegelabend NEU", date: future(2), time: "18:30", seriesEndDate: future(30) }, "SERIE");
    const after = await getDb().select().from(events).where(eq(events.seriesId, res.seriesId!));
    const movedAfter = after.find((e) => e.id === second.id)!;
    expect(movedAfter.title).toBe("Verschoben wegen Stadtfest");
    expect(after.filter((e) => e.id !== second.id).every((e) => e.title === "Kegelabend NEU" && toHm(e.startsAt) === "18:30")).toBe(true);
  });

  it("Serie verlängern und verkürzen", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const start = future(1);
    const res = await createEvent(admin, {
      kind: "KEGELABEND", title: "K", date: start, time: "19:00", recurrence: "WOECHENTLICH", seriesEndDate: future(1 + 7 * 2),
    });
    expect(res.count).toBe(3);
    await updateEvent(admin, res.eventId, { title: "K", date: start, time: "19:00", seriesEndDate: future(1 + 7 * 5) }, "SERIE");
    expect((await getDb().select().from(events).where(eq(events.seriesId, res.seriesId!))).length).toBe(6);
    await updateEvent(admin, res.eventId, { title: "K", date: start, time: "19:00", seriesEndDate: future(1 + 7) }, "SERIE");
    expect((await getDb().select().from(events).where(eq(events.seriesId, res.seriesId!))).length).toBe(2);
  });

  it("„diesen und alle folgenden“ löschen", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const res = await createEvent(admin, {
      kind: "KEGELABEND", title: "K", date: future(1), time: "19:00", recurrence: "WOECHENTLICH", seriesEndDate: future(1 + 7 * 4),
    });
    const all = (await getDb().select().from(events).where(eq(events.seriesId, res.seriesId!))).sort(
      (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
    );
    await deleteEvent(admin, all[2].id, "FOLGENDE");
    const left = await getDb().select().from(events).where(eq(events.seriesId, res.seriesId!));
    expect(left.map((e) => toYmd(e.startsAt)).sort()).toEqual([all[0], all[1]].map((e) => toYmd(e.startsAt)));
  });
});

describe("An- und Abmeldung", () => {
  it("Zusage, Absage und Änderung der eigenen Rückmeldung", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"], firstName: "Admin" });
    const max = await createTestUser({ firstName: "Max" });
    const peter = await createTestUser({ firstName: "Peter" });
    await createTestUser({ firstName: "Klaus" });
    const { eventId } = await createEvent(admin, { kind: "KEGELABEND", title: "K", date: future(5), time: "19:00" });

    await setParticipation(max, eventId, "ZUGESAGT");
    await setParticipation(peter, eventId, "ABGESAGT");
    let o = await getParticipationOverview(eventId);
    expect(o.zugesagt.map((p) => p.firstName)).toEqual(["Max"]);
    expect(o.abgesagt.map((p) => p.firstName)).toEqual(["Peter"]);
    expect(o.offen.map((p) => p.firstName).sort()).toEqual(["Admin", "Klaus"]);

    await setParticipation(peter, eventId, "ZUGESAGT");
    o = await getParticipationOverview(eventId);
    expect(o.zugesagt.length).toBe(2);
    expect(o.abgesagt.length).toBe(0);

    const counts = (await getParticipationCounts([eventId])).get(eventId);
    expect(counts).toEqual({ zugesagt: 2, abgesagt: 0, offen: 2 });
  });

  it("Abmeldung ist möglich", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const m = await createTestUser();
    const { eventId } = await createEvent(admin, { kind: "KEGELABEND", title: "K", date: future(5), time: "19:00" });
    await setParticipation(m, eventId, "ZUGESAGT");
    await setParticipation(m, eventId, "ABGESAGT");
    const o = await getParticipationOverview(eventId);
    expect(o.abgesagt.map((p) => p.userId)).toContain(m.id);
  });

  it("Event-Anmeldung (Kegeltour) mit mehrtägigem Zeitraum", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const m = await createTestUser();
    const { eventId } = await createEvent(admin, {
      kind: "EVENT", eventType: "KEGELTOUR", title: "Kegeltour Sauerland", date: future(20), time: "08:00", endDate: future(22), endTime: "18:00",
    });
    await setParticipation(m, eventId, "ZUGESAGT");
    const o = await getParticipationOverview(eventId);
    expect(o.zugesagt.map((p) => p.userId)).toEqual([m.id]);
  });

  it("keine Anmeldung zu abgesagten Terminen", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const m = await createTestUser();
    const { eventId } = await createEvent(admin, { kind: "EVENT", title: "Sommerfest", date: future(5), time: "15:00" });
    await setEventStatus(admin, eventId, "ABGESAGT");
    await expect(setParticipation(m, eventId, "ZUGESAGT")).rejects.toThrow(/abgesagt/);
  });

  it("Ende vor Beginn wird abgelehnt", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    await expect(
      createEvent(admin, { kind: "EVENT", title: "X", date: future(5), time: "15:00", endTime: "14:00" }),
    ).rejects.toThrow(/Ende/);
  });
});
