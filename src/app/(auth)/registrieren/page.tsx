import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { registerAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Registrieren" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Registrieren</h1>
      <p className="mb-5 mt-1 text-sm text-kreide-dim">Nach der Registrierung schaltet ein Admin dein Konto frei.</p>
      <ActionForm action={registerAction} resetOnSuccess className="flex flex-col gap-4">
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
      <p className="mt-6 text-center text-sm text-kreide-dim">
        Schon registriert? <Link href="/login" className="font-semibold text-messing-hell hover:underline">Anmelden</Link>
      </p>
    </>
  );
}
