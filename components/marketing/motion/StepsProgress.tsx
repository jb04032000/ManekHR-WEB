'use client';

import { useEffect, useRef } from 'react';

/**
 * Scroll-linked progress line for the "how it works" steps. A thin rail behind
 * the three step badges (sm+ only, where they sit in a row) whose gradient fill
 * grows from the first step to the last as the section scrolls through the
 * viewport. Sets `--mkt-steps-fill` (0..1) via rAF; the fill itself is a
 * transform-only scaleX (see .mkt-steps-fill in globals.css), so it stays cheap.
 *
 * Progressive enhancement: with no JS the fill defaults to full (a static
 * connector). prefers-reduced-motion pins it full immediately, no listener.
 * Cross-module link: rendered by LandingSteps; pairs with the .mkt-steps-fill
 * rule in globals.css.
 */
export function StepsProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.style.setProperty('--mkt-steps-fill', '1');
      return;
    }
    const section = el.closest('section');
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = (section ?? el).getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // 0 when the section first enters at 80% of the viewport, 1 once it has
      // scrolled up past the 40% mark — a gentle fill across the section.
      const total = rect.height + vh * 0.4;
      const progress = Math.max(0, Math.min(1, (vh * 0.8 - rect.top) / total));
      el.style.setProperty('--mkt-steps-fill', String(progress));
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
    // The rail must span badge-1-centre to badge-3-centre. LandingSteps lays the
    // badges out LEFT-aligned in each grid column (sm:items-start), so a badge
    // centre is at (column-left + 20px badge radius), NOT the column centre — the
    // old left/right-[16.66%] (column centres) left the line floating 169px right
    // of badge 1 and overshooting past badge 3. left-5 = the 20px radius; the
    // right offset = one grid track minus that radius: (100% - 2*gap)/3 - 1.25rem
    // = 33.3333% - 2.25rem, with gap = LandingSteps' sm:gap-6 (1.5rem). Keep in
    // sync with LandingSteps' badge size + grid gap or the line drifts off the badges.
    <div
      ref={ref}
      className="pointer-events-none absolute top-5 right-[calc(33.3333%-2.25rem)] left-5 hidden h-[3px] sm:block"
      aria-hidden="true"
    >
      <div className="h-full w-full overflow-hidden rounded-full bg-[var(--cr-neutral-200)]">
        <div className="mkt-steps-fill h-full w-full rounded-full" />
      </div>
    </div>
  );
}
