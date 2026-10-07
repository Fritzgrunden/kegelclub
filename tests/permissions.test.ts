import { beforeEach, describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";
import { createEvent, deleteEvent } from "@/server/services/events";
import { saveGame } from "@/server/services/games";
import { setUserRoles, setUserStatus, updateProfile } from "@/server/services/users";
import { updateSettings } from "@/server/services/settings";
import { createTestUser, truncateAll } from "./helpers";

beforeEach(truncateAll);

const eventInput = { kind: "KEGELABEND", title: "Kegelabend", date: "2026-11-06", time: "19:00", recurrence: "KEINE" };

describe("Rollen-Rechte-Matrix", () => {
  it("Mitglied hat nur Basisrechte", () => {
    const m = { roles: ["MITGLIED" as const] };
    expect(hasPermission(m, "events:rsvp")).toBe(true);
    expect(hasPermission(m, "events:manage")).toBe(false);
    expect(hasPermission(m, "penalties:manage")).toBe(false);
    expect(hasPermission(m, "members:manage")).toBe(false);
  });

  it("Kassenwart verwaltet Strafen, aber keine Termine", () => {
    const k = { roles: ["MITGLIED" as const, "KASSENWART" as const] };
    expect(hasPermission(k, "penalties:manage")).toBe(true);
    expect(hasPermission(k, "penalty-catalog:manage")).toBe(true);
    expect(hasPermission(k, "events:manage")).toBe(false);
  });

  it("Admin verwaltet alles außer Strafvergabe", () => {
    const a = { roles: ["ADMIN" as const] };
    expect(hasPermission(a, "events:manage")).toBe(true);
    expect(hasPermission(a, "roles:assign")).toBe(true);
    expect(hasPermission(a, "penalties:manage")).toBe(false);
  });
});

describe("Normale Mitglieder können keine Admin-Funktionen ausführen", () => {
  it("kein Termin anlegen/löschen", async () => {
    const member = await createTestUser();
    const admin = await createTestUser({ roles: ["ADMIN"] });
    await expect(createEvent(member, eventInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const { eventId } = await createEvent(admin, eventInput);
    await expect(deleteEvent(member, eventId)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keine Rollen vergeben – auch nicht sich selbst", async () => {
    const member = await createTestUser();
    await expect(setUserRoles(member, member.id, ["ADMIN"])).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keine fremden Profile bearbeiten, eigenes schon", async () => {
    const member = await createTestUser();
    const other = await createTestUser();
    await expect(updateProfile(member, other.id, { firstName: "X", lastName: "Y" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateProfile(member, member.id, { firstName: "Neu", lastName: "Name" })).resolves.toBeUndefined();
  });

  it("keine Mitglieder sperren, keine Spiele/Einstellungen ändern", async () => {
    const member = await createTestUser();
    const other = await createTestUser();
    await expect(setUserStatus(member, other.id, "INAKTIV")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(updateSettings(member, { clubName: "Hack", defaultLocation: "", defaultTime: "19:00" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveGame(member, null, {})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Admin-Schutzmechanismen", () => {
  it("der letzte Admin kann seine Rolle nicht verlieren", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    await expect(setUserRoles(admin, admin.id, [])).rejects.toThrow(/mindestens ein Admin/);
  });

  it("Admin kann Rollen vergeben", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const member = await createTestUser();
    await setUserRoles(admin, member.id, ["KASSENWART"]);
  });
});
