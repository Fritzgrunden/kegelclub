import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { Alert } from "@/components/ui/alert";
import { forgotPasswordAction } from "@/server/actions/auth";
import { canDeliverMail } from "@/server/services/mail";

export const metadata: Metadata = { title: "Passwort vergessen" };

// Erst zur Laufzeit prüfen, ob Mails rausgehen – nicht beim Build.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  if (!canDeliverMail()) {
    return (
      <>
        <h1 className="mb-5 text-2xl font-bold">Passwort vergessen</h1>
        <Alert>
          Wende dich bitte an den Vorstand. Dort kann man dir einen Link schicken, mit dem du ein neues Passwort festlegst
          (z. B. per WhatsApp).
        </Alert>
        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-kreide-dim hover:underline">Zurück zur Anmeldung</Link>
        </p>
      </>
    );
  }
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
