'use client';

/**
 * One-stop wiring for the Connect plan-limit upgrade prompt. A create screen
 * calls `handleLimited(result)` on a not-ok action result: if the result carries
 * the typed `limitReached` detail, it opens the shared LimitReachedDialog and
 * returns true (so the caller skips its normal error toast); otherwise false.
 *
 * Render the returned `dialog` once in the component tree. Used by all four
 * Connect create flows (listing / storefront / company page / job).
 *
 * Links: components/connect/LimitReachedDialog.tsx, features/connect/connect-limit.ts.
 */

import { useCallback, useState } from 'react';
import { LimitReachedDialog } from './LimitReachedDialog';
import type { ConnectLimitInfo } from '@/features/connect/connect-limit';

/** Any action result that may carry a plan-limit block on its not-ok branch. */
type LimitableResult = { ok: true } | { ok: false; limitReached?: ConnectLimitInfo };

export function useLimitReachedDialog() {
  const [info, setInfo] = useState<ConnectLimitInfo | null>(null);
  const [open, setOpen] = useState(false);

  const handleLimited = useCallback((res: LimitableResult): boolean => {
    if (!res.ok && res.limitReached) {
      setInfo(res.limitReached);
      setOpen(true);
      return true;
    }
    return false;
  }, []);

  const dialog = <LimitReachedDialog open={open} info={info} onClose={() => setOpen(false)} />;

  return { dialog, handleLimited };
}
