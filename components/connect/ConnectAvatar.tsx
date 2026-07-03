'use client';

/**
 * ConnectAvatar - a Connect-only wrapper around the shared `DsAvatar` that
 * carries an "open to" status so the signal travels everywhere a person avatar
 * appears (feed rows, cards, profile header, search results). Renders a
 * LinkedIn-style floating ring around the photo plus, at large sizes, a status
 * pill; at small sizes a status dot keeps it legible without breaking layout.
 *
 * Cross-module links:
 *  - wraps `DsAvatar` (components/ui/DsBadge) - do NOT change that primitive here.
 *  - generalizes features/connect/profile/AvatarStatusRibbon (a later task folds
 *    that pill out and routes it through this wrapper). Labels share the same
 *    i18n namespace: connect.profile.intents.ribbon.{work,hiring}.
 *
 * Gotchas:
 *  - status null/undefined => return the bare DsAvatar, zero extra DOM (the
 *    common case stays allocation-free and visually identical to today).
 *  - the ring/dot/pill are decorative (aria-hidden); the status is announced via
 *    a visually-hidden sr-only span so screen readers still hear it at any size.
 *  - keep statusColor + size breakpoints in sync with the design tokens.
 */
import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { DsAvatar } from '@/components/ui';
// Avatars never need more than ~160px; request that variant (no-op until CDN env set).
import { imageVariant } from '@/lib/media/imageUrl';

export type ConnectOpenStatus = 'work' | 'hiring' | null;

interface ConnectAvatarProps {
  name?: string;
  src?: string;
  size?: number; // matches DsAvatar; default 36
  status?: ConnectOpenStatus;
  hideLabel?: boolean; // force ring-only even at large size; default false
  style?: CSSProperties;
}

// success token carries a hard-coded fallback because the ring reads on surfaces
// that may not define --cr-success in every theme context.
const STATUS_COLOR: Record<'work' | 'hiring', string> = {
  hiring: 'var(--cr-primary)',
  work: 'var(--cr-success, #16a34a)',
};

// At/above this avatar size the pill fits; below it we fall back to a dot.
const LABEL_MIN_SIZE = 64;

export default function ConnectAvatar({
  name,
  src,
  size = 36,
  status,
  hideLabel = false,
  style,
}: ConnectAvatarProps) {
  // Down-size storage avatars to ~160px once; pass the variant to every branch.
  const variantSrc = imageVariant(src, { w: 160 });
  // Common case: no status => bare avatar, no wrapper, no hook, no allocations.
  // The status branch lives in a child so this path never calls useTranslations
  // (keeps rules-of-hooks happy AND the null path cheap).
  if (!status) {
    return <DsAvatar name={name} src={variantSrc} size={size} style={style} />;
  }
  return (
    <ConnectAvatarWithStatus
      name={name}
      src={variantSrc}
      size={size}
      status={status}
      hideLabel={hideLabel}
      style={style}
    />
  );
}

// Always-rendered-with-a-status inner component: the hook below is now
// unconditional, so it satisfies react-hooks/rules-of-hooks.
function ConnectAvatarWithStatus({
  name,
  src,
  size = 36,
  status,
  hideLabel = false,
  style,
}: ConnectAvatarProps & { status: 'work' | 'hiring' }) {
  const t = useTranslations('connect.profile.intents.ribbon');
  const label = t(status);
  const color = STATUS_COLOR[status];

  // Floating ring: first shadow is a surface-colored gap so the colored ring
  // reads as a deliberate ring (not a touching border), LinkedIn style.
  const gap = Math.max(2, Math.round(size * 0.05));
  const ring = Math.max(2, Math.round(size * 0.06));
  const ringShadow = `0 0 0 ${gap}px var(--cr-surface), 0 0 0 ${gap + ring}px ${color}`;

  const showPill = size >= LABEL_MIN_SIZE && !hideLabel;

  // Pill metrics. Drop the pill clear of the floating ring (gap + ring) plus its
  // own height so it sits just BELOW the round border instead of covering the
  // ring's bottom arc. pillFont feeds both the text size and the drop math.
  const pillFont = Math.max(9, Math.round(size * 0.12));
  // Align the pill's BOTTOM edge with the ring's bottom (gap + ring): the pill
  // overlaps the lower part of the photo and bottom-aligns with the round
  // border, LinkedIn-style. Verified the alignment against a ring-bottom guide.
  const pillDrop = gap + ring;

  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span
        aria-hidden
        style={{ borderRadius: '50%', boxShadow: ringShadow, display: 'inline-flex' }}
      >
        <DsAvatar name={name} src={src} size={size} style={style} />
      </span>

      {showPill ? (
        // Bottom-center status pill, large avatars only. This carries the
        // visible (and accessible) status text, so no sr-only twin is needed.
        <span
          style={{
            position: 'absolute',
            bottom: `-${pillDrop}px`,
            left: '50%',
            transform: 'translateX(-50%)',
            background: color,
            color: '#ffffff',
            borderRadius: 'var(--cr-radius-full)',
            padding: '2px 8px',
            fontSize: `${pillFont}px`,
            fontWeight: 700,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
            border: '2px solid var(--cr-surface)',
          }}
        >
          {label}
        </span>
      ) : (
        // Small / ring-only: a status dot keeps the signal visible without
        // a wide pill that would overflow a compact avatar.
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: `${Math.max(8, Math.round(size * 0.28))}px`,
            height: `${Math.max(8, Math.round(size * 0.28))}px`,
            borderRadius: '50%',
            background: color,
            border: '2px solid var(--cr-surface)',
          }}
        />
      )}

      {/* Ring + dot are decorative (aria-hidden); when there's no visible pill,
          announce the status here so screen readers still hear it. */}
      {!showPill && <span className="sr-only">{label}</span>}
    </span>
  );
}
