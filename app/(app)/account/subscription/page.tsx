'use client';

/**
 * Account Subscription hub - Overview tab. The product-neutral home for a
 * person's plan, reachable by ANY signed-in user (ERP or Connect-only). It sits
 * under app/account/* which runs NO ERP PolicyGate. The section's other tabs
 * (Plans / Add-Ons / Credits / Invoices / Billing Info / Payment Method /
 * Refunds / History - see app/account/subscription/layout.tsx) were relocated
 * here from the old ERP-gated /dashboard/subscription/* (which now 301s here via
 * next.config), so this is the single complete subscription home for everyone.
 *
 * Data is user-scoped (getMySubscription / getMySubscriptionHistory / getTiers /
 * cancelSubscription authorize on the caller and carry no App Lock), so the page
 * renders for any authed user. A Connect-only user simply has no paid plan, so we
 * show the calm "no active plan" state and never crash on missing context. The
 * deep links/tabs are shown to EVERYONE now (no paid-only gate); each tab renders
 * its own honest empty state for free / Connect-only users.
 *
 * Buy / upgrade actions (on the Plans / Credits / Add-Ons tabs) are gated behind
 * env.paymentsEnabled (usePaymentsGate) until online payments go live - this
 * overview only links across to those tabs, it does not buy directly.
 *
 * Cross-module links: lib/actions (subscription server actions),
 * useSubscriptionStore (kept in sync so the global dunning banner reads the
 * same), and the sibling tab pages under app/account/subscription/*.
 */

import { useEffect, useState, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { Card, Button, Tag, Spin, Alert, message } from 'antd';
import {
  CrownOutlined,
  CalendarOutlined,
  RocketOutlined,
  StopOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  // IdcardOutlined - re-import when the Billing Info quick link below is re-enabled.
  // CreditCardOutlined - re-import when the Payment Method quick link below is re-enabled.
  LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getMySubscription,
  getMySubscriptionHistory,
  getTiers,
  cancelSubscription,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { useSubscriptionStore } from '@/lib/store';
import { MandateManager } from '@/components/subscription/MandateManager';
import { CancelWithOfferModal } from '@/components/subscription/CancelWithOfferModal';
import type { Plan, Subscription, Tier } from '@/types';

interface SubResponse {
  subscription: Subscription | null;
  scheduled: Subscription | null;
  plan: Plan | null;
  entitlements: unknown;
  usage: unknown;
}

export default function AccountSubscriptionPage() {
  const [data, setData] = useState<SubResponse | null>(null);
  const [history, setHistory] = useState<Subscription[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    const [my, hist] = await Promise.all([
      getMySubscription(),
      getMySubscriptionHistory().catch(() => []),
    ]);
    startTransition(() => {
      setData(my ?? null);
      setHistory(hist ?? []);
    });
    const store = useSubscriptionStore.getState();
    store.setSubscription(my?.subscription ?? null);
    if (my?.entitlements) store.setEntitlements(my.entitlements);
  }, []);

  useEffect(() => {
    Promise.all([refresh(), getTiers().catch(() => [])])
      .then(([, t]) => setTiers((t as Tier[]) ?? []))
      .finally(() => setLoading(false));
  }, [refresh]);

  const sub = data?.subscription ?? null;
  const scheduled = data?.scheduled ?? null;
  const plan = data?.plan ?? (sub && typeof sub.planId === 'object' ? (sub.planId as Plan) : null);

  const tierColor = tiers.find((t) => t.key === plan?.tier)?.color ?? 'default';

  const isActive = sub?.status === 'active' || sub?.status === 'trial';
  const isCancelled = sub?.status === 'cancelled';
  const isPaused = sub?.status === 'paused' || sub?.isPaused;
  const isInDunning = sub?.status === 'past_due' || sub?.status === 'grace_period';
  const hasMandate = !!sub?.razorpaySubscriptionId;
  const periodEnd = sub?.currentPeriodEnd ? dayjs(sub.currentPeriodEnd).format('DD MMM YYYY') : '-';

  const handleConfirmCancel = async () => {
    setCancelling(true);
    try {
      await cancelSubscription();
      msgApi.success('Subscription cancelled. Access continues until period end.');
      setCancelModalOpen(false);
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {ctx}

      {/* Headline plan card */}
      {!sub ? (
        <Card className="rounded-2xl border-[1.5px] border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-gray-200">
                <LockOutlined className="text-[22px] text-faint" />
              </div>
              <div>
                <p className="m-0 font-display text-lg font-extrabold text-heading">
                  No Active Plan
                </p>
                <p className="m-0 text-[13px] text-muted">Choose a plan to unlock all features.</p>
              </div>
            </div>
            {/* Browse all plans (Plans tab). Shown to everyone now that the tab
                lives in the neutral account hub; the buy action there is gated by
                env.paymentsEnabled until online payments are live. */}
            <Link href="/account/subscription/plans">
              <Button type="primary" icon={<RocketOutlined />} size="large">
                Browse Plans
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card
          className={`rounded-2xl border-[1.5px] ${
            isCancelled
              ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-red-50'
              : isPaused
                ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50'
                : 'border-primary-border bg-gradient-to-br from-blue-50 to-indigo-50'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-[14px]"
                style={{
                  background: tierColor === 'default' ? 'var(--cr-info-50)' : `${tierColor}22`,
                }}
              >
                <CrownOutlined className="text-[22px]" style={{ color: tierColor }} />
              </div>
              <div>
                <p className="m-0 font-display text-lg font-extrabold text-heading">
                  {plan?.name ?? 'Active Plan'}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {plan?.tier && (
                    <Tag color={tierColor} className="capitalize">
                      {plan.tier}
                    </Tag>
                  )}
                  <Tag>{sub.status}</Tag>
                  {hasMandate && (
                    <Tag icon={<ThunderboltOutlined />} color="blue">
                      Auto-Renew
                    </Tag>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="m-0 mb-0.5 text-xs text-subtle">
                  {isCancelled
                    ? 'Access until'
                    : isPaused
                      ? 'Will resume on'
                      : hasMandate
                        ? 'Renews'
                        : 'Ends'}
                </p>
                <p className="m-0 text-sm font-semibold text-heading">{periodEnd}</p>
              </div>

              {/* Change plan -> Plans tab (the buy action is gated by
                  env.paymentsEnabled until online payments are live). */}
              <Link href="/account/subscription/plans">
                <Button icon={<EyeOutlined />}>Change Plan</Button>
              </Link>

              {isActive && plan?.tier !== 'free' && (
                <Button danger icon={<StopOutlined />} onClick={() => setCancelModalOpen(true)}>
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Scheduled plan banner */}
      {scheduled && (
        <Card className="rounded-2xl border-[1.5px] border-blue-300 bg-blue-50">
          <div className="flex items-center gap-3">
            <CalendarOutlined className="text-2xl text-blue-700" />
            <div className="flex-1">
              <p className="m-0 font-semibold text-heading">
                Next plan queued:{' '}
                {typeof scheduled.planId === 'object' ? scheduled.planId.name : 'Custom'}
              </p>
              <p className="m-0 text-xs text-muted">
                Activates{' '}
                {scheduled.currentPeriodStart
                  ? dayjs(scheduled.currentPeriodStart).format('DD MMM YYYY')
                  : '-'}
              </p>
            </div>
            <Link href="/account/subscription/plans">
              <Button>Manage</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Dunning indicator (in addition to global banner). Only meaningful with a
          real paid subscription, so it is naturally Connect-safe. */}
      {isInDunning && (
        <Alert
          type="error"
          showIcon
          title="Payment failed - action required"
          description={
            <span>
              Update your payment method to keep your subscription active.{' '}
              <Link href="/account/subscription/payment-method" className="underline">
                Go to Payment Method →
              </Link>
            </span>
          }
        />
      )}

      {/* Communication-credits low-balance banner hidden for this phase (owner
          decision 2026-06-25) - the credits feature is not live yet, so we don't
          prompt about it. Re-enable this AND the LowBalanceBanner component at the
          bottom of this file when the credits feature ships. */}
      {/* <LowBalanceBanner entitlements={data?.entitlements} /> */}

      {/* Mandate manager (only when mandate exists - i.e. a real ERP auto-renew). */}
      {sub && hasMandate && <MandateManager subscription={sub} onChanged={refresh} />}

      {/* Quick links to the billing tabs. Shown to everyone now (the tabs live in
          the neutral account hub); each tab renders an honest empty state for
          free / Connect-only users. */}
      {/* Quick links. Billing Info + Payment Method cards are hidden for this
          phase (owner decision 2026-06-25), matching their hidden tabs, leaving
          just Invoices. Re-enable the cards (and re-import IdcardOutlined /
          CreditCardOutlined above) when those tabs return. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <QuickLinkCard
          icon={<FileTextOutlined />}
          title="Invoices"
          desc="Download GST invoices for every payment."
          href="/account/subscription/invoices"
        />
        {/* <QuickLinkCard
          icon={<IdcardOutlined />}
          title="Billing Info"
          desc="GSTIN, business name, billing address."
          href="/account/subscription/billing-info"
        /> */}
        {/* <QuickLinkCard
          icon={<CreditCardOutlined />}
          title="Payment Method"
          desc="Pause, resume or update your auto-renew."
          href="/account/subscription/payment-method"
        /> */}
      </div>

      {/* Recent history snippet */}
      {history.length > 0 && (
        <Card className="rounded-2xl">
          <div className="mb-3 flex items-center justify-between">
            <p className="m-0 text-base font-semibold text-heading">Recent activity</p>
            <Link href="/account/subscription/history">
              <Button type="link" className="px-0">
                View all →
              </Button>
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {history.slice(0, 3).map((row) => {
              const planName = typeof row.planId === 'object' ? row.planId.name : 'Custom';
              const tier = typeof row.planId === 'object' ? row.planId.tier : null;
              return (
                <div
                  key={row._id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <CrownOutlined className="text-muted" />
                    <span className="text-sm font-medium text-heading">{planName}</span>
                    {tier && <Tag className="capitalize">{tier}</Tag>}
                  </div>
                  <div className="flex items-center gap-3">
                    <Tag>{row.status}</Tag>
                    <span className="text-xs text-subtle">
                      {row.currentPeriodStart
                        ? dayjs(row.currentPeriodStart).format('DD MMM YYYY')
                        : '-'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <CancelWithOfferModal
        open={cancelModalOpen}
        subscription={sub}
        hasMandate={hasMandate}
        cancelling={cancelling}
        onCancel={() => setCancelModalOpen(false)}
        onPauseInstead={() => {
          setCancelModalOpen(false);
          window.location.href = '/account/subscription/payment-method';
        }}
        onConfirmCancel={handleConfirmCancel}
      />
    </div>
  );
}

function QuickLinkCard({
  icon,
  title,
  desc,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card hoverable className="h-full rounded-2xl transition-all hover:border-blue-400">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-700">
            {icon}
          </div>
          <div className="flex-1">
            <p className="m-0 mb-1 font-semibold text-heading">{title}</p>
            <p className="m-0 text-xs text-muted">{desc}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

/* LowBalanceBanner hidden for this phase (owner decision 2026-06-25) - the
   communication-credits feature is not live yet, so we never show a
   "credits running low" prompt. Re-enable this component AND its render above
   (search "LowBalanceBanner") when the credits feature ships.

function LowBalanceBanner({ entitlements }: { entitlements: unknown }) {
  const comms: any = (entitlements as any)?.communications ?? null;
  if (!comms) return null;
  if (comms.autoRechargeEnabled) return null;
  const sms = comms.smsCreditsBalance ?? 0;
  const wa = comms.whatsappCreditsBalance ?? 0;
  const smsThreshold = comms.autoRechargeThresholdSms ?? 50;
  const waThreshold = comms.autoRechargeThresholdWhatsapp ?? 50;
  const smsLow = sms < smsThreshold;
  const waLow = wa < waThreshold;
  if (!smsLow && !waLow) return null;
  return (
    <Alert
      type="warning"
      showIcon
      title="Communication credits running low"
      description={
        <span>
          SMS: <strong>{sms}</strong> · WhatsApp: <strong>{wa}</strong> credits left. Top up to keep
          reminders flowing.{' '}
          <Link href="/account/subscription/credits" className="underline">
            Buy credits →
          </Link>
        </span>
      }
    />
  );
}
*/
