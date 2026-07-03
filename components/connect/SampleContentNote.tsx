/**
 * SampleContentNote — a quiet, one-line "sample content" disclaimer for the
 * Connect surfaces during the launch period, when the feed/network/marketplace
 * are seeded with demo accounts so the product doesn't look empty.
 *
 * Intentionally low-key (matches the Connect footer's ambient 11px / text-4 styling):
 * honest without shouting. It is the only place demo content is labelled, by
 * the owner's choice.
 *
 * Lifecycle / on-off:
 *   Shown by default. To retire it once there is enough real activity, set
 *   NEXT_PUBLIC_CONNECT_DEMO_NOTICE=off (build-time env) — no code change. Pair
 *   this with `npm run connect:demo:clear` on the backend to remove the demo
 *   accounts themselves.
 *
 * i18n: the string is kept inline across all four locales (en / gu / gu-en /
 * hi-en) so this self-contained launch banner needs no edits to the shared
 * message catalogues. Falls back to English for any other locale.
 */
'use client';

import { useLocale } from 'next-intl';

// Exported so the dismissible top banner (SampleContentBanner.tsx) reuses the
// exact same localized strings + env kill switch -- one source of truth for the
// "sample content" disclosure copy across the ambient note and the top strip.
export const SAMPLE_NOTE: Record<string, string> = {
  en: 'Some profiles and posts here are sample content, shown to demonstrate Connect while the community grows.',
  'gu-en':
    'Aahiyana ketlak profiles ane posts namuna (sample) content chhe — community vadhe tya sudhi Connect batavva mate.',
  'hi-en':
    'Yahan kuch profiles aur posts sample content hain — community badhne tak Connect dikhane ke liye.',
  gu: 'અહીંના કેટલાક પ્રોફાઇલ અને પોસ્ટ નમૂનારૂપ સામગ્રી છે — સમુદાય વધે ત્યાં સુધી Connect બતાવવા માટે.',
};

/** True unless explicitly switched off via build-time env. Exported so the top
 *  banner shares the SAME kill switch as the ambient note. */
export function sampleNoticeEnabled(): boolean {
  const v = (process.env.NEXT_PUBLIC_CONNECT_DEMO_NOTICE ?? '').toLowerCase();
  return v !== 'off' && v !== 'false' && v !== '0';
}

export default function SampleContentNote() {
  const locale = useLocale();
  if (!sampleNoticeEnabled()) return null;
  const text = SAMPLE_NOTE[locale] ?? SAMPLE_NOTE.en;

  return (
    <p
      role="note"
      style={{
        margin: '8px 0 0',
        paddingTop: 8,
        // CSS-var fallbacks so the note also reads correctly on the public
        // Connect pages, where the authenticated rail's cr- tokens aren't in scope.
        borderTop: '1px solid var(--cr-border-light, #e5e7eb)',
        fontSize: 11,
        lineHeight: 1.6,
        color: 'var(--cr-text-4, #6b7280)',
      }}
    >
      {text}
    </p>
  );
}
