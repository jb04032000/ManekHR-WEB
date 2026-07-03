'use client';

/**
 * Dedicated ERP-plan checkout PAGE (focused, distraction-free). Replaced the old
 * PaymentCheckoutModal: a real page handles mobile better, gives Razorpay a true
 * return/callback surface, and has room for a proper 2-column order layout.
 *
 * Placement note (binding): this route lives at app/account/checkout/* and NOT
 * under app/account/subscription/*, because the subscription segment's layout
 * (app/account/subscription/layout.tsx) renders SubscriptionNavTabs (Overview /
 * Plans / Add-Ons / ... tabs). A focused checkout must NOT show those tabs, so it
 * sits in its own account segment - it inherits only the neutral account chrome,
 * never the subscription tab bar.
 *
 * What it does: reads ?plan=<id> from the query, fetches the public ERP plans
 * (same filter as the plans page), finds the chosen plan, and renders the header
 * (back link + title + subtitle) above the shared CheckoutView body (the 3-step
 * stepper + numbered sections + sticky order summary). If the plan id is
 * missing/invalid (not a valid public ERP plan), it shows a friendly "that plan
 * isn't available" fallback with a route back to the plans tab - never a crash.
 *
 * Cross-module links:
 *  - Trigger: app/account/subscription/plans/page.tsx Subscribe navigates here
 *    (router.push('/account/checkout?plan=' + id)) for PAID plans; Free still
 *    activates directly there (no checkout).
 *  - Body + gating + price math: components/subscription/CheckoutView.tsx.
 *  - Data: lib/actions getPlans / getMySubscription (server actions).
 *  - The public-ERP filter MUST stay in sync with the plans page's filter and
 *    the marketing pricing page's selectPublicErpPlans.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Spin } from 'antd';
import { ArrowLeftOutlined, CrownOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { getPlans, getMySubscription } from '@/lib/actions';
import { CheckoutView } from '@/components/subscription/CheckoutView';
import type { PlanWithBilling } from '@/types';

const PLANS_HREF = '/account/subscription/plans';

export default function CheckoutPage() {
  const t = useTranslations('profile.subscription.checkout');
  const searchParams = useSearchParams();
  const planId = searchParams?.get('plan') ?? '';

  const [plan, setPlan] = useState<PlanWithBilling | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      getPlans(),
      // Context only (used by the Razorpay-live path for upgrade proration etc.);
      // fail-soft so a stale/missing subscription never blocks the review screen.
      getMySubscription().catch(() => null),
    ])
      .then(([p]) => {
        if (!active) return;
        // Only self-serve ERP plans are valid checkout targets: active, ERP
        // product (legacy plans omit `product`, default erp), publicly visible,
        // and not the contact-us Custom. Mirrors the plans page filter.
        const publicErp = ((p as PlanWithBilling[]) ?? []).filter((pl) => {
          const isErp = !pl.product || pl.product === 'erp';
          const isPublic = pl.isPubliclyVisible !== false;
          const notCustom = pl.isCustom !== true;
          return pl.isActive && isErp && isPublic && notCustom;
        });
        setPlan(publicErp.find((pl) => pl._id === planId) ?? null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [planId]);

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  // Not-found / empty: no plan id, an unknown id, or a non-public/non-ERP plan.
  // Friendly fallback with a route back to the plans tab - never a crash.
  if (!plan) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <InboxOutlined className="text-2xl text-faint" aria-hidden />
        </div>
        <h1 className="m-0 mb-2 font-display text-xl font-bold text-heading">
          {t('notFoundTitle')}
        </h1>
        <p className="m-0 mb-6 text-sm text-muted">{t('notFoundBody')}</p>
        <Link href={PLANS_HREF}>
          <Button type="primary" size="large" icon={<CrownOutlined />}>
            {t('notFoundCta')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header: back-to-plans link + page title (reuses the modal's title key). */}
      <Link
        href={PLANS_HREF}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted no-underline transition-colors hover:text-heading"
      >
        <ArrowLeftOutlined aria-hidden />
        {t('backToPlans')}
      </Link>
      {/* Header: big title + subtitle. The 3-step stepper lives in CheckoutView
          (it's body chrome that tracks the in-page review state). */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <CrownOutlined className="text-primary" aria-hidden />
          <h1 className="m-0 font-display text-2xl font-bold text-heading">{t('title')}</h1>
        </div>
        <p className="m-0 mt-2 max-w-2xl text-sm text-muted">{t('subtitle')}</p>
      </div>

      <CheckoutView plan={plan} />
    </div>
  );
}
