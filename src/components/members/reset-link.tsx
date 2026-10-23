"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, KeyRound, Share2 } from "lucide-react";
import { createResetLinkAction } from "@/server/actions/admin";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/fields";

/** Verwalter erzeugt einen Link zum Zurücksetzen des Passworts und schickt ihn selbst weiter. */
export function ResetLink({ userId, firstName }: { userId: string; firstName: string }) {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => setCanShare(typeof navigator.share === "function"), []);

  const create = () => {
    setError(null);
    setCopied(false);
    const fd = new FormData();
    fd.set("id", userId);
    startTransition(async () => {
      const res = await createResetLinkAction(fd);
      if (res.ok && res.url) setUrl(res.url);
      else setError(res.message ?? "Link konnte nicht erzeugt werden.");
    });
  };

  const text = `Hallo ${firstName}, über diesen Link kannst du ein neues Passwort für den Kegelclub festlegen (24 Stunden gültig):\n${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url!);
      setCopied(true);
    } catch {
      setError("Kopieren nicht möglich – bitte den Link markieren und manuell kopieren.");
    }
  };

  const share = async () => {
    try {
      await navigator.share({ text });
    } catch {
      // Abgebrochen – nichts zu tun.
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-kreide-dim">
        Hat {firstName} das Passwort vergessen? Erzeuge einen Link und schick ihn per WhatsApp o. Ä. Er ist 24 Stunden gültig und nur einmal nutzbar.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {url ? (
        <>
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Link zum Zurücksetzen"
            className="min-h-12 w-full rounded-xl border border-eiche bg-bahn px-3 text-sm text-kreide"
          />
          <div className={canShare ? "grid grid-cols-2 gap-2" : "grid gap-2"}>
            {canShare && (
              <Button variant="primary" onClick={share}>
                <Share2 size={18} aria-hidden /> Teilen
              </Button>
            )}
            <Button variant={canShare ? "secondary" : "primary"} onClick={copy}>
              <Copy size={18} aria-hidden /> {copied ? "Kopiert ✓" : "Kopieren"}
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={create} disabled={pending}>
          {pending ? <Spinner /> : <KeyRound size={18} aria-hidden />} Link zum Zurücksetzen erzeugen
        </Button>
      )}
    </div>
  );
}
