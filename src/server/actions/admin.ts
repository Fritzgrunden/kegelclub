"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { ROLES } from "@/lib/permissions";
import type { Role, UserStatus } from "@/server/db/schema";
import { rejectRegistration, setUserRoles, setUserStatus } from "@/server/services/users";
import { updateSettings } from "@/server/services/settings";
import { requireActor } from "@/server/auth/session";
import { runAction, str } from "./utils";

const STATUSES: UserStatus[] = ["AUSSTEHEND", "AKTIV", "PASSIV", "INAKTIV"];

export async function setMemberStatusAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const status = str(fd, "status") as UserStatus;
    if (!STATUSES.includes(status)) throw new Error("Ungültiger Status");
    await setUserStatus(actor, str(fd, "id"), status);
    revalidatePath("/", "layout");
  });
}

export async function setMemberRolesAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const roles = fd.getAll("roles").filter((r): r is Role => typeof r === "string" && (ROLES as string[]).includes(r));
    await setUserRoles(actor, str(fd, "id"), roles);
    revalidatePath("/", "layout");
    return "Rollen gespeichert.";
  });
}

export async function rejectRegistrationAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await rejectRegistration(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
}

export async function updateSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await updateSettings(actor, {
      clubName: str(fd, "clubName"),
      defaultLocation: str(fd, "defaultLocation"),
      defaultTime: str(fd, "defaultTime"),
    });
    revalidatePath("/", "layout");
    return "Einstellungen gespeichert.";
  });
}
