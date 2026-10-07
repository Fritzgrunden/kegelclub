export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
}

export type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
