import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: ReactNode; back?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-2 inline-flex min-h-10 items-center gap-1.5 text-sm text-kreide-dim hover:text-kreide">
            <ArrowLeft size={18} aria-hidden /> Zurück
          </Link>
        )}
        <h1 className="text-3xl font-bold leading-tight text-kreide sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-kreide-dim">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
