"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { changePassword } from "@/server/services/auth";
import { removeAvatar, setAvatar, updateEmail, updateProfile } from "@/server/services/users";
import { requireActor } from "@/server/auth/session";
import { file, optStr, runAction, str } from "./utils";

function profileFromForm(fd: FormData) {
  return {
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    nickname: optStr(fd, "nickname"),
    birthday: optStr(fd, "birthday"),
    phone: optStr(fd, "phone"),
  };
}

/** Eigenes Profil oder – mit Verwaltungsrecht – das eines anderen Mitglieds (Feld userId). */
export async function updateProfileAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const userId = optStr(fd, "userId") ?? actor.id;
    await updateProfile(actor, userId, profileFromForm(fd));
    if (userId !== actor.id && optStr(fd, "email")) await updateEmail(actor, userId, str(fd, "email"));
    revalidatePath("/", "layout");
    return "Profil gespeichert.";
  });
}

export async function changePasswordAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    if (str(fd, "newPassword") !== str(fd, "confirmPassword")) {
      throw new AppError("Die Passwörter stimmen nicht überein.", "VALIDATION", { confirmPassword: "Stimmt nicht mit dem neuen Passwort überein." });
    }
    await changePassword(actor.id, str(fd, "currentPassword"), str(fd, "newPassword"), actor.sessionId);
    return "Passwort geändert. Andere Geräte wurden abgemeldet.";
  });
}

export async function uploadAvatarAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const image = file(fd, "avatar");
    if (!image) throw new AppError("Bitte ein Bild auswählen.");
    await setAvatar(actor, optStr(fd, "userId") ?? actor.id, image);
    revalidatePath("/", "layout");
    return "Profilbild gespeichert.";
  });
}

export async function removeAvatarAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await removeAvatar(actor, optStr(fd, "userId") ?? actor.id);
    revalidatePath("/", "layout");
  });
}
