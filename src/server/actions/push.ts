"use server";

import type { ActionResult } from "@/lib/action-result";
import { AppError } from "@/lib/errors";
import { removeSubscription, saveSubscription, sendPushToUsers } from "@/server/services/push";
import { requireActor } from "@/server/auth/session";
import { runAction, str } from "./utils";

export async function savePushSubscriptionAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    let raw: unknown;
    try {
      raw = JSON.parse(str(fd, "subscription"));
    } catch {
      throw new AppError("Ungültiges Push-Abo.");
    }
    await saveSubscription(actor.id, raw);
  });
}

export async function removePushSubscriptionAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await removeSubscription(actor.id, str(fd, "endpoint"));
  });
}

export async function sendTestPushAction(): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const delivered = await sendPushToUsers([actor.id], {
      title: "Test-Benachrichtigung",
      body: "Push funktioniert! 🎳",
      url: "/profil",
    });
    if (delivered === 0) throw new AppError("Die Test-Benachrichtigung konnte nicht zugestellt werden.");
    return "Test-Benachrichtigung gesendet.";
  });
}
