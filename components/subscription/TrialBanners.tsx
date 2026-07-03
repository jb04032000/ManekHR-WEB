'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from 'antd';
import {
  ArrowUpOutlined,
  GiftOutlined,
  ExclamationCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useSubscriptionStore } from '@/lib/store';
import { trialDaysLeft } from '@/lib/trial';

// Two mutually-exclusive dashboard banners driven by the subscription store:
//
//  1. Trial countdown ("Full access - N days left") - while status==='trial'
//     and trialEndsAt is in the future. Positive/info tone. Dismiss is
//     per-SESSION (sessionStorage) so it reappears next visit - we never
//     permanently hide an active trial.
//  2. Post-expiry ("Your full access ended") - once trialEndedAt is set AND the
//     account is back on a free/non-paid plan. Warning tone. Dismiss is keyed by
//     the trialEndedAt timestamp in localStorage, so a brand-new downgrade event
//     re-shows the banner but the same one stays hidden.
//
// Cross-module links:
//  - Store: lib/store.ts useSubscriptionStore (subscription + plan). The store
//    is hydrated/polled app-wide by components/layout/DashboardLayout.tsx, so we
//    read it rather than firing our own subscription action.
//  - Mounted at the top of the dashboard content in
//    components/layout/DashboardLayout.tsx (above the page, ERP only).
//  - CTA -> /account/subscription/plans (same plans hub as the sidebar Upgrade
//    button + MemberCapNotice).
//
// Keep in sync with: the Subscription type (status / trialEndsAt / trialEndedAt
// in types/index.ts) and the i18n block dashboard.upgrade.* (all four locales).

const PLANS_ROUTE = '/account/subscription/plans';
const TRIAL_DISMISS_KEY = 'z360:trial-countdown-dismissed'; // session-scoped
const EXPIRY_DISMISS_PREFIX = 'z360:trial-ended-dismissed:'; // localStorage, per-timestamp

/** A plan tier counts as "paid" for the post-expiry gate when it isn't free/default. */
function isPaidTier(tier?: string | null): boolean {
  if (!tier) return false;
  const t = tier.toLowerCase();
  return t !== 'free' && t !== 'default' && t !== 'trial';
}

function UpgradeCta({ label }: { label: string }) {
  return (
    <Link href={PLANS_ROUTE} className="no-underline">
      <Button type="primary" icon={<ArrowUpOutlined />} className="cr-cta-gold">
        {label}
      </Button>
    </Link>
  );
}

/**
 * Shared dashboard trial-notice card. Matches the in-app plans-hub banner
 * (components/subscription/TrialStatusBanner.tsx): rounded-2xl, brand-tinted
 * surface, white icon chip, font-display headline + muted subtext - instead of
 * the old flat AntD info/warning Alert. Keeps the dashboard-only affordances the
 * status card doesn't have: a brand "See plans/Upgrade" CTA and a dismiss button.
 *
 * tone: 'gold' for the positive live-trial countdown (mirrors the gold plans-page
 * banner); 'warning' (amber) for the post-expiry notice. Keep visually in sync
 * with TrialStatusBanner if that card's styling changes.
 */
function TrialNoticeCard({
  tone,
  icon,
  title,
  body,
  ctaLabel,
  onDismiss,
  dismissLabel,
}: {
  tone: 'gold' | 'warning';
  icon: ReactNode;
  title: string;
  body: string;
  ctaLabel: string;
  onDismiss: () => void;
  dismissLabel: string;
}) {
  const gold = tone === 'gold';
  return (
    <div
      role="note"
      className={`mb-[25px] flex flex-wrap items-center gap-4 rounded-2xl border px-4 py-4 sm:px-5 ${
        gold
          ? 'border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)]'
          : 'border-[var(--cr-warning)] bg-[var(--cr-warning-bg)]'
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
        <span
          aria-hidden
          className="text-xl"
          style={{ color: gold ? 'var(--cr-gold-700)' : 'var(--cr-warning)' }}
        >
          {icon}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 font-display text-[15px] font-bold text-heading sm:text-base">{title}</p>
        <p className="m-0 mt-0.5 text-sm text-muted">{body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <UpgradeCta label={ctaLabel} />
        <Button
          type="text"
          shape="circle"
          aria-label={dismissLabel}
          icon={<CloseOutlined />}
          onClick={onDismiss}
        />
      </div>
    </div>
  );
}

export function TrialBanners() {
  const t = useTranslations('dashboard.upgrade');
  // Reuse the shared common.close label for the dismiss button's accessible name
  // (exists in all four locales - no new key needed).
  const tc = useTranslations('common');
  const pathname = usePathname();
  const subscription = useSubscriptionStore((s) => s.subscription);
  const plan = useSubscriptionStore((s) => s.plan);
  const isHydrated = useSubscriptionStore((s) => s.isHydrated);

  // Capture "now" once at mount (lazy state init) instead of calling the impure
  // Date.now() during render - day-granularity banners do not need a live clock,
  // and a stable value keeps render pure (react-hooks/purity).
  const [nowMs] = useState(() => Date.now());

  // ── Trial countdown ────────────────────────────────────────────────
  const trialEndsAtMs = subscription?.trialEndsAt
    ? new Date(subscription.trialEndsAt).getTime()
    : null;
  const isLiveTrial =
    subscription?.status === 'trial' && trialEndsAtMs != null && trialEndsAtMs > nowMs;
  // Shared calendar-day helper (lib/trial) - keeps this count identical to the
  // plans-page TrialStatusBanner and reads "45", not "46", for a 45-day trial.
  const daysLeft = useMemo(
    () => trialDaysLeft(subscription?.trialEndsAt ?? null, nowMs),
    [subscription?.trialEndsAt, nowMs],
  );

  // Lazy initial state - read storage during first render to avoid a
  // setState-in-effect cascade on mount (mirrors DunningBanner).
  const [trialDismissed, setTrialDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(TRIAL_DISMISS_KEY) === '1';
  });

  // ── Post-expiry ────────────────────────────────────────────────────
  const trialEndedAt = subscription?.trialEndedAt ?? null;
  // Lapsed-to-Free = a trialEndedAt stamp AND the account is NOT on a paid tier.
  const isLapsedToFree = !!trialEndedAt && !isPaidTier(plan?.tier);
  const expiryDismissKey = trialEndedAt ? `${EXPIRY_DISMISS_PREFIX}${trialEndedAt}` : null;

  const [expiryDismissed, setExpiryDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !expiryDismissKey) return false;
    return window.localStorage.getItem(expiryDismissKey) === '1';
  });

  // Don't flash either banner before the persisted store has rehydrated.
  if (!isHydrated) return null;

  // On the subscription hub the in-context TrialStatusBanner already shows the
  // detailed trial status (days left + end date), so this global reminder would
  // be a duplicate there - and its "See plans" CTA is pointless on the plans page
  // itself. Suppress it across the subscription hub; it still shows on every
  // other ERP page.
  if (pathname?.startsWith('/account/subscription')) return null;

  const handleTrialDismiss = () => {
    setTrialDismissed(true);
    if (typeof window !== 'undefined') window.sessionStorage.setItem(TRIAL_DISMISS_KEY, '1');
  };

  const handleExpiryDismiss = () => {
    setExpiryDismissed(true);
    if (typeof window !== 'undefined' && expiryDismissKey) {
      window.localStorage.setItem(expiryDismissKey, '1');
    }
  };

  // Mutual exclusion: a live trial wins (a lapsed account is never status==='trial').
  // Gold positive card mirrors the plans-hub in-trial banner (TrialStatusBanner).
  if (isLiveTrial && !trialDismissed) {
    return (
      <TrialNoticeCard
        tone="gold"
        icon={<GiftOutlined />}
        title={t('trial.title', { days: daysLeft })}
        body={t('trial.body')}
        ctaLabel={t('trial.cta')}
        onDismiss={handleTrialDismiss}
        dismissLabel={tc('close')}
      />
    );
  }

  // Post-expiry: same card anatomy in a warning (amber) tone.
  if (isLapsedToFree && !expiryDismissed) {
    return (
      <TrialNoticeCard
        tone="warning"
        icon={<ExclamationCircleOutlined />}
        title={t('expired.title')}
        body={t('expired.body')}
        ctaLabel={t('expired.cta')}
        onDismiss={handleExpiryDismiss}
        dismissLabel={tc('close')}
      />
    );
  }

  return null;
}

export default TrialBanners;
