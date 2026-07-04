'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Frame } from './mockups';

/**
 * "Three things, one place" hero mock — the anti-spreadsheet hero visual. Shows
 * ManekHR's three core jobs at a glance inside one product window (a staff
 * record, a marked-present attendance row, and a computed salary line), leading
 * with the real workflow, never a fake dashboard full of invented numbers.
 *
 * This is the ONLY client mock: it auto-cycles its Team -> Attendance -> Salary
 * views so the hero feels alive in the first seconds. The first paint is
 * static (SSR, index 0, NO entrance animation -> LCP-safe); cycling starts only
 * after hydration and only when motion is allowed (prefers-reduced-motion stays
 * on the first view). As it cycles, the active tile is SPOTLIT (full opacity +
 * gold halo + lift) while the other two recede to 40%, so the tab highlight
 * visibly drives the panel instead of a glow nobody notices (see HeroTile +
 * .mkt-cycle-glow in globals.css).
 *
 * Cross-module links: shared Frame primitive lives in mockups.tsx. Decorative
 * (aria-hidden via Frame); no fabricated counts or fake people.
 */
type Job = 'team' | 'attendance' | 'salary';

const JOB_LABEL: Record<Job, string> = {
  team: 'Team',
  attendance: 'Attendance',
  salary: 'Salary',
};

/** Tiny right-aligned tag marking which of the three jobs a hero tile shows. */
function HeroJobTag({ job }: { job: Job }) {
  const style =
    job === 'salary'
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

/** Staff record tile — a karigar's profile card. */
function TeamContent() {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--cr-gold-100)] text-[0.66rem] font-bold text-[var(--cr-gold-700)]">
          RP
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">
            Rajesh Patel
          </p>
          <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">
            Karigar · joined Jan 2026
          </p>
        </div>
        <HeroJobTag job="team" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-[10px] bg-[var(--cr-cream)] px-2.5 py-2">
          <p className="mkt-mono text-[0.56rem] text-[var(--cr-neutral-500)]">Role</p>
          <p className="text-[0.72rem] font-semibold text-[var(--cr-charcoal)]">Polisher</p>
        </div>
        <div className="rounded-[10px] bg-[var(--cr-cream)] px-2.5 py-2">
          <p className="mkt-mono text-[0.56rem] text-[var(--cr-neutral-500)]">Status</p>
          <p className="text-[0.72rem] font-semibold text-[var(--cr-emerald-700,var(--cr-charcoal))]">
            Active
          </p>
        </div>
      </div>
    </>
  );
}

/** Attendance tile — a marked-present daily record. */
function AttendanceContent() {
  return (
    <>
      <div className="flex items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--cr-indigo-600)] text-[0.72rem] font-bold text-white">
          RP
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">
            Rajesh Patel
          </p>
          <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">Today · 9:02 AM</p>
        </div>
        <HeroJobTag job="attendance" />
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-2.5 py-1.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--cr-indigo-600)] text-white">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M3 8.5 6.5 12 13 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className="flex-1 truncate text-[0.68rem] font-semibold text-[var(--cr-indigo-700)]">
          Marked present
        </span>
      </div>
    </>
  );
}

/** Salary tile — a computed monthly payout line. */
function SalaryContent() {
  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8rem] font-semibold text-[var(--cr-charcoal)]">
            Rajesh Patel
          </p>
          <p className="mkt-mono text-[0.58rem] text-[var(--cr-neutral-500)]">June 2026 · payout</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--cr-gold-100)] px-2 py-0.5 text-[0.58rem] font-semibold text-[var(--cr-gold-700)]">
          Auto-calculated
        </span>
        <HeroJobTag job="salary" />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 rounded-[11px] border border-[var(--cr-neutral-200)] bg-[var(--cr-cream)] px-2.5 py-1.5">
        <span className="text-[0.68rem] text-[var(--cr-neutral-600)]">26 days present</span>
        <span className="shrink-0 text-[0.78rem] font-semibold text-[var(--cr-indigo-700)]">
          ₹18,400
        </span>
      </div>
    </>
  );
}

export function NetworkHeroMock() {
  const jobs: Job[] = ['team', 'attendance', 'salary'];

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
    team: <TeamContent />,
    attendance: <AttendanceContent />,
    salary: <SalaryContent />,
  };

  return (
    // Wrapper carries the pause-on-hover + visibility observer; the Frame
    // stays decorative (aria-hidden), so hover is the only interaction here.
    <div
      ref={rootRef}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <Frame label="manekhr.in / dashboard">
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
