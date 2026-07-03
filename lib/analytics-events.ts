/**
 * Analytics event catalog - the single typed source of truth for every
 * product-funnel event the app emits (public marketing site + ERP pricing
 * surfaces). The former Connect event families were removed with the Connect
 * product; the catalog now carries only the marketing.* and plan.* funnels.
 *
 * What it does: names each event (dot-namespaced, snake-case values, consistent
 * past/-ing tense) and pins the exact property shape it carries, then exposes a
 * type-safe `trackEvent()` wrapper over `lib/analytics.ts > track()`. Surfaces
 * import the name + call `trackEvent(name, props)`; a wrong property shape fails
 * typecheck (see `analytics-events.vitest.ts`).
 *
 * Cross-module links:
 *  - Sink: `lib/analytics.ts` (`track`) fans to PostHog + GA4 and is a no-op when
 *    `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_GA4_MEASUREMENT_ID` are absent, so
 *    everything here is keyless-safe by construction.
 *  - Emitters: components/marketing/CtaButton.tsx + MobileStickyCta.tsx
 *    (cta_clicked), motion/SectionView.tsx (page_section_viewed),
 *    sections/FaqAccordion.tsx (faq_opened), ErpPricingTable.tsx +
 *    app/account/subscription/plans (plan.*).
 *
 * PII hygiene (binding - see docs/ANALYTICS-EVENTS.md): we deliberately send
 * shapes, not contents - stable slugs and tier names only, never user input,
 * exact prices, or identities. Do not widen these without updating the doc's
 * PII review note.
 */

import { track } from './analytics';

/* ------------------------------------------------------------------ *
 * Event name constants
 * ------------------------------------------------------------------ */

/**
 * Canonical event names. Use these constants - never a raw string literal at a
 * call site - so renames are one-line and grep is reliable.
 */
export const ConnectEvents = {
  /**
   * Public marketing-site funnel (lead generation). These fire on the unauth
   * landing/product pages (`app/(marketing)/*`), not inside the app.
   * Links: components/marketing/CtaButton.tsx (cta_clicked),
   * SectionReveal.tsx (page_section_viewed), FaqAccordion.tsx (faq_opened).
   * No PII: we send the page + a position/section/question SLUG, never input.
   */
  marketingCtaClicked: 'marketing.cta_clicked',
  marketingSectionViewed: 'marketing.page_section_viewed',
  marketingFaqOpened: 'marketing.faq_opened',

  /**
   * Pricing plan-interest funnel (sales / marketing signal). Answers "which plan
   * do people actually look at and pick" with NO money or PII on the wire.
   *  - `plan.cta_clicked` fires when a plan card's primary CTA is pressed, on
   *    EITHER the public ERP pricing page (`surface: 'erp_pricing'`) or the
   *    logged-in subscription hub (`surface: 'app_plans'`). Carries the plan
   *    `tier` slug only (e.g. 'free' / 'growth'), never the price.
   *  - `plan.band_selected` fires when a visitor picks a team-size band on the
   *    public ERP recommender; `recommendedTier` is the plan it points them to.
   *    Pure "what size am I / which plan fits me" intent.
   * Links: components/marketing/ErpPricingTable.tsx (both events) +
   * app/account/subscription/plans/page.tsx (cta_clicked, app surface).
   */
  planCtaClicked: 'plan.cta_clicked',
  planBandSelected: 'plan.band_selected',
} as const;

/* ------------------------------------------------------------------ *
 * Shared property value types
 * ------------------------------------------------------------------ */

/** A public marketing page that fires the marketing.* funnel events. */
export type MarketingPage = 'home' | 'connect' | 'pricing' | 'erp';

/**
 * Where a plan-interest event fired: the public ERP pricing page or the
 * logged-in subscription hub. Stable slugs, never URLs (no PII). Keep in sync
 * with the `surface` passed at the ErpPricingTable + plans-hub call sites.
 */
export type PlanSurface = 'erp_pricing' | 'app_plans';

/* ------------------------------------------------------------------ *
 * Per-event property shapes
 * ------------------------------------------------------------------ */

/**
 * The property shape carried by each event. The keys are the literal event
 * names (the values of `ConnectEvents`), so `trackEvent(name, props)` can pin
 * `props` to exactly the right shape and reject anything else at compile time.
 */
export interface ConnectEventProps {
  // Marketing funnel. position/section/question are stable slugs (e.g. 'hero',
  // 'final', 'modules', 'faq.free'), never user input. page is the page slug.
  'marketing.cta_clicked': { page: MarketingPage; position: string };
  'marketing.page_section_viewed': { page: MarketingPage; section: string };
  'marketing.faq_opened': { page: MarketingPage; question: string };

  // Plan-interest funnel. `tier` is the plan slug (free/starter/growth/business,
  // or any admin-created tier on the in-app hub); `surface` says which pricing
  // surface; `recommended` (marketing only) flags that the clicked card was the
  // live headcount-band recommendation. No price / no PII - slugs only.
  'plan.cta_clicked': { tier: string; surface: PlanSurface; recommended?: boolean };
  // Team-size band picked on the public ERP recommender. Both are stable slugs
  // ('b5'/'b25'/... and the tier they map to); no exact headcount, no PII.
  'plan.band_selected': { band: string; recommendedTier: string };
}

/** Every catalog event name (the literal union). */
export type ConnectEventName = keyof ConnectEventProps;

/* ------------------------------------------------------------------ *
 * Typed emit wrapper
 * ------------------------------------------------------------------ */

/**
 * Type-safe emit for a catalog event. The second argument is constrained to the
 * exact property shape declared for `event`, so a missing/extra/wrong-typed
 * field is a typecheck error. Delegates to `track()`, which is itself a no-op
 * without env keys - so this stays keyless-safe end to end.
 *
 * Prefer this over raw `track()` for any product-funnel event.
 */
export function trackEvent<E extends ConnectEventName>(
  event: E,
  props: ConnectEventProps[E],
): void {
  track(event, props);
}

/* ------------------------------------------------------------------ *
 * Helpers - session-scoped dedupe
 * ------------------------------------------------------------------ */

// Session-scoped dedupe for marketing section views — module-level so a section
// scrolling in and out of view (or a remount) still counts "once per section per
// session". Keyed by `page:section`.
const firedSectionViews = new Set<string>();

/** Test-only: clear the per-session marketing section-view dedupe set. */
export function __resetMarketingSectionViewsForTest(): void {
  firedSectionViews.clear();
}

/**
 * Emit `marketing.page_section_viewed` at most once per section per session.
 * Returns true if an event was emitted. Used by SectionReveal's observer.
 */
export function recordMarketingSectionView(
  props: ConnectEventProps['marketing.page_section_viewed'],
): boolean {
  const key = `${props.page}:${props.section}`;
  if (firedSectionViews.has(key)) return false;
  firedSectionViews.add(key);
  trackEvent(ConnectEvents.marketingSectionViewed, props);
  return true;
}
