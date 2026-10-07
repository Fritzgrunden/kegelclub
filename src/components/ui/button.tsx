import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

const variants = {
  primary: "bg-messing text-bahn font-semibold hover:bg-messing-hell shadow-[0_2px_0_#8f6a24]",
  secondary: "bg-theke-2 text-kreide border border-eiche hover:border-messing/60",
  ghost: "text-kreide-dim hover:text-kreide hover:bg-theke-2",
  danger: "bg-absage text-white font-semibold hover:brightness-110",
  zusage: "bg-zusage text-bahn font-semibold hover:brightness-110",
  absage: "bg-absage text-white font-semibold hover:brightness-110",
} as const;

const sizes = {
  sm: "min-h-10 px-3 text-sm gap-1.5",
  md: "min-h-12 px-4 text-[15px] gap-2",
  lg: "min-h-14 px-5 text-base gap-2",
  xl: "min-h-16 px-6 text-lg gap-2.5",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-xl transition-colors select-none",
    "disabled:opacity-50 disabled:pointer-events-none active:translate-y-px",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type="button" className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
  href,
  variant,
  size,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}
