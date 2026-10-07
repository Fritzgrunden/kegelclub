import { getCurrentUser } from "@/server/auth/session";
import { getImage } from "@/server/services/images";

const UUID = /^[0-9a-f-]{36}$/i;

/** Liefert hochgeladene Bilder aus – nur für angemeldete Mitglieder. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Nicht gefunden", { status: 404 });
  if (!(await getCurrentUser())) return new Response("Nicht angemeldet", { status: 401 });
  const image = await getImage(id);
  if (!image) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Content-Disposition": "inline",
    },
  });
}
