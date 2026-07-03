'use client';

/**
 * `RatingStars` - the shared seller-rating display atom (marketplace Phase C,
 * R3). Renders a 0-5 average as five stars with fractional fill (a gold layer
 * clipped to `value/5`), plus an optional numeric label + review count.
 *
 * Display-only by default (a `<span>` with an a11y label). Pass `interactive`
 * + `onSelect` to use it as a 1-5 star INPUT (the write-review form) - then it
 * becomes a radiogroup of five buttons with hover preview + keyboard support.
 */

import { useState } from 'react';
import { Star } from 'lucide-react';

interface RatingStarsProps {
  /** The value to render: an average (display) or the current pick (input). */
  value: number;
  /** Total review count - shown after the stars when `showCount` is set. */
  count?: number;
  /** Star size in px. */
  size?: number;
  /** Show the numeric average + `(count)` beside the stars. */
  showCount?: boolean;
  /** Turn the atom into a 1-5 star picker. */
  interactive?: boolean;
  /** Pick handler (interactive mode). */
  onSelect?: (value: number) => void;
  /** Accessible label for the picker (interactive mode). */
  label?: string;
  className?: string;
}

const STAR_COLOR = 'var(--cr-warning, #f59e0b)';
const EMPTY_COLOR = 'var(--cr-border, #d4d4d8)';

/** Five flat stars in a single colour (the base + the clipped overlay reuse it). */
function StarRow({ size, color, fill }: { size: number; color: string; fill: boolean }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} size={size} color={color} fill={fill ? color : 'none'} strokeWidth={1.5} />
      ))}
    </span>
  );
}

export default function RatingStars({
  value,
  count,
  size = 16,
  showCount = false,
  interactive = false,
  onSelect,
  label,
  className,
}: RatingStarsProps) {
  const [hover, setHover] = useState(0);

  if (interactive) {
    const shown = hover || value;
    return (
      <span
        role="radiogroup"
        aria-label={label ?? 'Rating'}
        className={className}
        style={{ display: 'inline-flex', gap: 4 }}
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onClick={() => onSelect?.(n)}
            style={{
              background: 'none',
              border: 'none',
              padding: 2,
              cursor: 'pointer',
              lineHeight: 0,
              borderRadius: 'var(--cr-radius-sm, 6px)',
            }}
          >
            <Star
              size={size + 6}
              color={n <= shown ? STAR_COLOR : EMPTY_COLOR}
              fill={n <= shown ? STAR_COLOR : 'none'}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </span>
    );
  }

  // Display mode: clamp + clip a gold layer over the grey base.
  const clamped = Math.max(0, Math.min(5, value));
  const pct = (clamped / 5) * 100;
  const a11y =
    count !== undefined
      ? `${clamped.toFixed(1)} out of 5 stars, ${count} ${count === 1 ? 'review' : 'reviews'}`
      : `${clamped.toFixed(1)} out of 5 stars`;

  return (
    <span
      className={className}
      role="img"
      aria-label={a11y}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 0 }}>
        <StarRow size={size} color={EMPTY_COLOR} fill />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            overflow: 'hidden',
            display: 'inline-flex',
            whiteSpace: 'nowrap',
          }}
        >
          <StarRow size={size} color={STAR_COLOR} fill />
        </span>
      </span>
      {showCount && (
        <span style={{ fontSize: 12.5, color: 'var(--cr-text-3, #6b7280)', fontWeight: 600 }}>
          {clamped.toFixed(1)}
          {count !== undefined && (
            <span style={{ fontWeight: 400, color: 'var(--cr-text-4, #9ca3af)' }}> ({count})</span>
          )}
        </span>
      )}
    </span>
  );
}
