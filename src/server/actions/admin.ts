"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import type { UserStatus } from "@/server/db/schema";
import { rejectRegistration, setUserRoles, setUserStatus } from "@/server/services/users";
import { deleteRole, saveRole } from "@/server/services/roles";
import { updateSettings } from "@/server/services/settings";
import { createAdminResetLink } from "@/server/services/auth";
import { getRequestOrigin, requireActor } from "@/server/auth/session";
import { optStr, runAction, str } from "./utils";

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
    const roles = fd.getAll("roles").filter((r): r is string => typeof r === "string");
    await setUserRoles(actor, str(fd, "id"), roles);
    revalidatePath("/", "layout");
    return "Rollen gespeichert.";
  });
}

export async function createResetLinkAction(fd: FormData): Promise<ActionResult & { url?: string }> {
  let url: string | undefined;
  const result = await runAction(async () => {
    url = await createAdminResetLink(await requireActor(), str(fd, "id"), await getRequestOrigin());
  });
  return { ...result, url };
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

export async function saveRoleAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await saveRole(actor, optStr(fd, "key") ?? null, {
      name: str(fd, "name"),
      description: optStr(fd, "description"),
      permissions: fd.getAll("permissions").filter((p): p is string => typeof p === "string"),
    });
    revalidatePath("/", "layout");
    return "Rolle gespeichert.";
  });
}

export async function deleteRoleAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await deleteRole(actor, str(fd, "key"));
    revalidatePath("/", "layout");
  });
}
