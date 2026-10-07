"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { authenticate, deleteSession, registerUser, requestPasswordReset, resetPassword } from "@/server/services/auth";
import { notifyNewRegistration } from "@/server/services/notifications";
import { clearSessionCookie, getClientKey, getSessionToken, setSessionCookie } from "@/server/auth/session";
import { optStr, runAction, str } from "./utils";

function safeRedirectTarget(next: string) {
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function loginAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let ok = false;
  const result = await runAction(async () => {
    const { token, expiresAt } = await authenticate(str(fd, "email"), str(fd, "password"), await getClientKey());
    await setSessionCookie(token, expiresAt);
    ok = true;
  });
  if (ok) redirect(safeRedirectTarget(str(fd, "next")));
  return result;
}

export async function registerAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    if (str(fd, "password") !== str(fd, "passwordConfirm")) {
      throw new AppError("Die Passwörter stimmen nicht überein.", "VALIDATION", { passwordConfirm: "Stimmt nicht mit dem Passwort überein." });
    }
    const user = await registerUser(
      {
        email: str(fd, "email"),
        password: str(fd, "password"),
        firstName: str(fd, "firstName"),
        lastName: str(fd, "lastName"),
        nickname: optStr(fd, "nickname"),
        birthday: optStr(fd, "birthday"),
      },
      await getClientKey(),
    );
    after(() => notifyNewRegistration(user.id));
    return "Registrierung erfolgreich! Sobald ein Admin dein Konto freigeschaltet hat, kannst du dich anmelden.";
  });
}

export async function forgotPasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requestPasswordReset(str(fd, "email"), await getClientKey());
    return "Falls ein Konto mit dieser E-Mail existiert, haben wir dir einen Link zum Zurücksetzen geschickt.";
  });
}

export async function resetPasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let ok = false;
  const result = await runAction(async () => {
    if (str(fd, "password") !== str(fd, "passwordConfirm")) {
      throw new AppError("Die Passwörter stimmen nicht überein.", "VALIDATION", { passwordConfirm: "Stimmt nicht mit dem Passwort überein." });
    }
    await resetPassword(str(fd, "token"), str(fd, "password"));
    ok = true;
  });
  if (ok) redirect("/login?zurueckgesetzt=1");
  return result;
}

export async function logoutAction() {
  const token = await getSessionToken();
  if (token) await deleteSession(token);
  await clearSessionCookie();
  redirect("/login");
}
