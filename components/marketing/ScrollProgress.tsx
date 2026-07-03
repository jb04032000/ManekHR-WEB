'use client';

import { useEffect, useRef } from 'react';

/**
 * Thin scroll-progress bar pinned above the navbar (/connect only). Updates a
 * single CSS custom property (`--mkt-progress`) read by `.mkt-progress`, which
 * uses transform: scaleX — so scrolling costs no layout work. rAF-throttled.
 *
 * Watch: sits at z-50 (above the z-40 navbar) as a 2px line; decorative only.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, doc.scrollTop / max)) : 0;
      ref.current?.style.setProperty('--mkt-progress', String(progress));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="mkt-progress fixed inset-x-0 top-0 z-50 h-[2px] bg-[var(--cr-gold-500)]"
    />
  );
}
