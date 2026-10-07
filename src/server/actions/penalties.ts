"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { parseEuroToCents } from "@/lib/format";
import {
  createPenalty,
  createQuickPenalty,
  deletePenalty,
  deletePenaltyType,
  markAllPaidForMember,
  savePenaltyType,
  setPenaltyPaid,
  updatePenalty,
} from "@/server/services/penalties";
import { notifyPenaltyCreated } from "@/server/services/notifications";
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
    else {
      const penaltyId = await createPenalty(actor, raw);
      after(() => notifyPenaltyCreated(penaltyId));
    }
    revalidatePath("/", "layout");
    return "Strafe eingetragen.";
  });
  if (result.ok && !again) redirect("/strafen?gespeichert=1");
  return result;
}

/** So lange kann eine Schnellerfassung rückgängig gemacht werden, bevor das Mitglied benachrichtigt wird. */
const UNDO_WINDOW_MS = 10_000;

export async function quickPenaltyAction(fd: FormData): Promise<ActionResult & { penaltyId?: string }> {
  let penaltyId: string | undefined;
  const result = await runAction(async () => {
    const actor = await requireActor();
    const id = await createQuickPenalty(actor, str(fd, "userId"), str(fd, "penaltyTypeId"));
    penaltyId = id;
    // Erst nach Ablauf der Rückgängig-Frist benachrichtigen; wurde die Strafe gelöscht, geht nichts raus.
    after(async () => {
      await new Promise((r) => setTimeout(r, UNDO_WINDOW_MS));
      await notifyPenaltyCreated(id);
    });
    revalidatePath("/", "layout");
  });
  return { ...result, penaltyId };
}

export async function markAllPaidAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const n = await markAllPaidForMember(actor, str(fd, "userId"));
    revalidatePath("/", "layout");
    return n === 1 ? "1 Strafe als bezahlt markiert." : `${n} Strafen als bezahlt markiert.`;
  });
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
