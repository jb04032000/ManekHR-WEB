'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Modal, message } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { startTrial, type TrialState } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { trialDaysLeft } from '@/lib/trial';

/**
 * State-aware, in-app trial banner for the opt-in trial model.
 *
 * What it does: reads the caller's TrialState (from getTrialState) and renders
 * ONE of three things:
 *  - canStartTrial -> a gold "success" Alert + "Start free trial" button that
 *    opens a confirm Modal; on confirm it calls startTrial(), toasts, and calls
 *    onStarted so the page refetches (banner flips to the in-trial view).
 *  - isInTrial -> a positive "success" Alert with days-left + end date, no button.
 *  - otherwise (trial used, or no trial plan configured) -> null. The trial is
 *    one-time, so a used/unavailable trial offers nothing.
 *
 * Cross-module links: replaces the presentational TrialPromoBanner ONLY on the
 * in-app plans hub (app/account/subscription/plans/page.tsx); the public
 * marketing pricing page keeps TrialPromoBanner. Actions: lib/actions
 * getTrialState (caller-fetched, passed in) + startTrial (POST). i18n under
 * subscription.trial.* (all four locales).
 *
 * Watch:
 *  - trialEndsAt is null in the eligible state (trial not started yet), so the
 *    confirm copy says "{days} days of full access" rather than a fabricated
 *    end date. The end date only appears once isInTrial (trialEndsAt is real).
 *  - The gold Alert styling matches TrialPromoBanner for visual consistency.
 *  - The icon is decorative (aria-hidden); the title carries meaning for SR.
 *  - bannerEnabled + headlineOverride come from the SAME admin "Trial Banner"
 *    config (getTrialBannerConfig) that drives the public TrialPromoBanner, so
 *    the owner's toggle + custom headline now also reach this in-app eligible
 *    promo. They affect ONLY the canStartTrial state: the in-trial countdown is
 *    the user's own live status (not a promo) and ignores both.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

export function TrialStatusBanner({
  state,
  onStarted,
  // Admin "Trial Banner" config (getTrialBannerConfig). bannerEnabled gates the
  // eligible promo; headlineOverride replaces its default title. Defaulted so
  // callers that don't pass them keep the prior behaviour (always-on, default
  // localized headline).
  bannerEnabled = true,
  headlineOverride = '',
}: {
  state: TrialState;
  onStarted?: () => void;
  bannerEnabled?: boolean;
  headlineOverride?: string;
}) {
  const t = useTranslations('subscription.trial');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  // After a successful start we optimistically flip to the in-trial view using a
  // locally-computed end date, so the banner updates INSTANTLY even before the
  // parent refetch lands. This kills the stale "Start" button that caused a
  // confusing re-click -> "Trial already used" (the first click already started it).
  const [startedEndsAt, setStartedEndsAt] = useState<string | null>(null);
  const [msgApi, ctx] = message.useMessage();

  // Stable "now" captured once at mount — day-granularity surfaces don't need a
  // live clock, and a fixed value keeps render pure (react-hooks/purity).
  const [nowMs] = useState(() => Date.now());

  // Days left + readable end date for the in-trial view. Prefer the server's
  // trialEndsAt; fall back to the optimistic post-start date. daysLeft uses the
  // SHARED calendar-day helper (lib/trial) so this card and the global dashboard
  // TrialBanners always agree — and a 45-day trial reads "45", never "46".
  const effectiveEndsAt = state.trialEndsAt ?? startedEndsAt;
  const trialEndsAtMs = effectiveEndsAt ? new Date(effectiveEndsAt).getTime() : null;
  const daysLeft = useMemo(() => trialDaysLeft(effectiveEndsAt, nowMs), [effectiveEndsAt, nowMs]);
  const endDate = useMemo(
    () => (trialEndsAtMs == null ? '' : new Date(trialEndsAtMs).toLocaleDateString()),
    [trialEndsAtMs],
  );
  // Share of the trial still remaining, for the slim progress bar. Guarded
  // against a 0/missing duration so we never divide by zero.
  const pctLeft =
    state.trialDurationDays > 0
      ? Math.min(100, Math.max(0, Math.round((daysLeft / state.trialDurationDays) * 100)))
      : 0;

  const handleStart = async () => {
    setStarting(true);
    try {
      await startTrial();
      // Optimistic end date = now + the trial length; the parent refetch replaces
      // it with the server's exact trialEndsAt moments later.
      setStartedEndsAt(new Date(Date.now() + state.trialDurationDays * DAY_MS).toISOString());
      msgApi.success(t('startSuccess'));
      setConfirmOpen(false);
    } catch (e) {
      // BE may 400 with a human reason (already used / has a paid plan / none
      // available). parseApiError surfaces that message; falls back to t() copy.
      msgApi.error(parseApiError(e) || t('startError'));
    } finally {
      setStarting(false);
      // Reconcile to the true server state after EVERY attempt, not just on
      // success. If a stale "Start" banner was re-clicked and the trial already
      // exists (the first click won), this refetch flips it to the in-trial
      // countdown instead of leaving a stuck error + stale button.
      onStarted?.();
    }
  };

  // In-trial wins; also covers the just-started optimistic case (startedEndsAt set)
  // so the banner flips to the countdown immediately after a successful start,
  // leaving no stale "Start" button to re-click.
  if (state.isInTrial || startedEndsAt != null) {
    return (
      // Modern in-trial status card — matches the plan cards (rounded-2xl, brand
      // gold accent, icon chip, font-display hierarchy) instead of the muddy
      // green AntD success Alert. role="status" politely announces the
      // post-start flip; the gift icon + text carry meaning (never colour alone).
      <div
        role="status"
        className="mb-6 flex items-center gap-4 rounded-2xl border border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)] px-4 py-4 sm:px-5"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/70">
          <GiftOutlined aria-hidden className="text-xl" style={{ color: 'var(--cr-gold-700)' }} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className="m-0 text-[11px] font-semibold tracking-wide uppercase"
            style={{ color: 'var(--cr-gold-700)' }}
          >
            {t('activeTitle')}
          </p>
          <p className="m-0 mt-0.5 font-display text-[15px] font-bold text-heading sm:text-base">
            {t('activeDesc', { daysLeft, date: endDate })}
          </p>
          {pctLeft > 0 && (
            <div
              className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/70"
              aria-hidden
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pctLeft}%`, background: 'var(--cr-gold-500)' }}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Eligible promo: gated by the admin toggle (off => hide it). When shown, the
  // admin's custom headline wins if set; otherwise the localized default.
  if (bannerEnabled !== false && state.canStartTrial) {
    const customTitle = headlineOverride.trim();
    return (
      <>
        {ctx}
        <Alert
          type="success"
          showIcon
          icon={<GiftOutlined aria-hidden />}
          title={customTitle || t('eligibleTitle', { days: state.trialDurationDays })}
          description={t('eligibleDesc')}
          className="mb-6 border-[var(--cr-gold-400)] bg-[var(--cr-gold-100)]"
          role="note"
          action={
            <Button type="primary" className="cr-cta-gold" onClick={() => setConfirmOpen(true)}>
              {t('startButton')}
            </Button>
          }
        />
        <Modal
          open={confirmOpen}
          onCancel={() => setConfirmOpen(false)}
          onOk={handleStart}
          title={<span className="font-display font-bold">{t('confirmTitle')}</span>}
          okText={t('confirmOk')}
          cancelText={t('confirmCancel')}
          okButtonProps={{ loading: starting }}
          destroyOnHidden
          centered
          width={440}
        >
          <p className="m-0 text-sm text-muted">
            {t('confirmBody', { days: state.trialDurationDays })}
          </p>
        </Modal>
      </>
    );
  }

  // Trial used or no trial plan configured: nothing to offer (one-time trial).
  return null;
}

export default TrialStatusBanner;
