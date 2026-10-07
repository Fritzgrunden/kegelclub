import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { images } from "@/server/db/schema";
import { AppError } from "@/lib/errors";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Bestimmt den Bildtyp anhand der Datei-Signatur („Magic Bytes“), nicht anhand
 * des vom Browser gemeldeten Typs oder der Dateiendung. SVG ist bewusst nicht erlaubt (XSS).
 */
export function detectImageType(buf: Uint8Array): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => buf[i] === b)) return "image/png";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

export async function storeImage(file: File, uploadedById: string): Promise<string> {
  if (file.size === 0) throw new AppError("Bitte eine Bilddatei auswählen.");
  if (file.size > MAX_IMAGE_BYTES) throw new AppError("Das Bild ist zu groß (maximal 2 MB).");
  const buf = Buffer.from(await file.arrayBuffer());
  const mimeType = detectImageType(buf);
  if (!mimeType) throw new AppError("Nur JPG-, PNG- oder WebP-Bilder sind erlaubt.");
  const [row] = await db.insert(images).values({ uploadedById, mimeType, data: buf }).returning({ id: images.id });
  return row.id;
}

export async function getImage(id: string) {
  return db.query.images.findFirst({ where: eq(images.id, id) });
}

export async function deleteImage(id: string) {
  await db.delete(images).where(eq(images.id, id));
}
