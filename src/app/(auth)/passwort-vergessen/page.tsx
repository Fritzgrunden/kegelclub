import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { forgotPasswordAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Passwort vergessen</h1>
      <p className="mb-5 mt-1 text-sm text-kreide-dim">Wir schicken dir einen Link, mit dem du ein neues Passwort festlegen kannst.</p>
      <ActionForm action={forgotPasswordAction} className="flex flex-col gap-4">
        <Field label="E-Mail" name="email">
          <Input name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <SubmitButton pendingText="Senden …" className="w-full">Link anfordern</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-kreide-dim hover:underline">Zurück zur Anmeldung</Link>
      </p>
    </>
  );
}
