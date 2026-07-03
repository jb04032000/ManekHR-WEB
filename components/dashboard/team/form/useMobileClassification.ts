'use client';
import { useState, useEffect, useRef } from 'react';
import { classifyMobile } from '@/lib/actions/team.actions';
import type { MobileClassification } from '@/types';

interface UseMobileClassificationArgs {
  workspaceId: string;
  mobile: string | undefined;
  excludeId?: string;
  debounceMs?: number;
}

interface UseMobileClassificationResult {
  status: MobileClassification | null;
  loading: boolean;
}

/**
 * Debounced hook that classifies a mobile number against the platform's
 * identity graph for the given workspace.
 *
 * - Fires after `debounceMs` (default 450 ms) of no change.
 * - Skips the network call when `mobile` is blank or shorter than 7 chars.
 * - Cancels superseded requests via an incrementing request-ID counter so
 *   slow or out-of-order responses never overwrite a newer result.
 * - Clears any pending timer on unmount.
 *
 * The returned `status` is `null` while typing, during debounce, or when
 * the value is too short to classify. The banner component hides itself
 * when `status` is null or `loading` is true, preventing any flicker.
 */
export function useMobileClassification({
  workspaceId,
  mobile,
  excludeId,
  debounceMs = 450,
}: UseMobileClassificationArgs): UseMobileClassificationResult {
  const [status, setStatus] = useState<MobileClassification | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const trimmed = (mobile ?? '').trim();
    if (!workspaceId || trimmed.length < 7) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: immediately clear stale banner when mobile is cleared/too short
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myReq = ++reqIdRef.current;
    timerRef.current = setTimeout(async () => {
      try {
        const result = await classifyMobile(workspaceId, trimmed, excludeId);
        if (myReq !== reqIdRef.current) return; // superseded by a newer request
        setStatus(result);
      } catch {
        if (myReq !== reqIdRef.current) return;
        setStatus(null);
      } finally {
        if (myReq === reqIdRef.current) setLoading(false);
      }
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [workspaceId, mobile, excludeId, debounceMs]);

  return { status, loading };
}
