"use client";

import { createContext, useActionState, useContext, useEffect, useRef, startTransition, type ReactNode } from "react";
import type { ActionResult, FormAction } from "@/lib/action-result";
import { Alert } from "./alert";

interface FormState {
  state: ActionResult | null;
  pending: boolean;
}

const FormStateContext = createContext<FormState>({ state: null, pending: false });
export const useFormState = () => useContext(FormStateContext);

/**
 * Formular mit Server Action, Ladezustand, Feldfehlern und Erfolgsmeldung.
 * Absichtlich per onSubmit statt `action`, damit Eingaben bei Fehlern erhalten bleiben.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.();
    }
  }, [state, resetOnSuccess, onSuccess]);

  return (
    <FormStateContext.Provider value={{ state, pending }}>
      <form
        ref={ref}
        noValidate
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (submitter?.name) fd.set(submitter.name, submitter.value);
          startTransition(() => formAction(fd));
        }}
      >
        {state && !state.ok && state.message && <Alert tone="error" className="mb-4">{state.message}</Alert>}
        {state?.ok && state.message && <Alert tone="success" className="mb-4">{state.message}</Alert>}
        {children}
      </form>
    </FormStateContext.Provider>
  );
}
