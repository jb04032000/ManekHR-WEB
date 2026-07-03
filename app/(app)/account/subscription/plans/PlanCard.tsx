'use client';

/**
 * Single ERP plan card for the in-app plans hub (/account/subscription/plans).
 *
 * What it does: renders one plan's name/tier/price PLUS the curated buying copy
 * (staff cap, "everything in X, plus" line, feature bullets, "Most popular" on
 * Growth, "Current plan" clarity) so a user can actually tell the plans apart -
 * the bare price-only card could not. The price block leads with the MONTHLY
 * installment figure as the headline (psychologically lighter); the yearly
 * commitment (plans are still sold as a 1-year term) is concise muted subtext.
 *
 * Cross-module links:
 *  - The curated copy is the SINGLE SOURCE OF TRUTH shared with the public
 *    marketing pricing page: it reads the same i18n namespace
 *    `marketing.pages.erpPricing` (keys: plans.<tier>.{name,everything,f1..fN},
 *    staffCap, mostPopular). Mirror of components/marketing/ErpPricingTable.tsx
 *    (FEATURE_COUNT map + staffCap/feature render). Keep the two in sync: if a
 *    tier's bullet count changes there, change FEATURE_COUNT here too.
 *  - Parent page app/account/subscription/plans/page.tsx owns all subscription
 *    state (current/queued/downgrade) and passes the resolved flags down; this
 *    card is purely presentational so it stays unit-testable.
 *
 * Watch: staff cap is data-driven from the plan's own
 * entitlements.maxMembersPerWorkspace (NOT hardcoded); -1 renders an "Unlimited"
 * fallback (Custom shouldn't reach here after the page filter, but we guard).
 */

import { Card, Button, Popconfirm } from 'antd';
import {
  CrownOutlined,
  CheckOutlined,
  RocketOutlined,
  StopOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import { useTranslations, useLocale } from 'next-intl';
import { Money } from '@/lib/money';
import { hasUpfrontDiscount, monthlyInstallment } from '@/lib/pricing';
// Per-plan admin card content (tagline + bullets) localized with a static
// fallback. Single source of truth shared with the public ErpPricingTable.tsx.
import { pickLocalized } from '@/lib/localized-text';
import type { PlanWithBilling } from '@/types';

/**
 * Curated bullet count per public ERP tier (i18n keys f1..fN). MUST match
 * FEATURE_COUNT in components/marketing/ErpPricingTable.tsx - same source copy.
 */
const FEATURE_COUNT: Record<string, number> = {
  free: 4,
  starter: 3,
  growth: 3,
  business: 6,
};

export interface PlanCardProps {
  plan: PlanWithBilling;
  /** Tier accent colour resolved from the Tier registry by the parent. */
  tierColor: string;
  /** This card is the user's current/active plan. */
  isThisActive: boolean;
  /** This card is the queued-next plan (scheduled downgrade/upgrade). */
  isThisQueued: boolean;
  /** Selecting this plan would be a downgrade from the active tier. */
  isDowngrade: boolean;
  /** Pre-computed disabled state for the primary CTA (parent owns the rules). */
  buttonDisabled: boolean;
  /** Fires when the single primary CTA is pressed (subscribe / select free). */
  onSelect: (plan: PlanWithBilling) => void;
  /** Cancels the queued plan (only used on the queued card). */
  onCancelQueued: () => void;
}

export function PlanCard({
  plan,
  tierColor,
  isThisActive,
  isThisQueued,
  isDowngrade,
  buttonDisabled,
  onSelect,
  onCancelQueued,
}: PlanCardProps) {
  // Reuse the public marketing pricing copy verbatim - no duplicate namespace.
  const tp = useTranslations('marketing.pages.erpPricing');
  // Active locale drives the admin card-content resolver (pickLocalized).
  const locale = useLocale();

  // Pricing is still SOLD as a 1-year term, but the HEADLINE the customer sees is
  // the MONTHLY installment figure (psychologically lighter); the yearly
  // commitment is concise muted subtext. Free = yearlyPrice 0.
  const yearly = plan.yearlyPrice ?? 0;
  const isFree = yearly === 0;
  const discountPercent = plan.upfrontDiscountPercent ?? 0;
  // Optional upfront-save line shows only when an upfront discount exists (0 by
  // default -> nothing extra renders, keeping the block clean).
  const showUpfrontSave = !isFree && hasUpfrontDiscount(discountPercent);
  // Installments default-on: months default 12, and the option is enabled unless
  // explicitly disabled. Existing plan records (created before this field) have
  // it undefined and must still drive the monthly headline; only an admin setting
  // it false falls back to the yearly figure. (ErpPricingTable mirrors this.)
  const installmentsEnabled = plan.installmentsEnabled !== false;
  const installmentMonths = plan.installmentMonths ?? 12;
  const showMonthly = !isFree && installmentsEnabled && installmentMonths > 0;
  // All math comes from lib/pricing (single source of truth) - never inline it.
  const perMonth = monthlyInstallment(yearly, installmentMonths);

  const featureCount = FEATURE_COUNT[plan.tier] ?? 0;
  // Admin-editable card content: when the plan carries marketing.tagline /
  // .featureHighlights, render those (localized) instead of the static
  // t('plans.<tier>.*') copy; a blank/absent field falls back to the static
  // default. Keep this resolver logic in sync with ErpPricingTable.tsx.
  const taglineText = pickLocalized(
    plan.marketing?.tagline,
    locale,
    tp(`plans.${plan.tier}.tagline`),
  );
  const adminFeatures = plan.marketing?.featureHighlights;
  const hasAdminFeatures = Array.isArray(adminFeatures) && adminFeatures.length > 0;
  const isMostPopular = plan.tier === 'growth';
  const maxMembers = plan.entitlements?.maxMembersPerWorkspace ?? 0;
  const hasEverything = plan.tier !== 'free';

  // Tier identity now lives ONLY in the small icon chip (the redundant tier
  // pill is gone and the price number is a single neutral colour across cards),
  // so the four plans read as one comparable set instead of a rainbow. The chip
  // tints from the tier's hex accent; a non-hex/`default` tier falls back to the
  // brand primary so the chip is never an invalid CSS colour.
  const isHexAccent = typeof tierColor === 'string' && tierColor.startsWith('#');
  const accent = isHexAccent ? tierColor : 'var(--cr-primary)';
  const chipBg = isHexAccent ? `${tierColor}1f` : 'var(--cr-primary-light)';

  // One primary CTA across the whole grid: only the recommended (most-popular)
  // card gets the solid navy button; every other actionable card uses the quiet
  // outline button. This stops four heavy buttons from competing and points the
  // eye at the recommended upgrade (mirrors the public ErpPricingTable, where the
  // highlighted card is solid-indigo and the rest are outline).
  const ctaPrimary = !isThisActive && !isDowngrade && isMostPopular;

  // CTA label: "Current plan" wording matches the badge so the active card's
  // button reads as a status, not an action.
  const buttonLabel = isThisActive
    ? 'Current plan'
    : isDowngrade
      ? 'Downgrade restricted'
      : isFree
        ? 'Select Free'
        : 'Subscribe';

  return (
    <Card
      // Most-popular (Growth) gets an emphasized 2px primary border + a soft
      // indigo elevation so it reads as the focal/recommended choice; current-plan
      // gets the 2px primary border too. Both are ALSO distinguished by badge TEXT
      // (not colour alone) for a11y. relative so the -top ribbon can pin to the
      // card edge. The shadow value matches the public ErpPricingTable highlight.
      className={`relative flex h-full flex-col rounded-2xl ${
        isMostPopular
          ? 'border-2 border-primary shadow-[0_18px_40px_-24px_rgba(11,110,79,0.45)]'
          : isThisActive
            ? 'border-2 border-primary'
            : ''
      }`}
      // Full-height flex column so the CTA pins to the bottom (mt-auto) and
      // every card's button lines up on one baseline despite differing content.
      styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}
    >
      {/* Top ribbons: text-bearing badges (a11y - never colour-only). The
          most-popular ribbon shows on Growth; the current-plan ribbon wins the
          slot when this is the active plan. */}
      {isThisActive ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">
          Current plan
        </span>
      ) : isMostPopular ? (
        <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-white uppercase">
          {tp('mostPopular')}
        </span>
      ) : null}

      {/* Identity zone: icon chip (the ONLY place the tier accent appears now) +
          plan name. The duplicate tier pill that repeated the name is gone. */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: chipBg }}
        >
          <CrownOutlined className="text-lg" style={{ color: accent }} />
        </div>
        <p className="m-0 font-display text-lg font-bold text-heading">{plan.name}</p>
      </div>

      {/* One-line positioning tagline under the name. Admin per-plan copy
          (marketing.tagline) when set, else the shared static default. */}
      <p className="m-0 mt-2 text-[13px] leading-snug text-subtle">{taglineText}</p>

      {/* Price block: ONE clear hierarchy. The MONTHLY figure is the single big
          number (psychologically lighter); the yearly commitment is concise muted
          subtext; an optional upfront-save line only shows when a discount exists.
          Free shows a flat "Free forever". Math via lib/pricing; amounts via
          Money.format() (never hand-formatted ₹). */}
      <div className="mt-4">
        {isFree ? (
          <p className="m-0 font-display text-[30px] leading-none font-extrabold text-heading tabular-nums">
            {tp('freeForever')}
          </p>
        ) : (
          <>
            {/* Monthly headline = the big figure, in ONE neutral colour across all
                cards (was per-tier coloured, which made the grid jangle). The
                yearly term is shown as subtext below; if installments are off,
                fall back to the yearly figure so the headline is never empty. */}
            <p className="m-0 flex items-baseline gap-1 font-display text-[30px] leading-none font-extrabold text-heading tabular-nums">
              <span
                aria-label={
                  showMonthly
                    ? `${Money.fromRupees(perMonth).format()} per month`
                    : `${Money.fromRupees(yearly).format()} per year`
                }
              >
                {showMonthly
                  ? Money.fromRupees(perMonth).format()
                  : Money.fromRupees(yearly).format()}
              </span>
              <span className="text-[13px] font-normal text-subtle" aria-hidden>
                {showMonthly ? tp('perMonth') : tp('perYear')}
              </span>
            </p>

            {/* Concise yearly-commitment subtext (folds "auto-renews" in) - the
                single muted line that replaces the old struck-through stack +
                dangling auto-renew sentence. The ₹ yearly total moved to the
                checkout/review page (CheckoutView), so this line no
                longer carries the amount - just the billing cadence. Only
                meaningful when the headline is monthly; if it's already the
                yearly figure, a plain "billed yearly" suffices. */}
            <p className="m-0 mt-1 text-xs text-muted tabular-nums">
              {showMonthly ? tp('billedYearlyAmount') : tp('billedYearly')}
            </p>

            {/* Small GST note — shows ONLY when GST is enabled for the plan
                (backend Plan.gstEnabled; undefined/true = ON). "+X% GST" when
                tax-exclusive, "incl. GST (X%)" when inclusive. When off, nothing
                renders. Keep in sync with ErpPricingTable.tsx. */}
            {plan.gstEnabled !== false && (
              <p className="m-0 mt-1 text-xs text-subtle">
                {plan.isPriceTaxInclusive
                  ? tp('gstIncluded', { rate: plan.gstRatePercent ?? 18 })
                  : tp('plusGst', { rate: plan.gstRatePercent ?? 18 })}
              </p>
            )}

            {/* Optional upfront-save line (only when a discount is configured;
                0 by default -> nothing renders). Text, not colour-only. */}
            {showUpfrontSave && (
              <p className="m-0 mt-1 text-xs text-subtle">
                {tp('upfrontSave', { percent: discountPercent })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Quiet divider separating the COST zone (above) from the WHAT-YOU-GET
          zone (below) so the card reads as two clear blocks, not one dense run. */}
      <div className="mt-4 border-t border-border-light" />

      {/* Staff cap, data-driven from the plan entitlement. -1 = unlimited
          (Custom is filtered out upstream, but guard anyway). Slightly stronger
          weight than the bullets because team size is the headline differentiator
          between tiers. */}
      <p className="m-0 mt-4 text-sm font-semibold text-heading">
        {maxMembers < 0 ? tp('staffCapUnlimited') : tp('staffCap', { count: maxMembers })}
      </p>

      {/* Cumulative "Everything in X, plus" line for non-free tiers. */}
      {hasEverything && (
        <p className="m-0 mt-2 text-[13px] font-medium text-primary">
          {tp('plans.' + plan.tier + '.everything')}
        </p>
      )}

      {/* Curated feature bullets (f1..fN). Check icon is decorative
          (aria-hidden via AntD default); the feature text is the label. The list
          hugs its content (no flex-1 stretch) - the slack from unequal feature
          counts collects as ONE controlled gap above the CTA (via mt-auto below),
          which reads intentional instead of as ragged dead space inside the list.
          Readable >=14px / ~1.5 line-height, 8px (gap-2) rhythm. */}
      {(hasAdminFeatures || featureCount > 0) && (
        <ul className="mt-3 mb-0 flex list-none flex-col gap-2.5 p-0">
          {(hasAdminFeatures
            ? adminFeatures!.map((f) => pickLocalized(f, locale, ''))
            : Array.from({ length: featureCount }, (_, i) =>
                tp('plans.' + plan.tier + '.f' + (i + 1)),
              )
          ).map((text, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-normal text-heading">
              <CheckOutlined aria-hidden className="mt-0.5 shrink-0 text-base text-primary" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      )}

      {/* The old Auto-Renew / One-time / "{n}-day trial" tag row is GONE - the
          monthly-headline price block above (monthly figure + billed-yearly
          subtext) supersedes it, and that row is where the stray "0" trial bug
          lived. */}

      {/* mt-auto pins the single CTA to the card bottom so every card's button
          aligns on one baseline; pt-5 guarantees a clean minimum gap above it. The
          badges above are NOT buttons - one CTA per card, and only the recommended
          card's button is solid (ctaPrimary). size="large" keeps the touch target. */}
      <div className="mt-auto pt-5">
        {isThisQueued ? (
          <div className="flex flex-col gap-2">
            <Button block disabled icon={<CalendarOutlined />}>
              Queued Next
            </Button>
            <Popconfirm title="Cancel queued plan?" onConfirm={onCancelQueued}>
              <Button danger block icon={<StopOutlined />}>
                Cancel Queue
              </Button>
            </Popconfirm>
          </div>
        ) : (
          <Button
            type={ctaPrimary ? 'primary' : 'default'}
            block
            size="large"
            disabled={buttonDisabled}
            icon={
              isThisActive ? <CheckOutlined /> : isDowngrade ? <StopOutlined /> : <RocketOutlined />
            }
            onClick={() => onSelect(plan)}
          >
            {buttonLabel}
          </Button>
        )}

        {/* The old dangling "Auto-renews yearly - we'll email you before
            renewal." sentence is GONE - it read as orphaned fine print. The
            renewal commitment is now folded into the concise billed-yearly price
            subtext above (billedYearlyAmount); full renewal terms belong at
            checkout, not on the card. */}
      </div>
    </Card>
  );
}
