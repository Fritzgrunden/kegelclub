import type { ReactNode } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "./cn";

const tones = {
  error: { cls: "border-absage/50 bg-absage/10 text-[#f3b3a3]", Icon: TriangleAlert },
  success: { cls: "border-zusage/50 bg-zusage/10 text-[#c4e6bf]", Icon: CircleCheck },
  info: { cls: "border-messing/40 bg-messing/10 text-messing-hell", Icon: Info },
} as const;

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  const { cls, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[15px]", cls, className)}>
      <Icon size={20} className="mt-0.5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
