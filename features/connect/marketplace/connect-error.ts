import { isAxiosError } from 'axios';

/**
 * Shared reader for the Connect backend error envelope (M1.6.3).
 *
 * The backend `HttpExceptionFilter` shapes every error as
 * `{ success: false, error: { code: <httpStatus>, message }, ...extra }` and
 * spreads any app-level extras (the string `code`, a numeric `limit`, etc.) to
 * the response top level. This reads that envelope once so each feature mapper
 * (`mapInquiryError`, the create-listing mapper) branches on the same shape
 * instead of re-parsing axios errors.
 */
export interface ConnectErrorInfo {
  /** App-level code promoted to the body top level, or `null` if none. */
  code: string | null;
  /** HTTP status, or `null` for a non-HTTP failure (e.g. network). */
  status: number | null;
  /** Human message: nested `error.message`, then flat `message`, then axios. */
  message: string;
  /** Raw response body, for reading extras like `limit`. `null` if non-axios. */
  data: Record<string, unknown> | null;
}

export function extractConnectError(e: unknown): ConnectErrorInfo {
  if (isAxiosError(e)) {
    const raw = e.response?.data;
    const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
    const nested = data?.error as { message?: unknown } | undefined;
    const nestedMessage = typeof nested?.message === 'string' ? nested.message : undefined;
    const flatMessage = typeof data?.message === 'string' ? data.message : undefined;
    return {
      code: typeof data?.code === 'string' ? data.code : null,
      status: e.response?.status ?? null,
      message: nestedMessage ?? flatMessage ?? e.message,
      data,
    };
  }
  return {
    code: null,
    status: null,
    message: e instanceof Error ? e.message : 'Something went wrong',
    data: null,
  };
}
