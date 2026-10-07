"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import type { EventStatus, RsvpStatus } from "@/server/db/schema";
import {
  clearParticipation,
  createEvent,
  deleteEvent,
  setEventImage,
  setEventStatus,
  setParticipation,
  updateEvent,
  type DeleteScope,
  type EditScope,
} from "@/server/services/events";
import { storeImage } from "@/server/services/images";
import { assertCan } from "@/server/auth/guard";
import { requireActor } from "@/server/auth/session";
import { file, optStr, runAction, str } from "./utils";

export async function saveEventAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  let target = "";
  const result = await runAction(async () => {
    const actor = await requireActor();
    assertCan(actor, "events:manage");
    const raw = {
      kind: str(fd, "kind"),
      eventType: optStr(fd, "eventType") ?? null,
      title: str(fd, "title"),
      description: optStr(fd, "description"),
      location: optStr(fd, "location"),
      date: str(fd, "date"),
      time: str(fd, "time"),
      endDate: optStr(fd, "endDate"),
      endTime: optStr(fd, "endTime"),
      recurrence: optStr(fd, "recurrence") ?? "KEINE",
      intervalDays: optStr(fd, "intervalDays") ?? null,
      seriesEndDate: optStr(fd, "seriesEndDate"),
    };
    const image = file(fd, "image");
    const imageId = image ? await storeImage(image, actor.id) : null;
    const id = optStr(fd, "id");

    if (id) {
      await updateEvent(actor, id, raw, (optStr(fd, "scope") as EditScope) ?? "EINZELN");
      if (imageId) await setEventImage(actor, id, imageId);
      target = `/termine/${id}`;
    } else {
      const created = await createEvent(actor, raw, imageId);
      target = `/termine/${created.eventId}`;
    }
    revalidatePath("/", "layout");
  });
  if (result.ok && target) redirect(target);
  return result;
}

export async function deleteEventAction(fd: FormData): Promise<ActionResult> {
  let back = "";
  const result = await runAction(async () => {
    const actor = await requireActor();
    await deleteEvent(actor, str(fd, "id"), (optStr(fd, "scope") as DeleteScope) ?? "EINZELN");
    back = str(fd, "kind") === "EVENT" ? "/events" : "/kegelabende";
    revalidatePath("/", "layout");
  });
  if (result.ok) redirect(back);
  return result;
}

export async function setEventStatusAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    await setEventStatus(actor, str(fd, "id"), str(fd, "status") as EventStatus);
    revalidatePath("/", "layout");
  });
}

export async function rsvpAction(fd: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const actor = await requireActor();
    const status = str(fd, "status");
    if (status === "KEINE") await clearParticipation(actor, str(fd, "eventId"));
    else if (status === "ZUGESAGT" || status === "ABGESAGT") await setParticipation(actor, str(fd, "eventId"), status as RsvpStatus);
    revalidatePath("/", "layout");
  });
}
