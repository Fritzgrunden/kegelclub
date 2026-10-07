import { PinDiamond } from "@/components/ui/pin-diamond";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <PinDiamond className="mb-6 size-24" fallen={[0, 1, 2, 3, 5, 6, 7, 8]} />
      <h1 className="text-3xl font-bold">Pudel! Seite nicht gefunden.</h1>
      <p className="mt-2 max-w-sm text-kreide-dim">Die Kugel ist in der Rinne gelandet – diese Adresse gibt es nicht (mehr).</p>
      <LinkButton href="/" className="mt-6" size="lg">Zur Startseite</LinkButton>
    </main>
  );
}
