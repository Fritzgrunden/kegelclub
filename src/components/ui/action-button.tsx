"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import { Spinner } from "./fields";

/**
 * Button, der eine Server Action ausführt – optional mit Bestätigungsdialog.
 * Für destruktive Aktionen immer `confirm` angeben.
 */
export function ActionButton({
  action,
  fields = {},
  children,
  variant = "secondary",
  size = "md",
  className,
  confirm,
  ariaLabel,
}: {
  action: (formData: FormData) => Promise<ActionResult | void>;
  fields?: Record<string, string>;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  confirm?: { title: string; text?: string; confirmLabel: string };
  ariaLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const run = () => {
    dialog.current?.close();
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    startTransition(async () => {
      const res = await action(fd);
      if (res && !res.ok) setError(res.message ?? "Aktion fehlgeschlagen.");
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={pending}
        className={buttonClass(variant, size, className)}
        onClick={() => (confirm ? dialog.current?.showModal() : run())}
      >
        {pending && <Spinner />}
        {children}
      </button>
      {error && (
        <span role="alert" className="block w-full text-sm text-absage">
          {error}
        </span>
      )}
      {confirm && (
        <dialog
          ref={dialog}
          className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-eiche bg-theke p-0 text-kreide backdrop:bg-black/70"
        >
          <div className="p-5">
            <h2 className="font-display text-xl font-bold">{confirm.title}</h2>
            {confirm.text && <p className="mt-2 text-kreide-dim">{confirm.text}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" className={buttonClass("secondary", "lg")} onClick={() => dialog.current?.close()}>
                Abbrechen
              </button>
              <button type="button" className={buttonClass(variant === "danger" ? "danger" : "primary", "lg")} onClick={run}>
                {confirm.confirmLabel}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
