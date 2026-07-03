'use client';

/**
 * ERP pricing table - client child of the public /erp/pricing page.
 *
 * What it does: renders the four data-driven plan cards (Free/Starter/Growth/
 * Business) and the headcount-band recommender. Pricing is still SOLD as a
 * 1-YEAR TERM, but the HEADLINE the customer sees is the MONTHLY installment
 * figure (psychologically lighter); the yearly commitment is concise muted
 * subtext, with an optional upfront-save line when a discount is configured.
 * Prices + staff caps come from the server-fetched plans (props), never
 * hardcoded; only the CURATED feature bullets + labels are i18n copy keyed by
 * tier. The old monthly/yearly billing-cycle toggle was removed - it framed
 * monthly as a separate billed cycle, which this model replaces.
 *
 * Cross-module links:
 *  - Parent server page: app/(marketing)/erp/pricing/page.tsx (fetches + filters
 *    the public ERP plans via lib/actions getPlans, passes them down).
 *  - Plan shape mirrors the backend Plan schema (tier / monthlyPrice /
 *    yearlyPrice / entitlements.maxMembersPerWorkspace). Prices are in RUPEES
 *    (see seed-default-tiers-and-plans.ts), so format with thousands separators,
 *    no /100.
 *  - Visual language matches components/marketing/PricingCard.tsx (rounded-16
 *    white card, indigo check bullets, highlighted = "Most popular") and the
 *    Connect pricing page; keep the two in visual sync.
 *
 * Bands model (owner pick, 2026-06-23): the selector RECOMMENDS a plan by
 * headcount using each plan's staff cap (<=5 Free, <=25 Starter, <=100 Growth,
 * <=500 Business, >500 Custom/contact). It is guidance only and does NOT change
 * prices (pricing is flat per plan). Switching to per-seat pricing later is
 * additive: read the band -> price map instead of recommending.
 */

import { useId, useMemo, useState } from 'react';
import { Segmented } from 'antd';
import { useTranslations, useLocale } from 'next-intl';
import { hasUpfrontDiscount, monthlyInstallment } from '@/lib/pricing';
// Per-plan admin card content (tagline + feature bullets) localized with a static
// fallback. Single source of truth shared with PlanCard.tsx.
import { pickLocalized } from '@/lib/localized-text';
import type { PlanMarketing } from '@/types';
// Plan-interest analytics (which plan / team-size band visitors pick). Keyless-
// safe no-op without analytics env keys. Mirror in the in-app plans hub.
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import { AUTH } from './content';
import { CheckIcon } from './icons';
import { MarketingButton } from './ui/MarketingButton';

/** Minimal plan shape this table needs (subset of the backend Plan). */
export interface ErpPlanView {
  tier: string;
  monthlyPrice: number;
  yearlyPrice: number;
  maxMembers: number;
  /** Upfront-payment discount %, 0 = none. Drives the "save X%" pill. */
  upfrontDiscountPercent: number;
  /** Whether the 0% monthly-installment option is offered. */
  installmentsEnabled: boolean;
  /** Installment count the yearly term splits into (default 12). */
  installmentMonths: number;
  /** Whether GST applies (backend Plan.gstEnabled). Drives the small GST note. */
  gstEnabled: boolean;
  /** GST percentage shown in the note (default 18). */
  gstRatePercent: number;
  /** When true the note reads "incl. GST"; else "+X% GST". */
  isPriceTaxInclusive: boolean;
  /**
   * Optional admin-editable card content (localized tagline + ordered feature
   * bullets). When present these override the static t('plans.<tier>.*') copy;
   * when absent/blank the card falls back to the static defaults. Threaded in by
   * selectPublicErpPlans (erpPlans.ts) from the backend Plan.marketing subdoc.
   */
  marketing?: PlanMarketing;
}

/** Canonical public ERP tiers, lowest -> highest. `growth` is highlighted. */
const TIER_ORDER = ['free', 'starter', 'growth', 'business'] as const;
type Tier = (typeof TIER_ORDER)[number];

/** Number of curated feature bullets per tier (keys f1..fN in i18n). */
const FEATURE_COUNT: Record<Tier, number> = {
  free: 4,
  starter: 3,
  growth: 3,
  business: 6,
};

/**
 * Headcount bands the selector offers. Each maps to the recommended tier by
 * staff cap; `custom` (>500) recommends the contact-us block, not a card.
 */
const BANDS = [
  { id: 'b5', tier: 'free' as const },
  { id: 'b25', tier: 'starter' as const },
  { id: 'b100', tier: 'growth' as const },
  { id: 'b500', tier: 'business' as const },
  { id: 'b500plus', tier: 'custom' as const },
] as const;
type BandId = (typeof BANDS)[number]['id'];

/** Format a rupee amount (integer rupees) with Indian thousands grouping. */
function formatInr(rupees: number): string {
  return `₹${new Intl.NumberFormat('en-IN').format(rupees)}`;
}

export function ErpPricingTable({ plans }: { plans: ErpPlanView[] }) {
  const t = useTranslations('marketing.pages.erpPricing');
  // Active locale drives the admin card-content resolver (pickLocalized).
  const locale = useLocale();
  const [band, setBand] = useState<BandId>('b25');
  const bandLabelId = useId();

  // Index the fetched plans by tier so cards read price/cap straight from data.
  const byTier = useMemo(() => {
    const map = new Map<string, ErpPlanView>();
    for (const plan of plans) map.set(plan.tier, plan);
    return map;
  }, [plans]);

  // The plan the headcount band recommends (undefined for the >500 Custom band).
  const recommendedTier = BANDS.find((entry) => entry.id === band)?.tier;

  return (
    <div>
      {/* Four plan cards, data-driven from the fetched plans. Pricing is a
          1-year term: pay upfront (optional discount) or in 0% installments. */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const plan = byTier.get(tier);
          // Graceful fallback: if a tier is missing from the fetch, skip its card
          // rather than crash. The page also shows a global notice when empty.
          if (!plan) return null;

          const highlighted = tier === 'growth';
          const recommended = recommendedTier === tier;
          // Pricing is still SOLD as a 1-year term, but the HEADLINE is the
          // MONTHLY installment figure (psychologically lighter); the yearly
          // commitment is concise muted subtext. Math via lib/pricing.
          const yearly = plan.yearlyPrice;
          const isFree = yearly <= 0;
          const discountPercent = plan.upfrontDiscountPercent;
          // Optional upfront-save line only when a discount exists (0 by default
          // -> nothing extra renders). Installments default-on -> monthly headline.
          const showUpfrontSave = !isFree && hasUpfrontDiscount(discountPercent);
          const installmentMonths = plan.installmentMonths;
          const showMonthly = !isFree && plan.installmentsEnabled && installmentMonths > 0;
          const perMonth = monthlyInstallment(yearly, installmentMonths);
          const featureCount = FEATURE_COUNT[tier];

          // Admin-editable card content: when the plan carries marketing.tagline /
          // .featureHighlights, render those (localized via pickLocalized) instead
          // of the static t('plans.<tier>.*') copy; a blank/absent field falls back
          // to the static default. en is the per-bullet canonical fallback (always
          // set), so the static '' fallback there is never actually reached. Keep
          // this resolver logic in sync with PlanCard.tsx.
          const taglineText = pickLocalized(
            plan.marketing?.tagline,
            locale,
            t(`plans.${tier}.tagline`),
          );
          const adminFeatures = plan.marketing?.featureHighlights;
          const hasAdminFeatures = Array.isArray(adminFeatures) && adminFeatures.length > 0;

          return (
            <div
              key={tier}
              className={`relative flex h-full flex-col rounded-[16px] border bg-white p-6 transition-shadow sm:p-7 ${
                highlighted
                  ? // Single dominant anchor: bold indigo border + lifted shadow.
                    'border-[var(--cr-indigo-600)] shadow-[0_22px_48px_-22px_rgba(11,110,79,0.35)]'
                  : recommended
                    ? // Personalized-by-team-size cue: SECONDARY to the anchor, so a
                      // soft gold border WITHOUT the competing shadow (no second hero).
                      'border-[var(--cr-gold-400)]'
                    : 'border-[var(--cr-neutral-200)]'
              }`}
            >
              {/* ONE badge per card, with a deliberate visual hierarchy so the two
                  do not compete: "Most popular" (Growth) is the single PRIMARY anchor
                  (filled indigo pill); the live headcount "Recommended" is a SECONDARY
                  personalized cue (outline pill), shown only when it is NOT the popular
                  card. Keep in sync with the card-border emphasis above. */}
              {highlighted ? (
                <span className="mkt-mono absolute -top-3 left-6 rounded-full bg-[var(--cr-indigo-600)] px-3 py-1 text-[0.62rem] font-semibold tracking-[0.08em] text-white uppercase">
                  {t('mostPopular')}
                </span>
              ) : recommended ? (
                <span className="mkt-mono absolute -top-3 left-6 rounded-full border border-[var(--cr-gold-500)] bg-white px-3 py-1 text-[0.62rem] font-semibold tracking-[0.08em] text-[var(--cr-indigo-800)] uppercase">
                  {t('recommendedBadge')}
                </span>
              ) : null}

              <h3 className="text-[1.3rem]">{t(`plans.${tier}.name`)}</h3>

              {/* One-line positioning tagline under the name. Admin per-plan copy
                  (marketing.tagline) when set, else the shared static default. */}
              <p className="pt-1 text-[0.85rem] leading-snug text-[var(--cr-neutral-500)]">
                {taglineText}
              </p>

              {/* Price block: ONE clear hierarchy. The MONTHLY figure is the
                  single big number (psychologically lighter); the yearly
                  commitment is concise muted subtext; an optional upfront-save
                  line only shows when a discount exists. Free is a flat label.
                  Math via lib/pricing (no inlined arithmetic). */}
              {isFree ? (
                <p className="flex items-baseline gap-1.5 pt-3">
                  <span className="font-[family-name:var(--font-mkt-display)] text-[2.4rem] leading-none font-medium text-[var(--cr-charcoal)]">
                    {t('freeForever')}
                  </span>
                </p>
              ) : (
                <div className="pt-3">
                  {/* Monthly headline = the big figure (falls back to the yearly
                      figure if installments are off so it's never empty). */}
                  <p className="flex items-baseline gap-1.5">
                    <span
                      className="font-[family-name:var(--font-mkt-display)] text-[2.4rem] leading-none font-medium text-[var(--cr-charcoal)]"
                      aria-label={
                        showMonthly
                          ? `${formatInr(perMonth)} per month`
                          : `${formatInr(yearly)} per year`
                      }
                    >
                      {showMonthly ? formatInr(perMonth) : formatInr(yearly)}
                    </span>
                    <span className="text-sm text-[var(--cr-neutral-500)]" aria-hidden>
                      {showMonthly ? t('perMonth') : t('perYear')}
                    </span>
                  </p>
                  {/* Concise yearly-commitment subtext (folds "auto-renews" in).
                      The single muted line that replaces the old struck-through
                      stack + standalone installment line + dangling auto-renew.
                      The ₹ yearly total now lives on the in-app checkout/review
                      screen, so this line carries only the billing cadence. */}
                  <p className="pt-1 text-[0.8rem] text-[var(--cr-neutral-500)]">
                    {showMonthly ? t('billedYearlyAmount') : t('billedYearly')}
                  </p>
                  {/* Small GST note — shows ONLY when GST is enabled for the plan
                      (backend Plan.gstEnabled). "+X% GST" when tax-exclusive,
                      "incl. GST (X%)" when inclusive. When GST is off, nothing
                      renders. Keep in sync with PlanCard.tsx. */}
                  {plan.gstEnabled ? (
                    <p className="pt-1 text-[0.8rem] text-[var(--cr-neutral-500)]">
                      {plan.isPriceTaxInclusive
                        ? t('gstIncluded', { rate: plan.gstRatePercent })
                        : t('plusGst', { rate: plan.gstRatePercent })}
                    </p>
                  ) : null}
                  {/* Optional upfront-save line (only when a discount exists). */}
                  {showUpfrontSave ? (
                    <p className="pt-1 text-[0.8rem] text-[var(--cr-neutral-500)]">
                      {t('upfrontSave', { percent: discountPercent })}
                    </p>
                  ) : null}
                </div>
              )}

              {/* Staff cap straight from the plan entitlement (data-driven).
                  maxMembers < 0 is the UNLIMITED sentinel (-1); render the
                  "Unlimited team members" copy instead of leaking "-1" into
                  t('staffCap'). Keep in sync with PlanCard.tsx + CheckoutView.tsx. */}
              <p className="pt-3 text-[0.95rem] leading-relaxed text-[var(--cr-neutral-600)]">
                {plan.maxMembers < 0
                  ? t('staffCapUnlimited')
                  : t('staffCap', { count: plan.maxMembers })}
              </p>

              {/* Cumulative "Everything in X, plus..." line for non-Free tiers. */}
              {tier !== 'free' ? (
                <p className="pt-2 text-[0.85rem] font-medium text-[var(--cr-indigo-700)]">
                  {t(`plans.${tier}.everything`)}
                </p>
              ) : null}

              {/* Feature bullets. Admin per-plan list (marketing.featureHighlights,
                  ordered + localized) when set, else the static curated f1..fN. */}
              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {(hasAdminFeatures
                  ? adminFeatures!.map((f) => pickLocalized(f, locale, ''))
                  : Array.from({ length: featureCount }, (_, index) =>
                      t(`plans.${tier}.f${index + 1}`),
                    )
                ).map((text, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2.5 text-[0.9rem] leading-snug text-[var(--cr-neutral-700)]"
                  >
                    <CheckIcon className="mt-[3px] h-4 w-4 shrink-0 text-[var(--cr-indigo-600)]" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <MarketingButton
                  href={AUTH.getStartedErp}
                  variant={highlighted ? 'solid-indigo' : 'outline'}
                  size="md"
                  block
                  // "Which plan are people choosing?" - fire on press, before the
                  // CTA navigates to signup. `recommended` flags the headcount
                  // pick. tier slug only, no price (see analytics-events PII rule).
                  onClick={() =>
                    trackEvent(ConnectEvents.planCtaClicked, {
                      tier,
                      surface: 'erp_pricing',
                      recommended,
                    })
                  }
                >
                  {tier === 'free' ? t('ctaFree') : t('ctaTrial')}
                </MarketingButton>

                {/* The old dangling auto-renew sentence under the CTA is GONE -
                    the renewal commitment is now folded into the concise
                    billed-yearly price subtext above (billedYearlyAmount). */}
              </div>
            </div>
          );
        })}
      </div>

      {/* Headcount-band recommender. Guidance only - does not change prices. */}
      <div className="mx-auto mt-12 max-w-2xl rounded-[16px] border border-[var(--cr-neutral-200)] bg-white p-6 text-center sm:p-7">
        <h2 className="text-[1.2rem]">{t('selector.heading')}</h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--cr-neutral-600)]">
          {t('selector.sub')}
        </p>
        <div className="mt-5 flex flex-col items-center gap-3">
          <span id={bandLabelId} className="sr-only">
            {t('selector.ariaLabel')}
          </span>
          <Segmented
            aria-labelledby={bandLabelId}
            value={band}
            onChange={(value) => {
              const next = value as BandId;
              setBand(next);
              // "What team size / which plan fits me?" - the recommender pick is a
              // strong sales-intent signal. Slugs only (band id + the tier it maps
              // to), no exact headcount.
              const tier = BANDS.find((entry) => entry.id === next)?.tier ?? 'custom';
              trackEvent(ConnectEvents.planBandSelected, {
                band: next,
                recommendedTier: tier,
              });
            }}
            options={BANDS.map((entry) => ({
              label: t(`selector.bands.${entry.id}`),
              value: entry.id,
            }))}
          />
          <p className="mt-1 text-sm font-medium text-[var(--cr-indigo-700)]" aria-live="polite">
            {recommendedTier === 'custom'
              ? t('selector.recommendCustom')
              : t('selector.recommend', { plan: t(`plans.${recommendedTier}.name`) })}
          </p>
        </div>
      </div>
    </div>
  );
}
