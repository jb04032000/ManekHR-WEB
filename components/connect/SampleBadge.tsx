'use client';

/**
 * SampleBadge — a passive, neutral disclosure pill that marks a single piece of
 * Connect content (a profile, post, listing, job, etc.) as seeded demo / sample
 * content shown while the community grows.
 *
 * What it does: renders a tiny ManekHR monogram (navy square, gold "Z") + the
 * localized word "Sample" / "નમૂનો". It is a DISCLOSURE, not a trust signal, so
 * it uses the muted neutral badge tokens (--cn-badge-neutral-bg/-fg) — never the
 * gold ERP / green verified look that reads as endorsement.
 *
 * Cross-module links:
 *   - Caller gates on the denormalized `isDemo` flag that the backend stamps at
 *     create on content docs (mirrors authorErpLinked in feed.service.ts) and
 *     surfaces via ConnectPersonRef.isDemo / InboxParty.isDemo. The same flag
 *     drives the feed/search down-rank (backend demo-rank.ts applyDemoPenalty),
 *     so the badge and the rank read ONE source of truth.
 *   - Companion to SampleContentNote.tsx (the ambient page-level note); this is
 *     the per-item marker. Keep the wording family consistent with it.
 *
 * Watch:
 *   - Render nothing unless the caller has confirmed isDemo — pattern is
 *     {isDemo && <SampleBadge />}. The component does not read isDemo itself.
 *   - i18n is kept inline across all four locales (en / gu / gu-en / hi-en) like
 *     SampleContentNote, so this self-contained marker needs no shared catalog
 *     keys. Falls back to English for any other locale.
 */

import { useLocale } from 'next-intl';

/** The short pill word, per locale. */
const LABEL: Record<string, string> = {
  en: 'Sample',
  'gu-en': 'Sample',
  'hi-en': 'Sample',
  gu: 'નમૂનો',
};

/** The full accessible sentence (aria-label / title), per locale. */
const FULL: Record<string, string> = {
  en: 'ManekHR sample — example content shown while the community grows.',
  'gu-en': 'ManekHR sample — community vadhe tya sudhi batavela udaharan (example) content.',
  'hi-en': 'ManekHR sample — community badhne tak dikhaya gaya udaharan (example) content.',
  gu: 'ManekHR નમૂનો — સમુદાય વધે ત્યાં સુધી બતાવેલ ઉદાહરણરૂપ સામગ્રી.',
};

interface SampleBadgeProps {
  size?: 'sm' | 'md';
  className?: string;
}

export default function SampleBadge({ size = 'md', className }: SampleBadgeProps) {
  const locale = useLocale();
  const word = LABEL[locale] ?? LABEL.en;
  const full = FULL[locale] ?? FULL.en;

  // Match TrustBadgeRow's pill geometry so the disclosure sits cleanly alongside
  // (or instead of) the trust badges on a card.
  const pad = size === 'sm' ? '2px 7px' : '3px 9px';
  const fontSize = size === 'sm' ? 10 : 11;
  const mark = size === 'sm' ? 11 : 13;

  return (
    <span
      role="status"
      aria-label={full}
      title={full}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: pad,
        borderRadius: 'var(--cr-radius-full)',
        background: 'var(--cn-badge-neutral-bg)',
        color: 'var(--cn-badge-neutral-fg)',
        fontSize,
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {/* Tiny ManekHR monogram: navy rounded square with a gold "Z". Decorative —
          the meaning is carried by the word + aria-label, so it is aria-hidden. */}
      <span
        aria-hidden
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: mark,
          height: mark,
          borderRadius: 3,
          background: '#0B6E4F',
          color: '#C9A227',
          fontSize: Math.round(mark * 0.72),
          fontWeight: 800,
          lineHeight: 1,
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        Z
      </span>
      {word}
    </span>
  );
}
