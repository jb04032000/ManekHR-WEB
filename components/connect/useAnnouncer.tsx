'use client';

/**
 * useAnnouncer - a tiny accessible live-region primitive for Connect.
 *
 * AntD `message` toasts are the usual success/error channel, but they are not
 * reliably announced by screen readers (the node is often inserted before the
 * live region registers, and the auto-dismiss races a slow reader). Pair every
 * mutation toast with `announce(...)` so the same copy reaches assistive tech.
 *
 * Usage:
 *   const { announce, announcer } = useAnnouncer();
 *   ...
 *   return (<>{announcer} ... </>);
 *   // in a handler, on success/failure:
 *   announce(t('savedSuccess'));                 // polite (status)
 *   announce(t('saveFailed'), { assertive: true }); // assertive (alert)
 *
 * Two separate regions (polite + assertive) are rendered rather than toggling
 * `aria-live` on one node, which is unreliable across AT. Both are visually
 * hidden via `sr-only`; the visible feedback stays the AntD toast.
 */

import { useCallback, useState } from 'react';

export interface Announcer {
  /** Announce a message to assistive tech. Polite by default; pass
   *  `{ assertive: true }` for errors that should interrupt. */
  announce: (message: string, opts?: { assertive?: boolean }) => void;
  /** Render this once inside the component tree (it is visually hidden). */
  announcer: React.ReactNode;
}

export default function useAnnouncer(): Announcer {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');

  const announce = useCallback((message: string, opts?: { assertive?: boolean }) => {
    if (opts?.assertive) setAssertive(message);
    else setPolite(message);
  }, []);

  const announcer = (
    <>
      <div aria-live="polite" role="status" className="sr-only">
        {polite}
      </div>
      <div aria-live="assertive" role="alert" className="sr-only">
        {assertive}
      </div>
    </>
  );

  return { announce, announcer };
}
