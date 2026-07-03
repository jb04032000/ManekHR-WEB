'use client';

/**
 * Reusable checkout/review BODY for an ERP plan. Rendered by the dedicated
 * checkout PAGE (app/account/checkout/page.tsx). Rebuilt 2026-06-23 to match an
 * owner-provided professional reference: a 3-STEP checkout (Choose plan ->
 * Review & pay -> Confirmation) with numbered section cards on the LEFT and a
 * sticky Order-summary card on the RIGHT.
 *
 * Layout:
 *  - Top: a 3-step stepper (step 2 "Review & pay" active; step 3 upcoming).
 *  - Header: back-to-plans link + big title + subtitle (owned by the page; the
 *    stepper here is the body's own chrome).
 *  - Desktop (lg+): TWO columns - LEFT numbered sections (1 Your plan, 2 How to
 *    pay, 3 Payment method, 4 Billing details [flagged off]); RIGHT (sticky) the
 *    Order summary card (line item + subtotal + GST + Total due today + coupon +
 *    Pay CTA + reassurance).
 *  - Mobile (< lg): single column stacked; the Total + Pay button pin in a
 *    safe-area-padded sticky BOTTOM bar (thumb-friendly).
 *
 * Section 3 (Payment method) is a DISABLED VISUAL PREVIEW ONLY. We NEVER collect
 * raw card data on our page (PCI scope): Razorpay's hosted checkout collects it
 * when payments go live. The inputs are `disabled`, unwired to any state/submit,
 * and exist purely as a design placeholder to be replaced by the Razorpay
 * handoff. See the SHOW_BILLING_DETAILS flag for section 4 (built but hidden
 * until GST invoicing ships).
 *
 * GATING: online payments are NOT live (env.paymentsEnabled === false; no
 * Razorpay keys). The Pay CTA is DISABLED with a slim coming-soon note; the
 * coupon Apply only surfaces a "live later" note (never a fake discount). When
 * the flag flips true, wire the real Razorpay order/redirect onto handleProceed
 * (see the TODO(payments-live) seam).
 *
 * Pricing model (KEEP): a plan is a 1-year term paid one of two ways. YEARLY =
 * one upfront payment (gets the upfront discount when configured). MONTHLY = 12
 * 0%-interest installments at FULL price (no discount); only the first is due
 * today. The two totals DIFFER (monthly has no discount), so the Order summary
 * must follow the selected option - it is NOT a single shared yearly total. The
 * yearly "Save X" badge shows ONLY when an upfront discount is configured;
 * otherwise "Best value" (never a fake savings number). All math via lib/pricing
 * + Money.fromRupees().format() (rupees end-to-end while gated).
 *
 * Cross-module links:
 *  - Page: app/account/checkout/page.tsx (reads ?plan=<id>, fetches getPlans).
 *  - Plan summary copy = the SAME source as the cards: marketing.pages.erpPricing
 *    (tagline/everything/f1..fN) keyed by tier. FEATURE_COUNT mirrors
 *    PlanCard.tsx / ErpPricingTable.tsx - keep the three in sync.
 *  - Price math: lib/pricing.ts. Gating: components/subscription/PaymentsComingSoon.
 *  - Amounts: lib/money Money.fromRupees().format() (rupees, never hand-formatted).
 */

import { useMemo, useState, type ReactNode } from 'react';
import { Button, Input, Tag, Steps, message } from 'antd';
import {
  CheckOutlined,
  InfoCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Money } from '@/lib/money';
import {
  upfrontPrice,
  upfrontSavings,
  monthlyInstallment,
  gstBreakdown,
  hasUpfrontDiscount,
} from '@/lib/pricing';
import { usePaymentsGate } from '@/components/subscription/PaymentsComingSoon';
// Razorpay one-time checkout orchestrator (create order -> hosted sheet -> confirm).
// Only invoked behind the payments gate, so it stays dormant until go-live.
import { purchasePlan, CheckoutDismissedError } from '@/lib/billing/plan-checkout';
import type { PlanWithBilling } from '@/types';

/** Back to the plans tab - shared by the header and the in-card "Change plan". */
const PLANS_HREF = '/account/subscription/plans';

/**
 * Section 4 (GSTIN billing details) is BUILT but hidden until GST invoicing
 * ships (owner, 2026-06-23). Flip to true to re-introduce the collapsible
 * GSTIN / business-name / invoice-email block. Kept as a flag (not deleted) so
 * the markup is ready to wire to the real invoice path with no rebuild.
 */
const SHOW_BILLING_DETAILS = false;

/**
 * Curated bullet count per public ERP tier (i18n keys f1..fN). MUST match
 * FEATURE_COUNT in PlanCard.tsx and ErpPricingTable.tsx - same source copy.
 */
const FEATURE_COUNT: Record<string, number> = {
  free: 4,
  starter: 3,
  growth: 3,
  business: 6,
};

/** The two ways a yearly term can be paid; default is yearly (higher intent). */
type BillingOption = 'yearly' | 'monthly';

/** Hosted-checkout method chips. Visual-only selection (Razorpay collects later). */
type PayMethod = 'card' | 'upi' | 'netbanking';

interface Props {
  /** The resolved public ERP plan being reviewed (already validated by the page). */
  plan: PlanWithBilling;
}

export function CheckoutView({ plan }: Props) {
  // Review-screen chrome + coming-soon copy.
  const t = useTranslations('profile.subscription.checkout');
  // Shared plan-summary copy (same namespace the cards read).
  const tp = useTranslations('marketing.pages.erpPricing');
  // Coming-soon gate for the final Pay action (online payments not live yet).
  const { paymentsEnabled, guard } = usePaymentsGate();
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  // True while the Razorpay round-trip (order -> sheet -> confirm) is in flight.
  const [submitting, setSubmitting] = useState(false);

  // Default to YEARLY upfront: it's the higher-intent, single-payment path and
  // (when a discount is configured) the better deal, so it leads.
  const [option, setOption] = useState<BillingOption>('yearly');
  // Visual-only payment-method chip (Card default). Never reaches a real charge.
  const [method, setMethod] = useState<PayMethod>('card');
  const [coupon, setCoupon] = useState('');
  // Whether the user pressed Apply on the (gated) coupon field; shows the note.
  const [couponTried, setCouponTried] = useState(false);

  // Plan-derived figures (rupees end-to-end while gated).
  const yearly = plan.yearlyPrice ?? 0;
  // GST is optional per plan: ON unless the plan explicitly disables it
  // (undefined/true = ON, matching the backend Plan.gstEnabled contract). When
  // off, NO GST line renders and the total === subtotal. Keep the rate math
  // intact for the enabled case via lib/pricing.gstBreakdown.
  const gstEnabled = plan.gstEnabled !== false;
  // Drive the math with 0% when GST is off so the breakdown's gst is 0 and
  // base/total stay equal even if a downstream consumer reads it.
  const gstPercent = gstEnabled ? (plan.gstRatePercent ?? 18) : 0;
  const isInclusive = plan.isPriceTaxInclusive ?? false;
  const discountPercent = plan.upfrontDiscountPercent ?? 0;
  const installmentsEnabled = plan.installmentsEnabled !== false;
  const installmentMonths = plan.installmentMonths ?? 12;
  const monthlyOptionAvailable = installmentsEnabled && installmentMonths > 0;

  // Renewal date = today + 1 year. Runtime new Date() is fine in a client
  // component (this is app runtime, not a build-time workflow). Locale-formatted
  // for India; the day/month/year reads naturally in every catalog.
  const renewalDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  // Yearly-upfront breakdown: yearly price -> (- upfront discount) -> subtotal
  // -> +/incl GST -> one-payment total. Math via lib/pricing.
  const yearlyBreakdown = useMemo(() => {
    const subtotal = upfrontPrice(yearly, discountPercent);
    const savings = upfrontSavings(yearly, discountPercent);
    const { base, gst, total } = gstBreakdown(subtotal, gstPercent, isInclusive);
    return { subtotal, savings, base, gst, total };
  }, [yearly, discountPercent, gstPercent, isInclusive]);

  // Monthly breakdown: per-installment amount + GST per month, plus the
  // full-year roll-up. GST is applied to each installment so the per-month
  // figure the user sees is the real charged amount.
  // `perMonthBase` is the GROSS per-month input handed to gstBreakdown;
  // `perMonthTaxBase` is the CARVED taxable base it returns (base + gst ===
  // total in BOTH inclusive and exclusive modes). The summary subtotal MUST
  // roll up perMonthTaxBase (not perMonthBase) so Subtotal + GST === Total for
  // inclusive GST too - mirrors the yearly path, which already uses the carved
  // base. Keep in sync with the summaryBaseStr derivation below.
  const monthlyBreakdown = useMemo(() => {
    const perMonthBase = monthlyInstallment(yearly, installmentMonths);
    const {
      base: perMonthTaxBase,
      gst: perMonthGst,
      total: perMonthTotal,
    } = gstBreakdown(perMonthBase, gstPercent, isInclusive);
    return {
      perMonthBase,
      perMonthTaxBase,
      perMonthGst,
      perMonthTotal,
      months: installmentMonths,
      yearTotal: perMonthTotal * installmentMonths,
      // Full-year taxable base roll-up; pairs with the GST roll-up so the
      // monthly subtotal + GST === the full-year total in every GST mode.
      baseTotal: perMonthTaxBase * installmentMonths,
    };
  }, [yearly, installmentMonths, gstPercent, isInclusive]);

  // If installments aren't offered, force the yearly option (and never render
  // the monthly tile). Guards a stale 'monthly' selection on a yearly-only plan.
  const effectiveOption: BillingOption = monthlyOptionAvailable ? option : 'yearly';

  const featureCount = FEATURE_COUNT[plan.tier] ?? 0;
  const maxMembers = plan.entitlements?.maxMembersPerWorkspace ?? 0;
  const isUnlimited = maxMembers === -1;
  const hasEverything = plan.tier !== 'free';
  const isMonthly = effectiveOption === 'monthly';
  // The upfront discount applies ONLY to the yearly-upfront option. Monthly pays
  // the full price in 12 installments (0% interest, no discount), so the discount
  // line must be hidden when monthly is selected - gate it on BOTH "plan has a
  // discount" AND "yearly option chosen".
  const showUpfrontSave = hasUpfrontDiscount(discountPercent) && !isMonthly;

  // Formatted figures reused on the tiles. The yearly/per-month totals back the
  // pay tiles' sub-lines; the savings string backs the yearly "Save X" badge.
  const yearlyTotalStr = Money.fromRupees(yearlyBreakdown.total).format();
  const perMonthStr = Money.fromRupees(monthlyBreakdown.perMonthTotal).format();
  const savingsStr = Money.fromRupees(yearlyBreakdown.savings).format();
  // Full-year roll-up for the monthly schedule line (per-month total × months).
  const monthlyYearTotalStr = Money.fromRupees(monthlyBreakdown.yearTotal).format();

  // Order-summary view derived from the SELECTED pay option, so the summary the
  // user reads always matches what they pay. Was previously hard-wired to the
  // yearly-upfront figures regardless of the choice (the billing-display bug):
  //   - YEARLY: discounted base + yearly GST + discounted grand total due today.
  //   - MONTHLY: FULL-price base (no discount) + full-year GST roll-up; only the
  //     FIRST installment is due today; the rest bill across the term.
  // monthlyBreakdown.perMonthTaxBase/perMonthGst are per-installment; the
  // pre-rolled baseTotal/(GST roll-up) give the full-year breakdown rows.
  // Subtotal uses the CARVED taxable base (baseTotal), NOT the gross
  // perMonthBase, so Subtotal + GST === Total even for inclusive GST (matches
  // the yearly path, which also uses the carved base).
  const summaryBaseStr = isMonthly
    ? Money.fromRupees(monthlyBreakdown.baseTotal).format()
    : Money.fromRupees(yearlyBreakdown.base).format();
  const summaryGstStr = isMonthly
    ? Money.fromRupees(monthlyBreakdown.perMonthGst * monthlyBreakdown.months).format()
    : Money.fromRupees(yearlyBreakdown.gst).format();
  // "Total due today": the whole discounted year upfront, or just the first
  // installment for monthly.
  const dueTodayStr = isMonthly ? perMonthStr : yearlyTotalStr;

  // The Pay CTA + mobile bottom bar carry the amount actually charged today -
  // the first installment for monthly, the full discounted year for yearly.
  const ctaTotalStr = dueTodayStr;

  // Final Pay action. While gated the CTA is disabled (cannot reach this), but
  // keep guard() so the moment payments go live the click runs the real flow.
  const handleProceed = () => {
    // guard() only runs this when payments are live (env.paymentsEnabled). While
    // gated the CTA is disabled, so this whole flow stays dormant until go-live.
    guard(async () => {
      setSubmitting(true);
      try {
        // One-time Razorpay checkout: create order -> hosted sheet -> confirm +
        // activate. NOTE: a paid->paid upgrade charges the FULL plan price here;
        // the proration "pay only the difference" path (change-plan endpoints) is
        // a separate follow-up - the backend supports it, the FE isn't wired yet.
        await purchasePlan({
          planId: plan._id,
          billingCycle: effectiveOption,
          planName: plan.name,
        });
        msgApi.success(t('paySuccess', { plan: plan.name }));
        // The subscription hub is the confirmation surface (shows the active plan).
        router.push('/account/subscription');
      } catch (e) {
        // User closed the Razorpay sheet -> not an error; stay on the page.
        if (e instanceof CheckoutDismissedError) return;
        msgApi.error(t('payError'));
      } finally {
        setSubmitting(false);
      }
    });
  };

  // The Pay CTA, reused by BOTH the desktop order card and the mobile bottom bar
  // so they never drift.
  const payCta = (
    <Button
      type="primary"
      size="large"
      block
      // >=44px tap target for the single primary CTA.
      className="min-h-[2.75rem]"
      disabled={!paymentsEnabled}
      loading={submitting}
      icon={<LockOutlined aria-hidden />}
      onClick={handleProceed}
    >
      {t('paySecurelyAmount', { amount: ctaTotalStr })}
    </Button>
  );

  return (
    <div className="flex flex-col gap-8">
      {ctx}
      {/* 3-step stepper. Step 1 done, step 2 active (current=1), step 3 upcoming.
          AntD Steps with items (v6) - the active step gets process status. */}
      <Steps
        size="small"
        current={1}
        aria-label={t('stepsAriaLabel')}
        items={[{ title: t('step1') }, { title: t('step2') }, { title: t('step3') }]}
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* LEFT column (main): numbered section cards. On mobile this is the whole
            stacked single column; the extra bottom padding keeps content clear of
            the fixed bottom pay bar. 24px (space-y-6) between section cards. */}
        <div className="flex min-w-0 flex-1 flex-col space-y-6 pb-28 lg:basis-3/5 lg:pb-0">
          {/* 1. Your plan - highlighted inner card: icon + name + ANNUAL tag,
              "Change plan" link, tagline, then a 2-column feature checklist. */}
          <SectionCard number={1} title={t('sectionPlanTitle')}>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <SafetyCertificateOutlined aria-hidden className="text-lg" />
                  </span>
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-base font-bold text-heading">{plan.name}</span>
                    {/* ANNUAL term tag (this is a 1-year term plan). */}
                    <Tag className="m-0" color="gold">
                      {t('planTermAnnual')}
                    </Tag>
                  </span>
                </div>
                {/* Change plan -> back to the plans tab (same target as the header). */}
                <Link
                  href={PLANS_HREF}
                  className="shrink-0 text-sm font-medium whitespace-nowrap text-primary no-underline hover:underline"
                >
                  {t('changePlan')}
                </Link>
              </div>

              <p className="m-0 mt-3 text-[13px] text-subtle">
                {tp('plans.' + plan.tier + '.tagline')}
              </p>
              <p className="m-0 mt-1 text-xs font-semibold text-muted">
                {isUnlimited ? t('unlimitedStaff') : t('staffCap', { count: maxMembers })}
              </p>

              {featureCount > 0 && (
                <ul className="m-0 mt-3 grid list-none grid-cols-1 gap-x-4 gap-y-2 p-0 sm:grid-cols-2">
                  {Array.from({ length: featureCount }, (_, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs leading-snug text-muted"
                    >
                      <CheckOutlined
                        aria-hidden
                        className="mt-0.5 shrink-0 text-[11px] text-green-600"
                      />
                      <span>{tp('plans.' + plan.tier + '.f' + (i + 1))}</span>
                    </li>
                  ))}
                  {/* One support line if the plan isn't Free (paid tiers get support). */}
                  {hasEverything && (
                    <li className="flex items-start gap-1.5 text-xs leading-snug text-muted">
                      <CheckOutlined
                        aria-hidden
                        className="mt-0.5 shrink-0 text-[11px] text-green-600"
                      />
                      <span>{t('supportLine')}</span>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </SectionCard>

          {/* 2. How would you like to pay? - two radio TILES. Hint is honest:
              both options are 0% interest, but the upfront discount applies to the
              YEARLY option only, so the two totals differ (monthly = full price). */}
          <SectionCard number={2} title={t('sectionPayTitle')} hint={t('bothBillSame')}>
            {/* Two spacious radio CARDS in a 2-col grid (stacks on mobile). Built
                as custom role=radio buttons (not AntD Radio) so the dot, padding,
                and badge alignment are fully controlled and consistent. */}
            <div
              role="radiogroup"
              aria-label={t('sectionPayTitle')}
              className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {/* Yearly: a "Save X" pill when a discount exists, else a "Best value"
                  pill (same shape/placement, never a fabricated number). */}
              <PayTile
                selected={effectiveOption === 'yearly'}
                onSelect={() => setOption('yearly')}
                title={t('payYearly')}
                subtitle={t('payYearlySub', { amount: yearlyTotalStr })}
                badge={
                  <BadgeGreen>
                    {showUpfrontSave ? t('saveAmount', { amount: savingsStr }) : t('bestValue')}
                  </BadgeGreen>
                }
              />
              {/* Monthly (only when installments enabled): "0% interest" pill +
                  per-month sub. per-month x months ~= the same yearly total. */}
              {monthlyOptionAvailable && (
                <PayTile
                  selected={effectiveOption === 'monthly'}
                  onSelect={() => setOption('monthly')}
                  title={t('payMonthly')}
                  subtitle={t('payMonthlySub', {
                    amount: perMonthStr,
                    months: monthlyBreakdown.months,
                  })}
                  badge={<BadgeGreen>{t('zeroInterest')}</BadgeGreen>}
                />
              )}
            </div>
          </SectionCard>

          {/* 3. Payment method - DISABLED VISUAL PREVIEW. Method chips + a card
              form that NEVER collects raw card data (PCI). Razorpay's hosted
              checkout collects it when payments go live; this is a placeholder. */}
          <SectionCard
            number={3}
            title={t('sectionPaymentMethodTitle')}
            hint={t('transactionsEncrypted')}
          >
            {/* Method chips (Card / UPI / Net banking). Visual-only selection -
                the real method is chosen on Razorpay's hosted page. */}
            <div
              className="mb-4 flex flex-wrap gap-2"
              role="radiogroup"
              aria-label={t('sectionPaymentMethodTitle')}
            >
              <MethodChip
                active={method === 'card'}
                onClick={() => setMethod('card')}
                icon={<CreditCardOutlined aria-hidden />}
                label={t('methodCard')}
              />
              <MethodChip
                active={method === 'upi'}
                onClick={() => setMethod('upi')}
                label={t('methodUpi')}
              />
              <MethodChip
                active={method === 'netbanking'}
                onClick={() => setMethod('netbanking')}
                label={t('methodNetBanking')}
              />
            </div>

            {/*
              DISABLED card-form PREVIEW. CRITICAL: these inputs are NOT wired to
              any state or submit and are all `disabled`. We NEVER collect raw
              card data on our own page - that is Razorpay's PCI-scoped hosted
              checkout's job once payments go live. This block is a design
              placeholder to be replaced by the Razorpay handoff at that time.
            */}
            <fieldset
              disabled
              className="m-0 flex flex-col gap-3 border-0 p-0"
              aria-label={t('paymentMethodLegend')}
            >
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                {t('nameOnCard')}
                <Input disabled placeholder="—" aria-label={t('nameOnCard')} />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                {t('cardNumber')}
                <Input
                  disabled
                  placeholder="•••• •••• •••• ••••"
                  aria-label={t('cardNumber')}
                  suffix={
                    <span className="flex items-center gap-1 text-[10px] font-bold tracking-wide text-faint">
                      <span>VISA</span>
                      <span>MC</span>
                    </span>
                  }
                />
              </label>
              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
                  {t('cardExpiry')}
                  <Input disabled placeholder="MM/YY" aria-label={t('cardExpiry')} />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted">
                  {t('cardCvv')}
                  <Input disabled placeholder="•••" aria-label={t('cardCvv')} />
                </label>
              </div>
            </fieldset>

            {/* Plain-language note: the real secure entry opens on continue.
                Separated from the card fields (top border + spacing) so it never
                reads as glued to the Expiry/CVV row. */}
            <p className="m-0 mt-4 flex items-center gap-2 border-t border-gray-100 pt-3 text-xs text-subtle">
              <LockOutlined aria-hidden className="text-faint" />
              {t('cardPreviewNote')}
            </p>
          </SectionCard>

          {/*
            4. Billing details (GSTIN) - BUILT but flagged OFF (SHOW_BILLING_DETAILS
            === false) until GST invoicing ships (owner, 2026-06-23). The
            collapsible markup below is ready to re-introduce by flipping the flag;
            it never renders today.
          */}
          {SHOW_BILLING_DETAILS && (
            <SectionCard number={4} title={t('billingDetailsToggle')}>
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {t('gstin')}
                  <Input placeholder={t('gstin')} aria-label={t('gstin')} />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {t('registeredBusinessName')}
                  <Input
                    placeholder={t('registeredBusinessName')}
                    aria-label={t('registeredBusinessName')}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {t('invoiceEmail')}
                  <Input
                    type="email"
                    placeholder={t('invoiceEmail')}
                    aria-label={t('invoiceEmail')}
                  />
                </label>
              </div>
            </SectionCard>
          )}
        </div>

        {/* RIGHT column (aside): the Order summary card. STICKY on desktop so it
            stays beside the scrolling left column; visually emphasized. On mobile
            the card still renders (full breakdown), but the Pay CTA is suppressed
            here and shown in the fixed bottom bar instead. */}
        <aside className="w-full lg:sticky lg:top-6 lg:basis-2/5">
          {/* Labelled region so assistive tech (and tests) address the order
              summary distinctly from the mobile bottom bar (which echoes total). */}
          <div
            role="region"
            aria-label={t('orderSummary')}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-md ring-1 ring-black/[0.02]"
          >
            <p className="m-0 text-base font-bold text-heading">{t('orderSummary')}</p>
            <p className="m-0 mt-1 text-xs text-subtle">
              {t('billedAnnually', { date: renewalDate })}
            </p>

            {/* Line item: plan - Annual + member cap, with the yearly price right. */}
            <div className="mt-4 flex items-start justify-between gap-3 border-t border-gray-100 pt-4">
              <div className="min-w-0">
                <p className="m-0 text-sm font-medium text-heading">
                  {t('lineAnnual', { plan: plan.name })}
                </p>
                <p className="m-0 mt-0.5 text-xs text-muted">
                  {isUnlimited
                    ? t('lineMembersUnlimited')
                    : t('lineMembers', { count: maxMembers })}
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-heading tabular-nums">
                {Money.fromRupees(yearly).format()}
              </span>
            </div>

            {/* Subtotal (post-discount taxable base) + optional saved + GST. */}
            <div className="mt-4 flex flex-col gap-2 tabular-nums">
              {showUpfrontSave && (
                <Line
                  label={t('upfrontDiscount', { percent: discountPercent })}
                  value={`−${savingsStr}`}
                  accent="discount"
                />
              )}
              {/* Subtotal follows the chosen option: discounted yearly base, or
                  the FULL-price full-year base for monthly (no discount). */}
              <Line label={t('subtotal')} value={summaryBaseStr} />
              {/* GST line shows ONLY when GST is enabled for this plan. When off,
                  nothing renders here and Total === Subtotal (no tax added).
                  Gated on plan.gstEnabled (backend Plan.gstEnabled contract). The
                  value is the option-matched GST (full-year roll-up for monthly). */}
              {gstEnabled && (
                <Line
                  label={
                    isInclusive
                      ? t('gstInclusive', { percent: gstPercent })
                      : t('gst', { percent: gstPercent })
                  }
                  value={summaryGstStr}
                />
              )}
            </div>

            {/* Total due today - the most prominent number, divider above. For
                yearly it's the discounted year; for monthly only the FIRST
                installment is due today, with a schedule sub-line and a
                monthly-aware auto-renew note. */}
            <div className="mt-3 border-t border-gray-200 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold text-heading">{t('totalDueToday')}</span>
                <span className="text-2xl font-bold text-heading tabular-nums">{dueTodayStr}</span>
              </div>
              <p className="m-0 mt-1 text-xs text-subtle">
                {isMonthly
                  ? t('dueTodaySubMonthly', {
                      amount: perMonthStr,
                      months: monthlyBreakdown.months,
                      yearTotal: monthlyYearTotalStr,
                    })
                  : t('totalSubOneTime')}
              </p>
              <p className="m-0 mt-1 text-xs text-subtle">
                {isMonthly
                  ? t('autoRenewNoteMonthly', {
                      amount: perMonthStr,
                      yearTotal: monthlyYearTotalStr,
                      date: renewalDate,
                    })
                  : t('autoRenewNote', { amount: yearlyTotalStr, date: renewalDate })}
              </p>
            </div>

            {/* Coupon - field + Apply. GATED: Apply surfaces a "live later" note,
                never a fake discount. */}
            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="m-0 mb-2 text-sm font-semibold text-heading">{t('couponHeading')}</p>
              <div className="flex gap-2">
                <Input
                  value={coupon}
                  onChange={(e) => {
                    setCoupon(e.target.value);
                    if (couponTried) setCouponTried(false);
                  }}
                  placeholder={t('couponPlaceholder')}
                  aria-label={t('couponHeading')}
                />
                <Button onClick={() => setCouponTried(true)}>{t('couponApply')}</Button>
              </div>
              {couponTried && (
                <p className="m-0 mt-2 flex items-center gap-1.5 text-xs text-subtle">
                  <InfoCircleOutlined aria-hidden />
                  {t('couponGated')}
                </p>
              )}
            </div>

            {/* Desktop CTA: lives in the sticky order card. Hidden on mobile,
                where the bottom bar carries it instead. */}
            <div className="mt-4 hidden flex-col gap-2 lg:flex">
              {payCta}
              <p className="m-0 text-center text-xs text-subtle">{t('notChargedYet')}</p>
            </div>
          </div>
        </aside>

        {/* MOBILE sticky bottom bar: Total + Pay button pinned to the bottom of
            the viewport so the primary action is always thumb-reachable.
            Safe-area padded, hidden on desktop. The full breakdown stays in the
            order card above. */}
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-muted">{t('totalDueToday')}</span>
            {/* Mobile bar mirrors the desktop "Total due today" - option-matched
                (first installment for monthly), never the yearly total. */}
            <span className="text-lg font-bold text-heading tabular-nums">{dueTodayStr}</span>
          </div>
          {payCta}
        </div>
      </div>
    </div>
  );
}

/**
 * A numbered section card: a small numbered badge + heading, an optional
 * right-aligned muted hint, then the section body. Clean surface with a subtle
 * border; 12px heading->content rhythm. Presentational only.
 */
function SectionCard({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
          >
            {number}
          </span>
          <h2 className="m-0 text-sm font-semibold text-heading">{title}</h2>
        </div>
        {hint && <span className="text-right text-xs text-faint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * One pay-choice radio TILE: a labelled radio with a title, a price sub-line,
 * and a badge (Save X / Best value / 0% interest). Selected = primary border +
 * subtle tint; min-h keeps the tap target >=44px.
 */
function PayTile({
  selected,
  onSelect,
  title,
  subtitle,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  badge: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex h-full items-start gap-3 rounded-2xl border p-5 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/5'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/60'
      }`}
    >
      {/* Custom radio dot, nudged to align with the title row. */}
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          selected ? 'border-primary' : 'border-gray-300'
        }`}
      >
        {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
      </span>
      {/* Title + badge on the top row (badge aligned with the title across both
          tiles); the price sub-line sits full-width below with room to breathe. */}
      <span className="flex w-full flex-col gap-1.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[15px] leading-tight font-semibold text-heading">{title}</span>
          {badge}
        </span>
        <span className="text-sm leading-relaxed text-subtle tabular-nums">{subtitle}</span>
      </span>
    </button>
  );
}

/** Green pill badge (Save X / Best value / 0% interest) — top-right of a tile. */
function BadgeGreen({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-[11px] leading-none font-semibold text-green-700 tabular-nums">
      {children}
    </span>
  );
}

/**
 * A selectable payment-method chip (Card / UPI / Net banking). Visual selection
 * only - the real method is chosen on Razorpay's hosted page. role=radio so the
 * chip group is an accessible single-select.
 */
function MethodChip({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-gray-200 text-muted hover:border-gray-300'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** One label/value row in the breakdown. `accent="discount"` greens the value. */
function Line({ label, value, accent }: { label: string; value: string; accent?: 'discount' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={accent === 'discount' ? 'text-green-700' : 'text-muted'}>{label}</span>
      <span className={accent === 'discount' ? 'text-green-700' : 'text-heading'}>{value}</span>
    </div>
  );
}
