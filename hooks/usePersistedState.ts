'use client';
// Persist a piece of UI state (e.g. a list page's filter object) to localStorage so it
// survives navigation and reloads. Used by the finance list pages to remember per-firm
// filter defaults (the platform bar asks for "saved per-firm filter defaults"). Cross-link:
// app/.../finance/.../sales/*/page.tsx compose a per-firm key like
// `finance:sales:invoices:filters:<firmId>`. Watch: SSR-safe - the persisted value is only
// read after mount (inside useEffect) to avoid a hydration mismatch, so the first paint uses
// `initial` and then swaps to the stored value once hydrated.
import { startTransition, useEffect, useRef, useState } from 'react';

export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  // Guard so the first persist effect run (right after we load the stored value) does not
  // immediately re-write the same value, and so we never write before reading.
  const loadedRef = useRef(false);

  // Read once on mount (client only).
  useEffect(() => {
    let stored: T | null = null;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) stored = JSON.parse(raw) as T;
    } catch {
      // Corrupt/blocked storage: fall back to `initial`, never throw into render.
    }
    loadedRef.current = true;
    // Deferred (startTransition) so this hydration is a non-urgent update, satisfying the
    // react-hooks/set-state-in-effect rule that bans synchronous setState in an effect body.
    startTransition(() => {
      if (stored !== null) setValue(stored);
      setHydrated(true);
    });
    // Intentionally keyed only on `key`: a key change means a different bucket to load.
  }, [key]);

  // Write on change, but only after the initial load has happened.
  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota/private-mode: silently skip persistence.
    }
  }, [key, value]);

  return [value, setValue, hydrated];
}
