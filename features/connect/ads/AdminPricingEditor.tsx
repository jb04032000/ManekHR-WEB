'use client';

/**
 * AdminPricingEditor - the admin surface for the Connect pricing levers.
 *
 * Lets the owner re-price boosts and wallet top-ups WITHOUT a deploy: the boost
 * bid (cpm / cpc), the minimum boost budget, the allowed campaign durations, the
 * suggested boost budgets, and the wallet top-up minimum + suggested amounts.
 * Saves via updateConnectPricing -> PUT /admin/connect/ads/pricing, which
 * validates every field against hard guardrails on the backend and audits the
 * change. New values are live on the next boost / top-up (the backend config is
 * read fresh, cache busted on write).
 *
 * Cross-module link: mirrors the backend ConnectPricingView; read by the boost
 * composer (BoostComposer.tsx) + wallet panel (WalletPanel.tsx) via the public
 * GET /connect/ads/pricing. Internal admin tool: English-only + AntD, like the
 * rest of app/admin/*.
 */

import { useCallback, useState } from 'react';
import { App, Button, Card, InputNumber } from 'antd';
import { updateConnectPricing } from './ads-admin.actions';
import type { ConnectPricingView } from './ads.types';

/** Parse a comma / space separated list of positive integers (admin-friendly). */
function parseList(raw: string): number[] {
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => Math.trunc(n));
}

export default function AdminPricingEditor({ initial }: { initial: ConnectPricingView }) {
  const { message: msgApi } = App.useApp();
  const [saving, setSaving] = useState(false);

  // Numbers edit directly; the two list fields edit as text then parse on save.
  const [boostBidCpm, setBoostBidCpm] = useState(initial.boostBidCpm);
  const [boostBidCpc, setBoostBidCpc] = useState(initial.boostBidCpc);
  const [spotlightMultiplier, setSpotlightMultiplier] = useState(initial.spotlightMultiplier);
  // Review fee withheld from the refund when an admin takes a live boost down.
  const [moderationReviewFee, setModerationReviewFee] = useState(initial.moderationReviewFee);
  const [boostMinBudget, setBoostMinBudget] = useState(initial.boostMinBudget);
  const [walletTopupMinAmount, setWalletTopupMinAmount] = useState(initial.walletTopupMinAmount);
  const [durationsText, setDurationsText] = useState(initial.boostDurations.join(', '));
  const [boostPresetsText, setBoostPresetsText] = useState(initial.boostBudgetPresets.join(', '));
  const [topupPresetsText, setTopupPresetsText] = useState(initial.walletTopupPresets.join(', '));

  const onSave = useCallback(async () => {
    const body: ConnectPricingView = {
      boostBidCpm,
      boostBidCpc,
      spotlightMultiplier,
      moderationReviewFee,
      boostMinBudget,
      walletTopupMinAmount,
      boostDurations: parseList(durationsText),
      boostBudgetPresets: parseList(boostPresetsText),
      walletTopupPresets: parseList(topupPresetsText),
    };
    setSaving(true);
    const res = await updateConnectPricing(body);
    setSaving(false);
    if (res.ok) {
      msgApi.success('Pricing updated. Live on the next boost / top-up.');
      // Reflect the backend-normalised values (sorted + de-duplicated).
      setDurationsText(res.data.boostDurations.join(', '));
      setBoostPresetsText(res.data.boostBudgetPresets.join(', '));
      setTopupPresetsText(res.data.walletTopupPresets.join(', '));
    } else {
      msgApi.error(res.error);
    }
  }, [
    msgApi,
    boostBidCpm,
    boostBidCpc,
    spotlightMultiplier,
    moderationReviewFee,
    boostMinBudget,
    walletTopupMinAmount,
    durationsText,
    boostPresetsText,
    topupPresetsText,
  ]);

  const numField = (
    id: string,
    label: string,
    value: number,
    onChange: (n: number) => void,
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
        onChange={(v) => onChange(typeof v === 'number' ? v : 0)}
        style={{ width: 160 }}
      />
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </div>
  );

  const listField = (
    id: string,
    label: string,
    value: string,
    onChange: (s: string) => void,
    hint: string,
  ) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-default rounded-md border bg-surface px-2 py-1 text-sm text-heading"
        style={{ width: 220 }}
      />
      <span className="text-[11px] text-muted">{hint}</span>
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-lg font-semibold text-heading">Pricing</h3>
      <Card className="rounded-2xl">
        <p className="m-0 mb-3 text-xs text-muted">
          Tune boost and wallet pricing without a deploy. Changes are validated and take effect on
          the next boost or top-up. Existing campaigns keep the price they were created at.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          {numField(
            'boostBidCpm',
            'Boost bid - CPM (credits / 1000 views)',
            boostBidCpm,
            setBoostBidCpm,
          )}
          {numField(
            'boostBidCpc',
            'Boost bid - CPC (credits / click)',
            boostBidCpc,
            setBoostBidCpc,
          )}
          {numField(
            'spotlightMultiplier',
            'Spotlight multiplier (x bid)',
            spotlightMultiplier,
            setSpotlightMultiplier,
            'Premium rate for the Spotlight upgrade, e.g. 2 = double.',
          )}
          {numField(
            'moderationReviewFee',
            'Review fee withheld on take-down (credits)',
            moderationReviewFee,
            setModerationReviewFee,
            'Withheld from the refund when a live boost is taken down.',
          )}
          {numField(
            'boostMinBudget',
            'Minimum boost budget (Rs)',
            boostMinBudget,
            setBoostMinBudget,
          )}
          {numField(
            'walletTopupMinAmount',
            'Minimum wallet top-up (Rs)',
            walletTopupMinAmount,
            setWalletTopupMinAmount,
          )}
          {listField(
            'boostDurations',
            'Boost durations (days)',
            durationsText,
            setDurationsText,
            'Comma-separated, e.g. 3, 7, 14, 30',
          )}
          {listField(
            'boostBudgetPresets',
            'Boost budget presets (Rs)',
            boostPresetsText,
            setBoostPresetsText,
            'Comma-separated quick-pick amounts',
          )}
          {listField(
            'topupPresets',
            'Top-up presets (Rs)',
            topupPresetsText,
            setTopupPresetsText,
            'Comma-separated quick-pick amounts',
          )}
          <Button type="primary" loading={saving} onClick={() => void onSave()}>
            Save pricing
          </Button>
        </div>
      </Card>
    </section>
  );
}
