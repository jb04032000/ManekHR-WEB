'use client';

/**
 * PhotoCarousel - one photo per slide for a `photo` post whose author chose
 * `mediaLayout: 'carousel'` (Phase 3 - Feed).
 *
 * A native CSS scroll-snap track (best mobile swipe, no slide cloning, SSR-safe)
 * wrapped in an AntD `Image.PreviewGroup`, so a tap opens the same lightbox
 * (zoom / rotate / prev-next / keyboard, focus-trapped) the grid uses. Each
 * photo registers once in the preview group (no react-slick clones), so the
 * lightbox order and count stay correct.
 *
 * The work is shown WHOLE - `object-fit: contain` on a fixed-height frame, never
 * cropped (a textile / embroidery showcase). No autoplay (WCAG 2.2.2 +
 * `prefers-reduced-motion`); bounded (no infinite wrap). Dots + a "N / M" counter
 * give a wordless multiplicity cue for low-literacy users. Gated by the caller to
 * 2+ photos.
 *
 * JIT shared component (Phase 3). Rendered in isolation on `/design-system`.
 */

import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PostMedia } from '@/features/connect/feed.types';
// Right-sized CDN variants per slide; full URL stays in the lightbox.
import { imageVariant } from '@/lib/media/imageUrl';
// Shared "discourage download" props (right-click + drag guard) for member media.
import { noDownloadImageProps } from '@/lib/connect/media-guard';

export default function PhotoCarousel({
  media,
  eagerFirst = false,
}: {
  media: PostMedia[];
  /** When true, the first slide paints eagerly (above-the-fold first post). */
  eagerFirst?: boolean;
}) {
  const t = useTranslations('connect.feed.post');
  const trackRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [active, setActive] = useState(0);
  const total = media.length;
  const altText = t('imageAlt');

  // Active-slide tracking via IntersectionObserver - jitter-free vs a debounced
  // scroll listener. The most-visible slide wins.
  useEffect(() => {
    const root = trackRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          const index = slideRefs.current.indexOf(entry.target as HTMLDivElement);
          if (index === -1) continue;
          if (!best || entry.intersectionRatio > best.ratio) {
            best = { index, ratio: entry.intersectionRatio };
          }
        }
        if (best && best.ratio > 0) setActive(best.index);
      },
      { root, threshold: [0.25, 0.5, 0.75, 1] },
    );
    for (const el of slideRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [total]);

  const scrollToSlide = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(total - 1, index));
      const el = slideRefs.current[clamped];
      if (!el) return;
      const reduce =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({
        behavior: reduce ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    },
    [total],
  );

  // Arrow keys move slides; Home/End jump to the ends (APG carousel keyboard).
  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        scrollToSlide(active + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        scrollToSlide(active - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToSlide(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToSlide(total - 1);
      }
    },
    [active, total, scrollToSlide],
  );

  const arrowStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [side]: 8,
    width: 34,
    height: 34,
    display: 'grid',
    placeItems: 'center',
    border: 'none',
    borderRadius: 'var(--cr-radius-full)',
    background: 'rgba(14,24,68,0.55)',
    color: '#fff',
    cursor: 'pointer',
  });

  return (
    <div
      role="region"
      aria-roledescription={t('carousel.roleDescription')}
      aria-label={t('carousel.region')}
      tabIndex={0}
      onKeyDown={onKeyDown}
      style={{ marginTop: 12 }}
    >
      {/* Image area - the scroll-snap track + overlaid arrows + counter. */}
      <div style={{ position: 'relative' }}>
        <Image.PreviewGroup>
          <div
            ref={trackRef}
            style={{
              display: 'flex',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              background: 'var(--cr-surface-2)',
            }}
          >
            {media.map((item, i) => (
              <div
                key={`${item.url}-${i}`}
                ref={(el) => {
                  slideRefs.current[i] = el;
                }}
                role="group"
                aria-roledescription={t('carousel.slideRole')}
                aria-label={t('carousel.slide', { current: i + 1, total })}
                style={{
                  flex: '0 0 100%',
                  scrollSnapAlign: 'center',
                  height: 'min(70vw, 460px)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <Image
                  // Slide fetches a ~600px variant; lightbox keeps the original.
                  src={imageVariant(item.url, { w: 600 })}
                  preview={{ src: item.url }}
                  alt={item.caption?.trim() || altText}
                  // Block right-click "Save image as" + drag-save on the photo.
                  {...noDownloadImageProps}
                  width="100%"
                  height="100%"
                  loading={eagerFirst && i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  style={{ objectFit: 'contain', display: 'block' }}
                  styles={{ root: { width: '100%', height: '100%', display: 'block' } }}
                />
              </div>
            ))}
          </div>
        </Image.PreviewGroup>

        {/* Prev / next - visible affordance on desktop; reachable by keyboard on
            every device. Bounded: disabled at the ends. */}
        <button
          type="button"
          aria-label={t('carousel.prev')}
          onClick={() => scrollToSlide(active - 1)}
          disabled={active === 0}
          style={{ ...arrowStyle('left'), opacity: active === 0 ? 0.4 : 1 }}
        >
          <ChevronLeft size={18} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={t('carousel.next')}
          onClick={() => scrollToSlide(active + 1)}
          disabled={active === total - 1}
          style={{ ...arrowStyle('right'), opacity: active === total - 1 ? 0.4 : 1 }}
        >
          <ChevronRight size={18} aria-hidden />
        </button>

        {/* Numeric "N / M" - a wordless orientation cue. The per-slide aria-label
            already announces position to a screen reader, so this is decorative. */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            padding: '2px 10px',
            borderRadius: 'var(--cr-radius-full)',
            background: 'rgba(14,24,68,0.55)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {t('carousel.counter', { current: active + 1, total })}
        </div>
      </div>

      {/* Dot indicators - a persistent multiplicity cue + a tap target per photo. */}
      <div
        role="group"
        aria-label={t('carousel.dots')}
        style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '10px 0 2px' }}
      >
        {media.map((item, i) => (
          <button
            key={`dot-${item.url}-${i}`}
            type="button"
            aria-label={t('carousel.goTo', { index: i + 1 })}
            aria-current={i === active}
            onClick={() => scrollToSlide(i)}
            style={{
              width: i === active ? 22 : 8,
              height: 8,
              padding: 0,
              border: 'none',
              borderRadius: 'var(--cr-radius-full)',
              background: i === active ? 'var(--cr-primary)' : 'var(--cr-border)',
              cursor: 'pointer',
              transition: 'width 0.2s ease, background 0.2s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}
