'use client';

/**
 * Rail - the left/right side column for a Connect screen.
 *
 * Owns the responsive visibility (`xl:block`), the fixed pixel width, the
 * sticky positioning, and the vertical stacking of child panels. Children
 * are expected to be `<RailPanel>` instances (siblings) - the slot model
 * means new content (ads, widgets, promos) drops in by adding another
 * `<RailPanel>` to the children list, with zero rewrites to the screen.
 *
 * **Default widths** follow design-decisions doc §4.1: 240 px on the left
 * (compact nav-style cards), 320 px on the right (people / content cards
 * with avatars + meta). Pages that need a custom width pass `width`
 * explicitly.
 *
 * **Sticky scroll (LinkedIn / X tall-sidebar pattern).** The rail scrolls
 * WITH the feed until its content end is reached, then stops - never pinned
 * frozen at the top while the feed races past. We get this with one measured
 * `top`, recomputed on resize / content change:
 *
 *   top = min(HEADER_OFFSET, viewportHeight - contentHeight - BOTTOM_GAP)
 *
 *  - Short rail (content fits the viewport): the `min` picks `HEADER_OFFSET`,
 *    a normal top-stick that clears the 64 px sticky header.
 *  - Tall rail (content taller than the viewport): the right operand goes
 *    negative, so the sticky pins the rail's BOTTOM edge to the viewport
 *    bottom. The rail therefore scrolls up alongside the feed until its last
 *    panel is revealed, then sticks - and scrolling back up releases it so
 *    the top re-enters naturally. A fixed `top-20` (the old value) instead
 *    pinned the rail's TOP, freezing a tall rail with its lower panels
 *    permanently below the fold.
 *
 * Disable via `sticky={false}` for a page with a non-scrolling main column.
 *
 * Sticky stays on the inner wrapper (NOT the aside) on purpose. The aside is
 * a flex item in the `<ConnectPage>` row and inherits `align-self: stretch`,
 * so its height matches the feed's height - that taller bounding box is what
 * `position: sticky` needs to travel within. Applying sticky to the aside
 * itself would make it shrink-wrap to its content and pin the whole (short)
 * aside forever.
 *
 * **Hidden below `xl`** - by design. The Connect surfaces are mobile-first
 * and the rails are supplemental. Below `xl`, the main column owns the
 * full viewport width. Pages that want a different breakpoint can pass
 * `breakpoint` (one of `lg` / `xl` / `2xl`).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import RailFooter from './RailFooter';

export type RailSide = 'left' | 'right';
export type RailBreakpoint = 'lg' | 'xl' | '2xl';

export interface RailProps {
  side: RailSide;
  /** Fixed width in pixels. When omitted, the rail width comes from the
   *  sidebar-responsive `--cn-rail-left-w` / `--cn-rail-right-w` CSS
   *  variables in `globals.css` (240 / 320 expanded, 280 / 360 collapsed)
   *  so the rails breathe wider when the product sidebar collapses. Pass
   *  a number to opt out - e.g. for design-system / preview surfaces. */
  width?: number;
  /** Tailwind breakpoint at which the rail becomes visible. Default `xl`. */
  breakpoint?: RailBreakpoint;
  /** Sticky-positioned inside its viewport. Default `true`. */
  sticky?: boolean;
  /** Render the shared Connect footer (RailFooter) at the bottom of this rail.
   *  Only applies to `side="right"`. Default `true`; pass `false` on the dense
   *  manage consoles (storefront / company page) that stay footer-free. The
   *  shell's page-bottom footer auto-hides at this rail's breakpoint when this
   *  is shown - see the mutual-exclusion rule in app/globals.css. */
  footer?: boolean;
  /** Override the accessible label. Defaults to the i18n
   *  `connect.shell.rail.left` / `.right` string for the side. */
  ariaLabel?: string;
  children: ReactNode;
}

/** Hard-coded fallbacks used when the page is rendered outside the
 *  `DashboardLayout` (e.g. the `/design-system` gallery). Matches the
 *  expanded-sidebar values in `globals.css` (design-decisions §4.1:
 *  240 left, 320 right). */
const DEFAULT_WIDTH: Record<RailSide, number> = {
  left: 240,
  right: 320,
};

/** Maps a side to the CSS variable name set on
 *  `[data-sidebar-collapsed]` ancestors. */
const SIDE_VAR: Record<RailSide, string> = {
  left: '--cn-rail-left-w',
  right: '--cn-rail-right-w',
};

// Hardcoded class lists keep Tailwind's JIT compiler able to see every
// possible class at build time. Dynamic strings (`xl:block` ← `${bp}:block`)
// would compile to dead classes the build would strip.
const BREAKPOINT_BLOCK_CLASS: Record<RailBreakpoint, string> = {
  lg: 'hidden lg:block',
  xl: 'hidden xl:block',
  '2xl': 'hidden 2xl:block',
};

// The `top` offset is applied inline (it is computed per content height), so
// the class only toggles `position: sticky` at the chosen breakpoint.
const BREAKPOINT_STICKY_CLASS: Record<RailBreakpoint, string> = {
  lg: 'lg:sticky',
  xl: 'xl:sticky',
  '2xl': '2xl:sticky',
};

// 64 px sticky `TopHeader` (`h-16`) + 16 px breathing gap. The top-stick
// offset for a rail short enough to fit the viewport.
const HEADER_OFFSET = 80;
// Gap kept beneath a bottom-stuck (tall) rail so its last panel never sits
// flush against the viewport floor.
const BOTTOM_GAP = 24;

export default function Rail({
  side,
  width,
  breakpoint = 'xl',
  sticky = true,
  footer = true,
  ariaLabel,
  children,
}: RailProps) {
  const t = useTranslations('connect.shell');
  const innerRef = useRef<HTMLDivElement>(null);
  // Seed with the plain top-stick so the server paint + first client render
  // agree (no hydration mismatch); the effect refines it once heights are
  // measurable. Only tall rails diverge from this seed.
  const [stickyTop, setStickyTop] = useState(HEADER_OFFSET);

  useEffect(() => {
    if (!sticky) return;
    const inner = innerRef.current;
    if (!inner) return;

    const recompute = () => {
      const contentH = inner.scrollHeight;
      const viewportH = window.innerHeight;
      // Tall rail → negative top → bottom-stick; short rail → HEADER_OFFSET.
      setStickyTop(Math.min(HEADER_OFFSET, viewportH - contentH - BOTTOM_GAP));
    };

    recompute();
    // ResizeObserver catches panel mount/unmount (e.g. the strength card
    // disappearing at 100%); the resize listener catches viewport changes.
    const ro = new ResizeObserver(recompute);
    ro.observe(inner);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [sticky]);

  // When the caller passes an explicit `width`, honor it. Otherwise read
  // from the sidebar-responsive CSS var so the rail widens on
  // `[data-sidebar-collapsed='true']` automatically.
  const widthValue =
    width !== undefined ? `${width}px` : `var(${SIDE_VAR[side]}, ${DEFAULT_WIDTH[side]}px)`;
  const visibility = BREAKPOINT_BLOCK_CLASS[breakpoint];
  const stickyCls = sticky ? BREAKPOINT_STICKY_CLASS[breakpoint] : '';
  return (
    <aside
      aria-label={ariaLabel ?? t(side === 'left' ? 'rail.left' : 'rail.right')}
      className={`shrink-0 ${visibility}`}
      style={{ width: widthValue }}
    >
      <div
        ref={innerRef}
        className={stickyCls}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--cr-space-md)',
          top: sticky ? stickyTop : undefined,
        }}
      >
        {children}
        {/* Ambient footer at the rail bottom (right rail only). LinkedIn pattern:
            keeps the footer reachable on infinite pages where a page-bottom footer
            is never scrolled to. Pairs with the bottom footer via globals.css so
            only one shows. */}
        {side === 'right' && footer ? <RailFooter breakpoint={breakpoint} /> : null}
      </div>
    </aside>
  );
}
