import { beforeEach, describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/permissions";
import { deleteRole, listRoles, loadPermissions, saveRole } from "@/server/services/roles";
import { getMember, setUserRoles } from "@/server/services/users";
import { createEvent } from "@/server/services/events";
import { createSession, getUserBySessionToken } from "@/server/services/auth";
import { createTestUser, truncateAll } from "./helpers";

beforeEach(truncateAll);

const eventInput = { kind: "KEGELABEND", title: "Kegelabend", date: "2026-11-06", time: "19:00", recurrence: "KEINE" };

describe("Eigene Rollen", () => {
  it("Admin legt eine Rolle an – Mitglieder mit dieser Rolle erhalten genau deren Rechte", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const member = await createTestUser();
    const key = await saveRole(admin, null, { name: "Terminplaner", permissions: ["events:manage", "gibt-es-nicht"] });

    await expect(createEvent(member, eventInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await setUserRoles(admin, member.id, [key]);
    const planner = { id: member.id, permissions: await loadPermissions(member.id) };
    expect(hasPermission(planner, "events:manage")).toBe(true);
    expect(hasPermission(planner, "events:rsvp")).toBe(true); // Basisrechte bleiben
    expect(hasPermission(planner, "members:manage")).toBe(false);
    await expect(createEvent(planner, eventInput)).resolves.toBeTruthy();

    const role = (await listRoles()).find((r) => r.key === key)!;
    expect(role).toMatchObject({ name: "Terminplaner", permissions: ["events:manage"], memberCount: 1, isSystem: false });
    expect((await getMember(member.id))!.roles.map((r) => r.name)).toEqual(["Mitglied", "Terminplaner"]);
  });

  it("Sitzung enthält die Rechte aus der Datenbank", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const member = await createTestUser();
    const key = await saveRole(admin, null, { name: "Vorstand", permissions: ["members:manage"] });
    await setUserRoles(admin, member.id, [key]);
    const { token } = await createSession(member.id);
    const session = await getUserBySessionToken(token);
    expect(session?.roles.sort()).toEqual([key, "MITGLIED"].sort());
    expect(session?.permissions).toContain("members:manage");
    expect(session?.permissions).toContain("events:view");
  });

  it("Rechte einer Rolle ändern wirkt sofort für alle Inhaber", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const kassenwart = await createTestUser({ roles: ["KASSENWART"] });
    expect(await loadPermissions(kassenwart.id)).toContain("dues:manage");
    await saveRole(admin, "KASSENWART", { name: "Kassierer", permissions: ["penalties:manage"] });
    const perms = await loadPermissions(kassenwart.id);
    expect(perms).toContain("penalties:manage");
    expect(perms).not.toContain("dues:manage");
  });

  it("Admin-Rolle behält immer die Verwaltungsrechte", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    await saveRole(admin, "ADMIN", { name: "Admin", permissions: [] });
    const perms = await loadPermissions(admin.id);
    expect(perms).toEqual(expect.arrayContaining(["members:manage", "roles:assign", "roles:manage"]));
    expect(perms).not.toContain("events:manage");
  });

  it("Systemrollen können nicht gelöscht werden, eigene schon – Zuweisungen verschwinden mit", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const member = await createTestUser();
    await expect(deleteRole(admin, "ADMIN")).rejects.toThrow(/fest eingebaut/);
    await expect(deleteRole(admin, "MITGLIED")).rejects.toThrow(/fest eingebaut/);
    const key = await saveRole(admin, null, { name: "Sportwart", permissions: ["results:manage"] });
    await setUserRoles(admin, member.id, [key]);
    await deleteRole(admin, key);
    expect(await loadPermissions(member.id)).not.toContain("results:manage");
    expect((await getMember(member.id))!.roles.map((r) => r.key)).toEqual(["MITGLIED"]);
  });

  it("doppelte Namen und leere Namen werden abgelehnt", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    await expect(saveRole(admin, null, { name: "kassenwart", permissions: [] })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(saveRole(admin, null, { name: "  ", permissions: [] })).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("nur wer Rollen verwalten darf, kann Rollen anlegen, ändern oder löschen", async () => {
    const member = await createTestUser();
    const kassenwart = await createTestUser({ roles: ["KASSENWART"] });
    await expect(saveRole(member, null, { name: "Hacker", permissions: ["members:manage"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(saveRole(kassenwart, "KASSENWART", { name: "Kassenwart", permissions: ["members:manage"] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(deleteRole(member, "KASSENWART")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("unbekannte Rollenschlüssel werden beim Zuweisen ignoriert", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const member = await createTestUser();
    await setUserRoles(admin, member.id, ["GIBT_ES_NICHT", "KASSENWART"]);
    expect((await getMember(member.id))!.roles.map((r) => r.key)).toEqual(["MITGLIED", "KASSENWART"]);
  });
});
