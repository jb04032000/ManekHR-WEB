/**
 * Connect ad placements + provider resolution - a future-proof seam.
 *
 * Pages declare named ad PLACEMENTS via `<AdSlot placement="..." />`; the
 * provider here decides what fills them. Today it is a no-op: no ad network is
 * wired, so `resolveAd` returns `null` and the slot renders nothing. A house
 * ad-management system or an external network (Google GAM / AdSense) plugs in
 * here later behind a flag, with ZERO change to the pages that declare slots.
 *
 * Any external ad network is a PAID dependency (ENGINEERING-STANDARDS #14) and
 * must be flagged for the owner when it lands; consent / frequency / targeting
 * policy also belong in this module, not in the page components.
 */

/** A named ad placement. Add new placements here as surfaces declare them. */
export type AdPlacement =
  | 'connect.left.top'
  | 'connect.right.top'
  | 'connect.right.mid'
  | 'connect.marketplace.grid';

/**
 * Coarse SHAPE of a placement, used to reserve space before an AdSense fill.
 * Rail = a vertical column unit; grid = an in-grid native cell. Kept here next to
 * the placement union so the AdSense unit (`GoogleAdUnit`) and its no-fill house
 * fallback (`HouseAdFallback`) reserve identical space (a shift-free swap).
 */
export type AdFormat = 'rail' | 'grid';

/** Map each placement to its layout shape. Keep in sync with AdPlacement. */
export const AD_PLACEMENT_FORMAT: Record<AdPlacement, AdFormat> = {
  'connect.left.top': 'rail',
  'connect.right.top': 'rail',
  'connect.right.mid': 'rail',
  'connect.marketplace.grid': 'grid',
};

/**
 * Reserved min-height (Tailwind classes) applied to an ad unit BEFORE the ad
 * fills, so an unfilled or still-loading slot holds its space instead of popping
 * in and shifting content (CLS). Floors, not fixed heights: a taller responsive
 * fill grows downward (rails have nothing below them in the read, so growth is
 * safe). Rail: 250px (the classic medium-rectangle) up to 300px on xl; grid:
 * 280px to match a product/company card cell.
 */
export const AD_RESERVED_MIN_HEIGHT: Record<AdFormat, string> = {
  rail: 'min-h-[250px] xl:min-h-[300px]',
  grid: 'min-h-[280px]',
};

/** Reserved-height Tailwind classes for a placement (its format's floor). */
export function adReservedHeightClass(placement: AdPlacement): string {
  return AD_RESERVED_MIN_HEIGHT[AD_PLACEMENT_FORMAT[placement]];
}

/** A resolved ad unit. Kept minimal until a real provider lands. */
export interface ResolvedAd {
  /** Click-through URL. */
  href: string;
  /** Image creative URL. */
  image: string;
  /** Disclosure label, e.g. "Sponsored". */
  label: string;
  /** Accessible alt / headline for the creative. */
  title: string;
}

/**
 * Registry of resolved ads by placement. Empty today (no ad network wired), so
 * every placement resolves to `null` and its slot renders nothing. A house
 * ad-management system populates this map (or a flag-gated external provider
 * replaces `resolveAd`) when ads go live, with no change to the pages that
 * declare slots.
 */
const AD_REGISTRY: Partial<Record<AdPlacement, ResolvedAd>> = {};

/** Resolve the ad for a placement, or `null` when none is registered. */
export function resolveAd(placement: AdPlacement): ResolvedAd | null {
  return AD_REGISTRY[placement] ?? null;
}
