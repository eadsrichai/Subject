"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/authz";

type FormState = { result: ActionResult | null; values: Record<string, string> | null };

/**
 * Runs a server action from a form and keeps what the user typed when it
 * fails (React resets uncontrolled fields after every form action).
 */
export function useFormAction(action: (formData: FormData) => Promise<ActionResult>) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    async (_prev, formData) => {
      const result = await action(formData);
      const values: Record<string, string> = {};
      // Never echo passwords back into the page.
      formData.forEach((v, k) => {
        if (typeof v === "string" && !k.toLowerCase().includes("password") && k !== "current") values[k] = v;
      });
      return { result, values: result.ok ? null : values };
    },
    { result: null, values: null },
  );

  const errors = state.result && !state.result.ok ? state.result.errors : {};
  return {
    formAction,
    pending,
    errors,
    saved: state.result?.ok === true,
    /** The value to show in a field: what was just submitted, else the stored one. */
    value: (name: string, stored: string | number | null | undefined = "") =>
      state.values ? (state.values[name] ?? "") : String(stored ?? ""),
    /** Same for a checkbox. */
    checked: (name: string, stored: boolean) => (state.values ? name in state.values : stored),
    /** Everything submitted in the last failed attempt (passwords excepted), or null. */
    submitted: state.values,
    /** Changes whenever a submission fails, to remount fields with the submitted values. */
    attempt: state.values ? JSON.stringify(state.values) : "initial",
  };
}

export function FieldError({ message }: { message?: string }) {
  return message ? <p className="field-error">{message}</p> : null;
}

export function FormError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  ) : null;
}

type FieldProps = {
  name: string;
  label: string;
  error?: string;
  hint?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">;

export function Field({ name, label, error, hint, className, ...input }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <input id={name} name={name} aria-invalid={!!error} className="field" {...input} />
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

type TextAreaProps = { name: string; label: string; error?: string } & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "name"
>;

export function TextArea({ name, label, error, ...area }: TextAreaProps) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <textarea id={name} name={name} aria-invalid={!!error} className="field" {...area} />
      <FieldError message={error} />
    </div>
  );
}

/** A delete button that asks first and shows why the server refused, if it did. */
export function DeleteButton({
  action,
  label,
  confirmMessage,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  label: string;
  confirmMessage: string;
}) {
  const { formAction, pending, errors } = useFormAction(action);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
      className="inline"
    >
      <button type="submit" className="btn-danger" disabled={pending}>
        {label}
      </button>
      {errors._ && (
        <span role="alert" className="ml-2 text-sm text-red-700">
          {errors._}
        </span>
      )}
    </form>
  );
}
