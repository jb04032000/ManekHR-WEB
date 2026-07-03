/**
 * RailPanel - an atomic card slot for left/right Connect rails.
 *
 * Owns the consistent rail-card chrome (border, surface, radius, padding) so
 * every rail piece - Quick Links, People-to-follow, ads, promos, profile
 * widgets, anything future - reads as part of the same vocabulary instead
 * of each call-site styling its own card.
 *
 * Sits inside a `<Rail>` (sibling component). `<Rail>` owns visibility,
 * width, sticky positioning, and the vertical stacking; `<RailPanel>` owns
 * the box.
 *
 * **Title row** - optional. When `title` is set, renders a top row with the
 * uppercase eyebrow label and (if `titleAction` is set) a right-aligned
 * action slot - typically a "See all" link. Both omitted = chromeless slot
 * for fully bespoke content (e.g. a marketing banner that bleeds the card
 * edges).
 *
 * **Padded** - defaults true (`md` padding). Set to `false` when the child
 * draws its own edges (full-bleed media, embedded composer, etc.).
 *
 * Accessibility:
 * - Uses `<section>` with `aria-label` (when `title` present, label
 *   derives from it; otherwise the caller passes `ariaLabel` explicitly).
 * - The title renders as `<h2>` so heading hierarchy inside the rail stays
 *   intact (the screen `<h1>` lives in the main column).
 */
import type { ReactNode } from 'react';

export interface RailPanelProps {
  /** Uppercase eyebrow title above the panel body. Omit for chromeless. */
  title?: string;
  /** Right-aligned action in the title row - usually a "See all" Link. */
  titleAction?: ReactNode;
  /** Explicit aria-label (required when `title` is omitted + content
   *  isn't self-labelled). When `title` is present this is ignored - the
   *  title doubles as the label. */
  ariaLabel?: string;
  /** Apply default `md` inner padding. Default `true`. Set `false` for
   *  edge-to-edge content (banners, media). */
  padded?: boolean;
  children: ReactNode;
}

export default function RailPanel({
  title,
  titleAction,
  ariaLabel,
  padded = true,
  children,
}: RailPanelProps) {
  const label = title ?? ariaLabel;
  return (
    <section
      aria-label={label}
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: padded ? 'var(--cr-space-md)' : 0,
      }}
    >
      {title && (
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 'var(--cr-space-sm)',
            marginBottom: 'var(--cr-space-sm)',
            // When the panel is unpadded, the title row needs its own
            // horizontal padding so it doesn't bleed against the card edge.
            paddingInline: padded ? 0 : 'var(--cr-space-md)',
            paddingTop: padded ? 0 : 'var(--cr-space-md)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--cr-text-4)',
            }}
          >
            {title}
          </h2>
          {titleAction && <div style={{ fontSize: 12, fontWeight: 600 }}>{titleAction}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
