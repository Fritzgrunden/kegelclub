"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff } from "lucide-react";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/server/actions/push";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/fields";

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function PushSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // iPhones können Push erst, wenn die App auf dem Home-Bildschirm liegt.
        setState(isIos() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () =>
    startTransition(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
        });
        const fd = new FormData();
        fd.set("subscription", JSON.stringify(sub));
        const res = await savePushSubscriptionAction(fd);
        if (!res.ok) throw new Error(res.message);
        setState("on");
        setMessage({ tone: "success", text: "Benachrichtigungen sind auf diesem Gerät aktiviert." });
      } catch (e) {
        setMessage({ tone: "error", text: e instanceof Error && e.message ? e.message : "Aktivieren fehlgeschlagen." });
      }
    });

  const disable = () =>
    startTransition(async () => {
      setMessage(null);
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set("endpoint", sub.endpoint);
        await removePushSubscriptionAction(fd);
        await sub.unsubscribe();
      }
      setState("off");
    });

  const test = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await sendTestPushAction();
      setMessage({ tone: res.ok ? "success" : "error", text: res.message ?? "" });
    });

  if (!vapidPublicKey) {
    return <Alert>Push-Benachrichtigungen sind auf dem Server noch nicht eingerichtet.</Alert>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-kreide-dim">
        Erhalte eine Nachricht aufs Handy, wenn dir eine Strafe eingetragen wird – als Admin zusätzlich bei neuen Registrierungen.
      </p>

      {state === "loading" && <Spinner />}
      {state === "unsupported" && <Alert>Dieser Browser unterstützt leider keine Push-Benachrichtigungen.</Alert>}
      {state === "ios-install" && (
        <Alert>
          Auf dem iPhone funktionieren Benachrichtigungen nur, wenn die App auf dem Home-Bildschirm liegt: in Safari auf{" "}
          <strong>Teilen</strong> → <strong>Zum Home-Bildschirm</strong> tippen und die App von dort öffnen.
        </Alert>
      )}
      {state === "denied" && (
        <Alert tone="error">
          Benachrichtigungen sind für diese Seite blockiert. Erlaube sie in den Einstellungen deines Browsers bzw. Handys und lade die Seite neu.
        </Alert>
      )}

      {state === "off" && (
        <Button variant="primary" onClick={enable} disabled={pending} className="w-full sm:w-auto">
          {pending ? <Spinner /> : <Bell size={18} aria-hidden />}
          Benachrichtigungen aktivieren
        </Button>
      )}
      {state === "on" && (
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={test} disabled={pending}>
            {pending ? <Spinner /> : <Bell size={18} aria-hidden />}
            Test senden
          </Button>
          <Button variant="ghost" onClick={disable} disabled={pending}>
            <BellOff size={18} aria-hidden />
            Deaktivieren
          </Button>
        </div>
      )}

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
    </div>
  );
}
