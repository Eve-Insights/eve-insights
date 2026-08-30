import { DatabaseAdapterError } from "@eve-insights/adapter-types";

export function isUniqueViolation(error: { readonly code?: string }): boolean {
  return error.code === "23505";
}

export function throwUnexpected(error: {
  readonly code?: string;
  readonly message?: string;
}): never {
  throw new DatabaseAdapterError(
    "unavailable",
    error.message && error.message.length > 0
      ? error.message
      : "Supabase request failed.",
  );
}
