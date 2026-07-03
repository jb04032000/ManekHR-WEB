'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatBubble, FABRIC, Frame, PRODUCT, Swatch, VerifiedPill, Waveform } from './mockups';

/**
 * Network-led "three-in-one" hero mock — the anti-ecommerce hero visual. Shows
 * all three jobs at a glance inside one product window (a feed/network post, a
 * VERIFIED seller enquiry, and a job with voice-apply), leading with people and
 * activity, never hard price tags.
 *
 * This is the ONLY client mock: it auto-cycles its Network -> Marketplace ->
 * Hiring views so the hero feels alive in the first seconds. The first paint is
 * static (SSR, index 0, NO entrance animation -> LCP-safe); cycling starts only
 * after hydration and only when motion is allowed (prefers-reduced-motion stays
 * on the first view). As it cycles, the active tile is SPOTLIT (full opacity +
 * gold halo + lift) while the other two recede to 40%, so the tab highlight
 * visibly drives the panel instead of a glow nobody notices (see HeroTile +
 * .mkt-cycle-glow in globals.css).
 *
 * `variant` gives `/` (home) and `/connect` their own order, accent, and sample
 * content. Cross-module links: shared primitives (Frame/Swatch/VerifiedPill/
 * ChatBubble/Waveform) live in mockups.tsx. Decorative (aria-hidden via Frame);
 * no fabricated counts or fake people.
 */
type Job = 'network' | 'market' | 'hire';

const JOB_LABEL: Record<Job, string> = {
  network: 'Network',
  market: 'Marketplace',
  hire: 'Hiring',
};

/** Tiny right-aligned tag marking which of the three jobs a hero tile shows. */
function HeroJobTag({ job }: { job: Job }) {
  const style =
    job === 'market'
      ? 'bg-[var(--cr-gold-100)] text-[var(--cr-gold-700)]'
      : 'bg-[var(--cr-indigo-50)] text-[var(--cr-indigo-700)]';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[0.55rem] font-semibold tracking-[0.05em] uppercase ${style}`}
    >
      {JOB_LABEL[job]}
    </span>
  );
}

/**
 * Wraps a tile with the spotlight effect. While the demo is cycling, the active
 * tile stays full + gold-haloed + lifted while the other two recede to 40% — so
 * the tab highlight has a VISIBLE effect on the panel (motion conveys meaning),
 * not a glow nobody notices. Opacity-only, so no layout shift. Before hydration
 * and under prefers-reduced-motion `cycling` is false, so all three render full +
 * flat (a static "three jobs at once" view) — keeping the first paint LCP-safe.
 */
function HeroTile({
  active,
  cycling,
  children,
}: {
  active: boolean;
  cycling: boolean;
  children: ReactNode;
}) {
  const spotlight = active && cycling;
  return (
    <div className="relative" data-mkt-active={spotlight}>
      <span className="mkt-cycle-glow" aria-hidden="true" />
      <div
        className={`relative rounded-[14px] border border-[var(--cr-neutral-200)] bg-white p-3 transition-[opacity,box-shadow] duration-[450ms] ease-out ${
          spotlight
            ? 'opacity-100 shadow-[0_12px_30px_-16px_rgba(11,110,79,0.4)]'
            : cycling
              ? 'opacity-40'
              : 'opacity-100'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function NetworkContent({
  name,
  initials,
  post,
  tiles,
}: {
  name: string;
  initials: string;
  post: string;
  // The three post images, so the tiles match the post's claim. Home's
  // "Embroidery Unit / aari-work" gets embroidery photos (keep in sync with the
  // FeedMock post in mockups.tsx, same unit); /connect's woven-fabric post keeps
  // the abstract FABRIC satin swatches. Layered over the gradient fallback.
  tiles: readonly [string, string, string];
}) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--cr-gold-100)] text-[0.66rem] font-bold text-[var(--cr-gold-700)]">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">{name}</p>
          <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">
            Surat · in your trade
          </p>
        </div>
        <HeroJobTag job="network" />
      </div>
      <p className="pt-2 text-[0.72rem] leading-relaxed text-[var(--cr-neutral-600)]">{post}</p>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <Swatch
          from="#5b2a86"
          to="#9b6dd6"
          motif="embroidery"
          src={tiles[0]}
          className="aspect-[5/3] w-full"
        />
        <Swatch
          from="#1f5f5b"
          to="#52b3a4"
          motif="weave"
          src={tiles[1]}
          className="aspect-[5/3] w-full"
        />
        <Swatch
          from="#9a6a1e"
          to="#d8af55"
          motif="zari"
          src={tiles[2]}
          className="aspect-[5/3] w-full"
        />
      </div>
    </>
  );
}

function MarketContent({
  shop,
  initial,
  categories,
}: {
  shop: string;
  initial: string;
  categories: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--cr-indigo-600)] text-[0.72rem] font-bold text-white">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">{shop}</p>
            <VerifiedPill />
          </div>
          <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">{categories}</p>
        </div>
        <HeroJobTag job="market" />
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-2.5 py-1.5">
        <Swatch
          from="#7b2d4e"
          to="#c0617f"
          motif="embroidery"
          src={FABRIC.maroon}
          className="h-8 w-8 shrink-0 rounded-[8px]"
        />
        <span className="flex-1 truncate text-[0.68rem] text-[var(--cr-neutral-600)]">
          Buyer enquiry: maroon, 20 pieces
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-[8px] bg-[var(--cr-indigo-600)] px-2 py-1 text-[0.62rem] font-semibold text-white">
          <ChatBubble className="h-3 w-3" />
          Reply
        </span>
      </div>
    </>
  );
}

function HireContent({ title, kind }: { title: string; kind: string }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">{title}</p>
          <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">Surat · {kind}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--cr-gold-100)] px-2 py-0.5 text-[0.58rem] font-semibold text-[var(--cr-gold-700)]">
          Skill match
        </span>
        <HeroJobTag job="hire" />
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-2.5 py-1.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-white">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M8 2a2 2 0 0 1 2 2v4a2 2 0 0 1-4 0V4a2 2 0 0 1 2-2zM4 8a4 4 0 0 0 8 0M8 12v2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <Waveform />
        <span className="shrink-0 text-[0.64rem] font-semibold text-[var(--cr-indigo-700)]">
          Apply by voice
        </span>
      </div>
    </>
  );
}

export function NetworkHeroMock({ variant = 'home' }: { variant?: 'home' | 'connect' }) {
  const isConnect = variant === 'connect';
  // Legend + tile order per page (also the cycle order, left to right).
  const jobs: Job[] = isConnect ? ['network', 'hire', 'market'] : ['network', 'market', 'hire'];

  // Index 0 on the server (static first paint); cycles after hydration unless
  // the visitor prefers reduced motion.
  const [active, setActive] = useState(0);
  // `cycling` gates the spotlight: false on the server + first paint (and forever
  // under reduced motion) so all tiles render full + flat; flips true once the
  // interval starts, so the active-tile spotlight only appears with real motion.
  const [cycling, setCycling] = useState(false);
  // Cycle etiquette: hovering pauses (the reader is inspecting a tile, don't
  // rotate it away) and the interval stops while the mock is offscreen (the
  // ProductTour renders a second instance the hero has long scrolled past).
  // The spotlight stays on the current tile while paused - only motion stops.
  const rootRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Defer the spotlight to the next frame (a callback, not a synchronous
    // in-effect setState) so the first paint stays the flat all-full view, then
    // the spotlight fades in.
    const raf = window.requestAnimationFrame(() => setCycling(true));
    if (paused || !inView) return () => window.cancelAnimationFrame(raf);
    const id = window.setInterval(() => setActive((i) => (i + 1) % 3), 2800);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearInterval(id);
    };
  }, [paused, inView]);

  const content: Record<Job, ReactNode> = {
    network: (
      <NetworkContent
        name={isConnect ? 'Weaving Unit' : 'Embroidery Unit'}
        initials={isConnect ? 'WU' : 'EU'}
        post={
          isConnect
            ? 'Fresh power-loom lot off the machine. Open to bulk orders this week.'
            : 'New aari-work design on georgette. Taking job-work orders this week.'
        }
        // Home Embroidery Unit shows the owner's three embroidery-unit photos;
        // /connect Weaving Unit keeps the woven satin swatches.
        tiles={
          isConnect
            ? [FABRIC.purple, FABRIC.green, FABRIC.gold]
            : [PRODUCT.embroideryUnit1, PRODUCT.embroideryUnit5, PRODUCT.embroideryUnit4]
        }
      />
    ),
    market: (
      <MarketContent
        shop={isConnect ? 'Cotton Fabrics Co.' : 'Surat Silk House'}
        initial={isConnect ? 'C' : 'S'}
        categories={isConnect ? 'Greige · cotton lots' : 'Sarees · dress material'}
      />
    ),
    hire: (
      <HireContent
        title={isConnect ? 'Power-loom operator' : 'Embroidery karigar'}
        kind={isConnect ? 'full-time' : 'piece-rate'}
      />
    ),
  };

  return (
    // Wrapper carries the pause-on-hover + visibility observer; the Frame
    // stays decorative (aria-hidden), so hover is the only interaction here.
    <div
      ref={rootRef}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <Frame label={isConnect ? 'manekhr.in / connect / feed' : 'manekhr.in / connect'}>
        <div className="flex flex-wrap items-center gap-1.5">
          {jobs.map((job, index) => {
            const isActive = index === active;
            return (
              <span
                key={job}
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.62rem] font-semibold transition-colors duration-500 ${
                  isActive
                    ? 'bg-[var(--cr-indigo-600)] text-white'
                    : 'border border-[var(--cr-neutral-200)] text-[var(--cr-neutral-600)]'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive ? 'bg-[var(--cr-gold-400)]' : 'bg-[var(--cr-neutral-300)]'
                  }`}
                  aria-hidden="true"
                />
                {JOB_LABEL[job]}
              </span>
            );
          })}
        </div>
        <div className="mt-3 space-y-2.5">
          {jobs.map((job, index) => (
            <HeroTile key={job} active={index === active} cycling={cycling}>
              {content[job]}
            </HeroTile>
          ))}
        </div>
      </Frame>
    </div>
  );
}
