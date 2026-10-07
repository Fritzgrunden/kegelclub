import { PinDiamond } from "@/components/ui/pin-diamond";

export default function Loading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center" role="status" aria-label="Wird geladen">
      <PinDiamond className="size-14 animate-pulse" />
    </div>
  );
}
