import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { Alert } from "@/components/ui/alert";
import { resetPasswordAction } from "@/server/actions/auth";

export const metadata: Metadata = { title: "Neues Passwort" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token) {
    return (
      <>
        <Alert tone="error">Der Link ist unvollständig. Bitte fordere einen neuen an.</Alert>
        <Link href="/passwort-vergessen" className="mt-4 block text-center text-messing-hell hover:underline">Neuen Link anfordern</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">Neues Passwort festlegen</h1>
      <ActionForm action={resetPasswordAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Neues Passwort" name="password" hint="Mindestens 10 Zeichen.">
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Passwort wiederholen" name="passwordConfirm">
          <Input name="passwordConfirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton className="w-full">Passwort speichern</SubmitButton>
      </ActionForm>
    </>
  );
}
