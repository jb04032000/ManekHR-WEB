'use client';

/**
 * Global accessible announcer for Connect.
 *
 * Most surfaces announce through the per-component `useAnnouncer` hook. But some
 * mutations live in a hook with no JSX to host a live region (e.g.
 * `useRelationship`, shared by every people card) and the action's only cue is
 * a toast + an optimistic button flip. Mounting a live region per card would
 * scatter dozens of duplicate regions, so those callers announce through this
 * single shell-level region instead.
 *
 * Mount `<GlobalAnnouncer />` ONCE in the Connect shell, then call
 * `announceGlobal(message, { assertive })` from anywhere. Two regions (polite +
 * assertive) are rendered rather than toggling `aria-live`, which is unreliable
 * across assistive tech. Both are visually hidden; the visible feedback stays
 * the toast.
 */

import { useEffect, useState } from 'react';

type Listener = (message: string, assertive: boolean) => void;

const listeners = new Set<Listener>();

/** Announce a message to assistive tech via the mounted GlobalAnnouncer. A
 *  no-op (beyond the toast the caller also fires) when none is mounted. */
export function announceGlobal(message: string, opts?: { assertive?: boolean }): void {
  for (const listener of listeners) listener(message, opts?.assertive ?? false);
}

export default function GlobalAnnouncer() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  useEffect(() => {
    const listener: Listener = (message, isAssertive) => {
      if (isAssertive) setAssertive(message);
      else setPolite(message);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return (
    <>
      <div aria-live="polite" role="status" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" role="alert" className="sr-only">
        {assertive}
      </div>
    </>
  );
}
