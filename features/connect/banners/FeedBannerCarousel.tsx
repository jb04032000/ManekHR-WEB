'use client';

/**
 * FeedBannerCarousel - the admin-curated promo carousel shown in the Connect
 * feed, BETWEEN the composer card and the module tabs (see FeedScreen). Data
 * comes from the public `GET /connect/banners` read (fetched server-side in the
 * feed page and passed down); the list is already filtered to the live window
 * and sorted by order.
 *
 * Behaviour (per spec): auto-advance ~5s, pause on hover/focus, swipe on touch,
 * prev/next + dot controls, lazy images, a FIXED aspect ratio so there is no
 * layout shift while images load. A banner with a `linkUrl` opens in a new tab
 * (safe rel); a banner without one is non-clickable. Renders NOTHING when the
 * list is empty. Cross-links: features/connect/banners/banner.actions.ts (fetch),
 * FeedScreen.tsx (mount point).
 *
 * Custom (not AntD `<Carousel>`) so pause-on-hover AND pause-on-focus, keyboard
 * arrows, lazy loading, and the no-CLS fixed ratio are all directly controllable
 * and unit-testable. Styled with inline `--cr-*` tokens, matching FeedScreen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toAbsoluteBannerUrl } from './banner-url';
import type { FeedBanner } from './banner.types';

/** Aspect ratio of the banner frame (width:height). ~4.8:1 letterbox. */
const ASPECT_RATIO = '24 / 5';
const AUTO_ADVANCE_MS = 5000;

interface FeedBannerCarouselProps {
  banners: FeedBanner[];
}

export default function FeedBannerCarousel({ banners }: FeedBannerCarouselProps) {
  const t = useTranslations('connect.feed.banners');
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const count = banners.length;
  const multi = count > 1;

  // Keep the active index valid if the banner set shrinks between renders.
  const active = count > 0 ? index % count : 0;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );
  const prev = useCallback(() => go(active - 1), [go, active]);
  const next = useCallback(() => go(active + 1), [go, active]);

  // Auto-advance, paused on hover/focus (and never runs for a single banner).
  useEffect(() => {
    if (!multi || paused) return;
    const id = window.setInterval(() => setIndex((i) => i + 1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [multi, paused]);

  // Touch swipe (mobile). A >40px horizontal drag advances / retreats.
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    touchStartX.current = null;
  };

  // Empty -> render nothing (the feed shows no carousel chrome at all).
  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('regionLabel')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        position: 'relative',
        borderRadius: 'var(--cr-radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--cr-border)',
        background: 'var(--cr-surface-muted, var(--cr-surface))',
      }}
    >
      {/* Fixed-ratio viewport: reserves height before images load (no CLS). */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: ASPECT_RATIO }}>
        {/* Sliding track; transform is the only thing that animates. */}
        <div
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          style={{
            display: 'flex',
            height: '100%',
            transform: `translateX(-${active * 100}%)`,
            transition: 'transform 350ms ease',
          }}
        >
          {banners.map((b) => {
            const img = (
              // Remote signed R2 URL; next/image proxying adds no value for a
              // short-lived admin banner. Lazy plain <img> keeps it simple.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={b.imageUrl}
                alt={b.alt}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            );
            // Normalise to an absolute URL so a bare domain ("manekhr.in")
            // opens the external site, not `/connect/manekhr.in`.
            const href = toAbsoluteBannerUrl(b.linkUrl);
            return (
              <div key={b.id} style={{ flex: '0 0 100%', height: '100%' }}>
                {href ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'block', width: '100%', height: '100%' }}
                  >
                    {img}
                  </a>
                ) : (
                  img
                )}
              </div>
            );
          })}
        </div>
      </div>

      {multi && (
        <>
          <button
            type="button"
            aria-label={t('previous')}
            onClick={prev}
            style={arrowStyle('left')}
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button type="button" aria-label={t('next')} onClick={next} style={arrowStyle('right')}>
            <ChevronRight size={18} aria-hidden />
          </button>

          {/* Dot pager. Each dot names its 1-based slide index for a11y. */}
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {banners.map((b, i) => (
              <button
                key={b.id}
                type="button"
                aria-label={t('goToSlide', { index: i + 1 })}
                aria-current={i === active}
                onClick={() => go(i)}
                style={{
                  width: i === active ? 18 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: i === active ? 'var(--cr-primary, #fff)' : 'rgba(255,255,255,0.55)',
                  transition: 'width 200ms ease',
                }}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/** Prev/next arrow button styling (absolute, vertically centred). */
function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 8,
    transform: 'translateY(-50%)',
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '50%',
    border: 'none',
    cursor: 'pointer',
    color: '#fff',
    background: 'rgba(0,0,0,0.4)',
  };
}
