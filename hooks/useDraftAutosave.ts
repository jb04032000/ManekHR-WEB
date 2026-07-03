'use client';
/**
 * Hybrid autosave hook - 3s IndexedDB + 30s server + on-blur trigger.
 * Per F-02 D-07. Status state machine: idle → saving → saved → idle, offline on server-only failure.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDraft } from '@/lib/finance/draftStore';

interface Args<T> {
  key: string;
  data: T;
  workspaceId: string;
  firmId: string;
  voucherType: string;
  draftId: string;
  onServerSave: (data: T) => Promise<void>;
  /** Default: 3000ms */
  indexedDbDelayMs?: number;
  /** Default: 30000ms */
  serverDelayMs?: number;
  enabled?: boolean;
  /**
   * Gate for the SERVER save (timer + on-blur). When false, no server POST fires
   * and the status never flips to 'offline'. Callers pass false for a pristine,
   * empty draft so an untouched new invoice never POSTs an invalid empty body and
   * never shows a false "Saved locally". IndexedDB local save is unaffected.
   * Keep in sync with VoucherEditor's `hasContent` gate. Default true.
   */
  canServerSave?: boolean;
}

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export function useDraftAutosave<T>({
  key,
  data,
  workspaceId,
  firmId,
  voucherType,
  draftId,
  onServerSave,
  indexedDbDelayMs = 3000,
  serverDelayMs = 30000,
  enabled = true,
  canServerSave = true,
}: Args<T>) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);

  const idbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);

  // Sync ref every render so callbacks always close over fresh data.
  // Must be an effect (not inline) to satisfy the React Compiler's refs rule.
  useEffect(() => {
    dataRef.current = data;
  });

  const performIdbSave = useCallback(async () => {
    try {
      await saveDraft({
        key,
        workspaceId,
        firmId,
        voucherType,
        draftId,
        data: dataRef.current,
      });
    } catch (e: unknown) {
      setLastError(e instanceof Error ? e : new Error(String(e)));
    }
  }, [key, workspaceId, firmId, voucherType, draftId]);

  const performServerSave = useCallback(async () => {
    setStatus('saving');
    try {
      await onServerSave(dataRef.current);
      setStatus('saved');
      setLastSavedAt(new Date());
      // Revert to idle after 3s
      setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 3000);
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e));
      setLastError(err);
      setStatus('offline');
    }
  }, [onServerSave]);

  /** Immediate save - clears pending timers, saves IDB then server now */
  const saveNow = useCallback(async () => {
    if (idbTimer.current) clearTimeout(idbTimer.current);
    if (serverTimer.current) clearTimeout(serverTimer.current);
    await performIdbSave();
    await performServerSave();
  }, [performIdbSave, performServerSave]);

  // Re-arm timers on every data change
  useEffect(() => {
    if (!enabled) return;
    if (idbTimer.current) clearTimeout(idbTimer.current);
    if (serverTimer.current) clearTimeout(serverTimer.current);
    idbTimer.current = setTimeout(() => {
      performIdbSave();
    }, indexedDbDelayMs);
    // Server save only arms when there is real content to persist. A pristine new
    // invoice (no party, no lines) skips this, so it never POSTs an empty draft and
    // never flips to 'offline' ("Saved locally") on mount.
    if (canServerSave) {
      serverTimer.current = setTimeout(() => {
        performServerSave();
      }, serverDelayMs);
    }
    return () => {
      if (idbTimer.current) clearTimeout(idbTimer.current);
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [
    data,
    enabled,
    canServerSave,
    indexedDbDelayMs,
    serverDelayMs,
    performIdbSave,
    performServerSave,
  ]);

  // On-blur shortcut - save to server immediately when tab loses focus.
  // WR-04: Guard against firing a second concurrent save if one is already in-flight.
  useEffect(() => {
    const onBlur = () => {
      if (status === 'saving' || !canServerSave) return;
      performServerSave();
    };
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, [performServerSave, status, canServerSave]);

  return { status, lastSavedAt, saveNow, lastError };
}
