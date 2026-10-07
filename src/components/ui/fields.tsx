"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { useFormState } from "./action-form";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";

export const inputClass =
  "w-full min-h-12 rounded-xl border border-eiche bg-bahn/70 px-3.5 text-base text-kreide placeholder:text-kreide-dim/50 " +
  "focus:border-messing focus:outline-none focus:ring-2 focus:ring-messing/30 aria-[invalid=true]:border-absage";

export function Field({
  label,
  name,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const { state } = useFormState();
  const error = state?.fieldErrors?.[name];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-medium text-kreide-dim">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-absage">{error}</p>
      ) : (
        hint && <p className="text-xs text-kreide-dim/80">{hint}</p>
      )}
    </div>
  );
}

function useInvalid(name?: string) {
  const { state } = useFormState();
  return name ? Boolean(state?.fieldErrors?.[name]) : false;
}

export function Input({ className, name, ...props }: ComponentProps<"input">) {
  const invalid = useInvalid(name);
  return (
    <input
      id={name}
      name={name}
      aria-invalid={invalid}
      aria-describedby={invalid ? `${name}-error` : undefined}
      className={cn(inputClass, className)}
      {...props}
    />
  );
}

export function Textarea({ className, name, ...props }: ComponentProps<"textarea">) {
  const invalid = useInvalid(name);
  return <textarea id={name} name={name} aria-invalid={invalid} className={cn(inputClass, "min-h-28 py-3", className)} {...props} />;
}

export function Select({ className, name, children, ...props }: ComponentProps<"select">) {
  const invalid = useInvalid(name);
  return (
    <select id={name} name={name} aria-invalid={invalid} className={cn(inputClass, "appearance-none bg-[length:16px] pr-10", className)} {...props}>
      {children}
    </select>
  );
}

export function SubmitButton({
  children,
  pendingText = "Speichern …",
  variant = "primary",
  size = "lg",
  className,
  name,
  value,
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormState();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(variant, size, className)} aria-busy={pending}>
      {pending ? <Spinner /> : null}
      {pending ? pendingText : children}
    </button>
  );
}

export function Spinner() {
  return <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
}
