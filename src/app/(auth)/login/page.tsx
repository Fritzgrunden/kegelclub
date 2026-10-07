import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Input, SubmitButton } from "@/components/ui/fields";
import { Alert } from "@/components/ui/alert";
import { loginAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; zurueckgesetzt?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const sp = await searchParams;
  return (
    <>
      <h1 className="mb-5 text-2xl font-bold">Anmelden</h1>
      {sp.zurueckgesetzt && <Alert tone="success" className="mb-4">Passwort geändert. Du kannst dich jetzt anmelden.</Alert>}
      <ActionForm action={loginAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={sp.next ?? "/"} />
        <Field label="E-Mail" name="email">
          <Input name="email" type="email" autoComplete="email" inputMode="email" required />
        </Field>
        <Field label="Passwort" name="password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <SubmitButton pendingText="Anmelden …" className="mt-2 w-full">Anmelden</SubmitButton>
      </ActionForm>
      <div className="mt-6 flex flex-col gap-3 text-center text-sm">
        <Link href="/passwort-vergessen" className="py-1 text-kreide-dim underline-offset-4 hover:underline">Passwort vergessen?</Link>
        <p className="text-kreide-dim">
          Noch kein Konto?{" "}
          <Link href="/registrieren" className="font-semibold text-messing-hell underline-offset-4 hover:underline">Jetzt registrieren</Link>
        </p>
      </div>
    </>
  );
}
