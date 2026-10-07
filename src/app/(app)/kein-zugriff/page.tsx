import { Lock } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Lock size={48} className="mb-4 text-messing" aria-hidden />
      <h1 className="text-2xl font-bold">Kein Zugriff</h1>
      <p className="mt-2 max-w-sm text-kreide-dim">Für diesen Bereich fehlt deiner Rolle die Berechtigung. Wende dich bei Bedarf an einen Admin.</p>
      <LinkButton href="/" className="mt-6">Zur Startseite</LinkButton>
    </div>
  );
}
