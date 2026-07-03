/**
 * Discriminated result for server actions. Extracted from the removed Connect
 * feature's profile.types (2026-07-04) because ERP surfaces (push device
 * registration, admin actions, shell notifications) share the same contract.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      /** A `423` from the backend `PinUnlockGuard` - the session is App-Locked. */
      locked?: boolean;
      /**
       * A `401` that survived `serverHttp`'s refresh-retry - the session is
       * genuinely signed out (refresh token expired/revoked).
       */
      authFailed?: boolean;
      /** Machine-readable error code when the backend supplied one. */
      code?: string;
      /** HTTP status when known. */
      status?: number;
    };
