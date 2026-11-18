import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/members/register-form";

export const metadata: Metadata = { title: "Registrieren" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Registrieren</h1>
      <p className="mb-5 mt-1 text-sm text-kreide-dim">Nach der Registrierung schaltet ein Admin dein Konto frei.</p>
      <RegisterForm />
      <p className="mt-6 text-center text-sm text-kreide-dim">
        Schon registriert? <Link href="/login" className="font-semibold text-messing-hell hover:underline">Anmelden</Link>
      </p>
    </>
  );
}
