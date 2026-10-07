import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { passwordResetTokens, sessions, users } from "@/server/db/schema";
import {
  authenticate,
  changePassword,
  getUserBySessionToken,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "@/server/services/auth";
import { hashToken } from "@/server/auth/crypto";
import { setUserStatus } from "@/server/services/users";
import { createTestUser, truncateAll } from "./helpers";

const validRegistration = {
  email: "Neu@Demo.Test",
  password: "SicheresPasswort1",
  firstName: "Neu",
  lastName: "Mitglied",
  nickname: "Neuling",
  birthday: "1990-05-17",
};

beforeEach(truncateAll);

describe("Registrierung", () => {
  it("legt ein ausstehendes Konto mit gehashtem Passwort an", async () => {
    const user = await registerUser(validRegistration);
    expect(user.status).toBe("AUSSTEHEND");
    const row = await getDb().query.users.findFirst({ where: eq(users.id, user.id) });
    expect(row!.email).toBe("neu@demo.test");
    expect(row!.passwordHash).not.toContain("SicheresPasswort1");
    expect(row!.passwordHash.startsWith("$2")).toBe(true);
  });

  it("lehnt doppelte E-Mail-Adressen ab", async () => {
    await registerUser(validRegistration);
    await expect(registerUser(validRegistration)).rejects.toThrow(/bereits/);
  });

  it("validiert Eingaben (zu kurzes Passwort)", async () => {
    await expect(registerUser({ ...validRegistration, password: "kurz" })).rejects.toMatchObject({
      fieldErrors: { password: expect.stringContaining("10 Zeichen") },
    });
  });
});

describe("Login", () => {
  it("erlaubt Login erst nach Freischaltung", async () => {
    const user = await registerUser(validRegistration);
    await expect(authenticate("neu@demo.test", "SicheresPasswort1")).rejects.toThrow(/Freischaltung/);

    const admin = await createTestUser({ roles: ["ADMIN"] });
    await setUserStatus(admin, user.id, "AKTIV");

    const { token } = await authenticate("NEU@demo.test", "SicheresPasswort1");
    const sessionUser = await getUserBySessionToken(token);
    expect(sessionUser?.id).toBe(user.id);
    expect(sessionUser?.roles).toEqual(["MITGLIED"]);
  });

  it("speichert nur den Hash des Session-Tokens", async () => {
    const u = await createTestUser();
    const { token } = await authenticate(u.email, "Testpasswort123");
    const stored = await getDb().select().from(sessions);
    expect(stored[0].id).toBe(hashToken(token));
    expect(stored[0].id).not.toBe(token);
  });

  it("lehnt falsches Passwort und unbekannte E-Mail gleich ab", async () => {
    const u = await createTestUser();
    await expect(authenticate(u.email, "falschfalsch")).rejects.toThrow("E-Mail oder Passwort ist falsch.");
    await expect(authenticate("gibtsnicht@demo.test", "falschfalsch")).rejects.toThrow("E-Mail oder Passwort ist falsch.");
  });

  it("begrenzt Fehlversuche (Rate Limit)", async () => {
    const u = await createTestUser();
    for (let i = 0; i < 8; i++) await expect(authenticate(u.email, "falsch", "1.2.3.4")).rejects.toThrow(/falsch/);
    await expect(authenticate(u.email, "Testpasswort123", "1.2.3.4")).rejects.toThrow(/Zu viele/);
  });

  it("gesperrte Konten verlieren den Zugriff", async () => {
    const admin = await createTestUser({ roles: ["ADMIN"] });
    const u = await createTestUser();
    const { token } = await authenticate(u.email, "Testpasswort123");
    await setUserStatus(admin, u.id, "INAKTIV");
    expect(await getUserBySessionToken(token)).toBeNull();
  });
});

describe("Passwort zurücksetzen", () => {
  it("setzt das Passwort mit gültigem Token zurück und beendet alle Sitzungen", async () => {
    const u = await createTestUser();
    const { token: sessionToken } = await authenticate(u.email, "Testpasswort123");
    const token = await requestPasswordReset(u.email);
    expect(token).toBeTruthy();

    const stored = await getDb().select().from(passwordResetTokens);
    expect(stored[0].id).toBe(hashToken(token!));

    await resetPassword(token!, "GanzNeuesPasswort9");
    expect(await getUserBySessionToken(sessionToken)).toBeNull();
    await expect(authenticate(u.email, "Testpasswort123")).rejects.toThrow();
    await expect(authenticate(u.email, "GanzNeuesPasswort9")).resolves.toHaveProperty("token");
  });

  it("Token ist nur einmal verwendbar", async () => {
    const u = await createTestUser();
    const token = await requestPasswordReset(u.email);
    await resetPassword(token!, "GanzNeuesPasswort9");
    await expect(resetPassword(token!, "NochEinPasswort99")).rejects.toThrow(/ungültig oder abgelaufen/);
  });

  it("abgelaufene Tokens werden abgelehnt", async () => {
    const u = await createTestUser();
    const token = await requestPasswordReset(u.email);
    await getDb().update(passwordResetTokens).set({ expiresAt: new Date(Date.now() - 1000) });
    await expect(resetPassword(token!, "GanzNeuesPasswort9")).rejects.toThrow(/abgelaufen/);
  });

  it("verrät nicht, ob eine E-Mail existiert", async () => {
    await expect(requestPasswordReset("unbekannt@demo.test")).resolves.toBeNull();
  });
});

describe("Passwort ändern", () => {
  it("erfordert das aktuelle Passwort", async () => {
    const u = await createTestUser();
    await expect(changePassword(u.id, "falsch", "NeuesPasswort123")).rejects.toThrow(/aktuelle Passwort/);
    await changePassword(u.id, "Testpasswort123", "NeuesPasswort123");
    await expect(authenticate(u.email, "NeuesPasswort123")).resolves.toHaveProperty("token");
  });
});
