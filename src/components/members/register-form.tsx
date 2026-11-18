"use client";

import { useCallback, useState } from "react";
import { CircleCheck } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { LinkButton } from "@/components/ui/button";
import { registerAction } from "@/server/actions/auth";

/**
 * Registrierung. Nach dem Absenden ersetzt eine Bestätigung das Formular – sonst sähe man am Handy
 * nur ein leeres Formular (die Erfolgsmeldung stand oben außer Sicht) und registriert sich womöglich doppelt.
 */
export function RegisterForm() {
  const [done, setDone] = useState(false);
  const onSuccess = useCallback(() => {
    setDone(true);
    window.scrollTo({ top: 0 });
  }, []);

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center" role="status">
        <CircleCheck size={48} className="text-zusage" aria-hidden />
        <h2 className="font-display text-xl font-bold">Geschafft!</h2>
        <p className="text-kreide-dim">
          Dein Konto ist angelegt. Sobald ein Admin es freigeschaltet hat, kannst du dich anmelden.
        </p>
        <LinkButton href="/login" className="mt-2 w-full">Zur Anmeldung</LinkButton>
      </div>
    );
  }

  return (
    <ActionForm action={registerAction} onSuccess={onSuccess} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vorname" name="firstName">
          <Input name="firstName" autoComplete="given-name" required />
        </Field>
        <Field label="Nachname" name="lastName">
          <Input name="lastName" autoComplete="family-name" required />
        </Field>
      </div>
      <Field label="Spitzname (optional)" name="nickname" hint="Wird in Listen statt deines Namens angezeigt.">
        <Input name="nickname" />
      </Field>
      <Field label="Geburtstag (optional)" name="birthday">
        <Input name="birthday" type="date" />
      </Field>
      <Field label="E-Mail" name="email">
        <Input name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Passwort" name="password" hint="Mindestens 10 Zeichen.">
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Passwort wiederholen" name="passwordConfirm">
        <Input name="passwordConfirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pendingText="Registrieren …" className="mt-2 w-full">Konto anlegen</SubmitButton>
    </ActionForm>
  );
}
