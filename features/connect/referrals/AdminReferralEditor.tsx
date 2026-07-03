'use client';

/**
 * AdminReferralEditor - admin surface for the Connect referral program levers.
 *
 * What: lets the platform admin tune every referral lever (credits, holdback,
 *   caps, velocity, master on/off) without a deploy. Mirrors AdminPricingEditor
 *   in structure, form pattern, and save flow.
 *
 * Cross-module links:
 *   - updateReferralConfig -> PUT /admin/connect/referrals/config (referral-admin.controller.ts)
 *   - ReferralConfigView from features/connect/referrals/referrals.types
 *   - Rendered by app/admin/connect/referrals/page.tsx alongside ReferralLogTable
 *
 * Watch: plain English only (no i18n) -- this is an internal admin tool like the
 *   rest of app/admin. If backend field names change, update ReferralConfigView
 *   and this component in lockstep.
 */

import { useCallback, useState } from 'react';
import { App, Button, Card, InputNumber, Switch } from 'antd';
import { updateReferralConfig } from './referrals.actions';
import type { ReferralConfigView } from './referrals.types';

export default function AdminReferralEditor({ initial }: { initial: ReferralConfigView }) {
  const { message: msgApi } = App.useApp();
  const [saving, setSaving] = useState(false);

  const [enabled, setEnabled] = useState(initial.enabled);
  const [referrerCredits, setReferrerCredits] = useState(initial.referrerCredits);
  const [refereeCredits, setRefereeCredits] = useState(initial.refereeCredits);
  const [holdbackDays, setHoldbackDays] = useState(initial.holdbackDays);
  const [perReferrerCap, setPerReferrerCap] = useState(initial.perReferrerCap);
  const [monthlyPerReferrerCap, setMonthlyPerReferrerCap] = useState(initial.monthlyPerReferrerCap);
  const [annualCreditCeilingPerUser, setAnnualCreditCeilingPerUser] = useState(
    initial.annualCreditCeilingPerUser,
  );
  const [totalBudgetCap, setTotalBudgetCap] = useState(initial.totalBudgetCap);
  const [dailyVelocityPerReferrer, setDailyVelocityPerReferrer] = useState(
    initial.dailyVelocityPerReferrer,
  );

  const onSave = useCallback(async () => {
    const body: ReferralConfigView = {
      enabled,
      referrerCredits,
      refereeCredits,
      holdbackDays,
      perReferrerCap,
      monthlyPerReferrerCap,
      annualCreditCeilingPerUser,
      totalBudgetCap,
      dailyVelocityPerReferrer,
    };
    setSaving(true);
    const res = await updateReferralConfig(body);
    setSaving(false);
    if (res.ok) {
      msgApi.success('Saved. Live on the next referral.');
    } else {
      msgApi.error(res.error);
    }
  }, [
    msgApi,
    enabled,
    referrerCredits,
    refereeCredits,
    holdbackDays,
    perReferrerCap,
    monthlyPerReferrerCap,
    annualCreditCeilingPerUser,
    totalBudgetCap,
    dailyVelocityPerReferrer,
  ]);

  /** Render a numeric field with a label, unit suffix, and optional hint. */
  const numField = (
    id: string,
    label: string,
    value: number,
    onChange: (n: number) => void,
    suffix: string,
    hint?: string,
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <InputNumber
        id={id}
        min={0}
        value={value}
        suffix={suffix}
        onChange={(v) => onChange(typeof v === 'number' ? v : 0)}
        style={{ width: 200 }}
      />
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-semibold text-heading">Referral Program</h3>
      <Card className="rounded-2xl">
        <p className="m-0 mb-4 text-xs text-muted">
          Tune the referral program without a deploy. Changes are validated and take effect on the
          next referral. Credits already qualified keep the amounts that were snapshotted at qualify
          time.
        </p>

        {/* Master on/off toggle */}
        <div className="mb-5 flex items-center gap-3">
          <Switch
            id="referral-enabled"
            checked={enabled}
            onChange={setEnabled}
            checkedChildren="Program ON"
            unCheckedChildren="Program OFF"
          />
          <span className="text-sm text-body">
            {enabled
              ? 'Referral program is live. Users can share codes and earn credits.'
              : 'Referral program is disabled. Share links still work but no credits are awarded.'}
          </span>
        </div>

        {/* Credit amounts */}
        <div className="mb-4 flex flex-wrap items-end gap-4">
          {numField(
            'referrerCredits',
            'Referrer earns (per qualified referral)',
            referrerCredits,
            setReferrerCredits,
            'credits',
            "Credits added to the referrer's boost wallet when the holdback clears.",
          )}
          {numField(
            'refereeCredits',
            'New joiner earns (welcome credit)',
            refereeCredits,
            setRefereeCredits,
            'credits',
            "Credits added to the new user's wallet after holdback.",
          )}
          {numField(
            'holdbackDays',
            'Holdback period',
            holdbackDays,
            setHoldbackDays,
            'days',
            'Days a qualified referral is held before credits become spendable. 0 = instant release.',
          )}
        </div>

        {/* Per-referrer caps */}
        <div className="mb-4 flex flex-wrap items-end gap-4">
          {numField(
            'perReferrerCap',
            'Lifetime cap per referrer',
            perReferrerCap,
            setPerReferrerCap,
            'referrals',
            '0 = unlimited. Hard cap on how many times one user can earn referral credits total.',
          )}
          {numField(
            'monthlyPerReferrerCap',
            'Monthly cap per referrer',
            monthlyPerReferrerCap,
            setMonthlyPerReferrerCap,
            'referrals/month',
            '0 = unlimited. Resets on the 1st of each calendar month.',
          )}
          {numField(
            'dailyVelocityPerReferrer',
            'Daily velocity cap per referrer',
            dailyVelocityPerReferrer,
            setDailyVelocityPerReferrer,
            'referrals/day',
            '0 = unlimited. Throttles burst attribution within a 24-hour window.',
          )}
        </div>

        {/* Program-wide budget controls */}
        <div className="mb-5 flex flex-wrap items-end gap-4">
          {numField(
            'annualCreditCeilingPerUser',
            'Annual credit ceiling per user',
            annualCreditCeilingPerUser,
            setAnnualCreditCeilingPerUser,
            'credits/year',
            "0 = unlimited. Default ~19,000 keeps business referrers under India's Rs 20,000 gift tax threshold.",
          )}
          {numField(
            'totalBudgetCap',
            'Program-wide total budget cap',
            totalBudgetCap,
            setTotalBudgetCap,
            'credits',
            '0 = unlimited. Program auto-pauses when this ceiling is reached (credits stop being awarded).',
          )}
        </div>

        <Button type="primary" loading={saving} onClick={() => void onSave()}>
          Save config
        </Button>
      </Card>
    </section>
  );
}
