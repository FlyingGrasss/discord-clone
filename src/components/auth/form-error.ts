import { ApiError } from "@/lib/api";
import { formatRetryAfter } from "@/lib/format";

export interface AuthFailure {
  message: string;
  field?: string;
  code?: string;
}

/** Keeps API error copy consistent across the three auth forms. */
export function describeAuthError(error: unknown): AuthFailure {
  if (!(error instanceof ApiError)) {
    return { message: "Bir şeyler ters gitti. Tekrar dene." };
  }

  const message = error.retryAfterMs
    ? `${error.message} (${formatRetryAfter(error.retryAfterMs)})`
    : error.message;

  return {
    message,
    field: error.field ?? (error.code === "USERNAME_TAKEN" ? "username" : undefined),
    code: error.code,
  };
}
