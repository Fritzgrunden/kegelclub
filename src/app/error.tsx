"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Seitenfehler", error.digest ?? "");
  }, [error]);
  return (
    <main className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
      <TriangleAlert size={48} className="mb-4 text-absage" aria-hidden />
      <h1 className="text-2xl font-bold">Da ist etwas schiefgelaufen</h1>
      <p className="mt-2 max-w-sm text-kreide-dim">
        Die Seite konnte nicht geladen werden. Prüfe deine Verbindung und versuche es noch einmal.
      </p>
      <Button size="lg" className="mt-6" onClick={reset}>Erneut versuchen</Button>
    </main>
  );
}
