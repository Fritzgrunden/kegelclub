"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { parseEuroToCents } from "@/lib/format";
import {
  createPenalty,
  deletePenalty,
  deletePenaltyType,
  savePenaltyType,
  setPenaltyPaid,
  updatePenalty,
} from "@/server/services/penalties";
import { requireActor } from "@/server/auth/session";
import { optStr, runAction, str } from "./utils";

function euroField(fd: FormData, key: string, required: boolean): number | null {
  const raw = optStr(fd, key);
  if (!raw) {
    if (required) throw new AppError("Bitte einen Betrag angeben.", "VALIDATION", { [key]: "Bitte einen Betrag angeben." });
    return null;
  }
  const cents = parseEuroToCents(raw);
  if (cents === null) throw new AppError("Ungültiger Betrag.", "VALIDATION", { [key]: "Bitte einen Betrag wie 2,50 eingeben." });
  return cents;
}

export async function savePenaltyAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const id = optStr(fd, "id");
  const again = str(fd, "intent") === "weitere";
  const result = await runAction(async () => {
    const actor = await requireActor();
    const raw = {
      userId: str(fd, "userId"),
      penaltyTypeId: optStr(fd, "penaltyTypeId") ?? null,
      customLabel: optStr(fd, "customLabel"),
      amountCents: euroField(fd, "amount", false),
      date: str(fd, "date"),
      eventId: optStr(fd, "eventId") ?? null,
      comment: optStr(fd, "comment"),
    };
    if (id) await updatePenalty(actor, id, raw);
    else await createPenalty(actor, raw);
    revalidatePath("/", "layout");
    return "Strafe eingetragen.";
  });
  if (result.ok && !again) redirect("/strafen?gespeichert=1");
  return result;
}

export async function deletePenaltyAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await deletePenalty(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
}

export async function togglePenaltyPaidAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await setPenaltyPaid(actor, str(fd, "id"), str(fd, "paid") === "1");
    revalidatePath("/", "layout");
  });
}

export async function savePenaltyTypeAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await savePenaltyType(actor, optStr(fd, "id") ?? null, {
      name: str(fd, "name"),
      description: optStr(fd, "description"),
      amountCents: euroField(fd, "amount", true),
      active: fd.get("active") === "on",
    });
    revalidatePath("/", "layout");
    return "Strafart gespeichert.";
  });
}

export async function deletePenaltyTypeAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await deletePenaltyType(actor, str(fd, "id"));
    revalidatePath("/", "layout");
  });
}
