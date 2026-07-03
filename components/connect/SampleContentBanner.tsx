'use client';

/**
 * SampleContentBanner - a one-line, dismissible TOP strip shown on the main
 * Connect surfaces (feed / marketplace / search) during the launch period, when
 * those surfaces are seeded with demo accounts so the product does not look
 * empty. It is the page-level companion to the per-item SampleBadge: the badge
 * marks each demo item, this banner sets the expectation up front.
 *
 * Cross-module links:
 *   - Reuses SampleContentNote's localized strings (SAMPLE_NOTE) + the same
 *     build-time kill switch (sampleNoticeEnabled / NEXT_PUBLIC_CONNECT_DEMO_NOTICE)
 *     so the ambient note and this strip stay one source of truth. Pair with
 *     `npm run connect:demo:clear` on the backend to remove the demo accounts.
 *   - The per-item marker is SampleBadge.tsx (gated on each item's isDemo).
 *
 * Watch:
 *   - Dismissal is per-browser (localStorage) and intentionally lightweight; if
 *     localStorage is unavailable the strip simply stays shown (non-dismissible
 *     fallback). It reads the dismissal via useSyncExternalStore so there is no
 *     setState-in-effect and no flash: SSR shows it, hydration reconciles it away
 *     for a viewer who already dismissed it.
 *   - i18n is inline via the shared SAMPLE_NOTE map (no new catalog keys).
 */

import { useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { X } from 'lucide-react';
import { SAMPLE_NOTE, sampleNoticeEnabled } from './SampleContentNote';

/** Per-browser dismissal key. Bumping the suffix re-shows the strip to everyone. */
const DISMISS_KEY = 'cn:sample-banner:dismissed:v1';

/** Dismiss-button label per locale (self-contained, like SAMPLE_NOTE; no catalog). */
const DISMISS_LABEL: Record<string, string> = {
  en: 'Dismiss',
  'gu-en': 'Band karo',
  'hi-en': 'Band karein',
  gu: 'બંધ કરો',
};

/** Read whether the viewer has dismissed the strip (best-effort; blocked storage
 *  reads as "not dismissed" -> non-dismissible fallback). */
function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Module-level subscribers so a dismissal in one mounted strip updates any other
 *  instance live (and the store integrates with useSyncExternalStore). */
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function setDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // Best-effort; if it fails the strip just returns next load.
  }
  listeners.forEach((l) => l());
}

export default function SampleContentBanner() {
  const locale = useLocale();
  // useSyncExternalStore gives a stable SSR snapshot (false = "not dismissed yet")
  // and the real client read after hydration, WITHOUT a setState-in-effect. SSR
  // renders the strip (server snapshot = not dismissed); if the client says it was
  // dismissed, React reconciles it away on hydration with no flash of stale state.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);

  if (!sampleNoticeEnabled() || dismissed) return null;

  const text = SAMPLE_NOTE[locale] ?? SAMPLE_NOTE.en;

  return (
    <div
      role="note"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        marginBottom: 12,
        borderRadius: 'var(--cr-radius-md, 10px)',
        background: 'var(--cn-badge-neutral-bg, var(--cr-surface-2, #f3f4f6))',
        color: 'var(--cn-badge-neutral-fg, var(--cr-text-3, #4b5563))',
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      {/* Tiny ManekHR monogram, mirrors the SampleBadge mark so the strip reads
          as the same disclosure family. Decorative; meaning is in the text. */}
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          width: 16,
          height: 16,
          borderRadius: 4,
          background: '#0B6E4F',
          color: '#C9A227',
          fontSize: 11,
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        Z
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
      <button
        type="button"
        onClick={setDismissed}
        aria-label={DISMISS_LABEL[locale] ?? DISMISS_LABEL.en}
        style={{
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
          width: 24,
          height: 24,
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          borderRadius: '50%',
        }}
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
