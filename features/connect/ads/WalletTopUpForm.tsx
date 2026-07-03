'use client';

/**
 * WalletTopUpForm - the shared "add credits" control: preset chips + custom
 * amount + a LIVE summary + the Add-credits button. Extracted so the standalone
 * wallet page (WalletPanel) and the Boosts-hub inline top-up drawer
 * (HubWalletStrip) render ONE implementation.
 *
 * Bug fix (2026-06-17): the amount the user picks is now always reflected. A
 * preset tap or a custom entry resolves to one `amount`, shown in a live
 * "You'll add Rs X to your wallet" summary above the button, so a chosen preset
 * never leaves the surface looking empty. Min-amount + custom-entry logic is
 * unchanged (parseBudgetInput owns the floor).
 *
 * Checkout gate: while WALLET_TOPUP_ENABLED is false (the online payment gateway
 * is not live; credits are added by the team/admin for now) the button surfaces
 * the gated notice and makes NO payment API call. The real Razorpay flow
 * (purchaseWalletTopup) is left fully intact behind the flag. Cross-module:
 * purchaseWalletTopup -> wallet-topup-checkout -> openCheckout + ads.actions;
 * gate from ./checkout-gate.
 *
 * MONEY UNIT: all amounts are whole RUPEES; the rupee -> paise conversion is
 * server-side at the Razorpay boundary only.
 */

import { useCallback, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App as AntApp } from 'antd';
import { useTranslations } from 'next-intl';
import { Info, Loader2 } from 'lucide-react';
import useAnnouncer from '@/components/connect/useAnnouncer';
import { formatRupees } from '../marketplace/format';
import { parseBudgetInput, BOOST_MIN_BUDGET } from './boost-composer-logic';
import { WALLET_TOPUP_ENABLED } from './checkout-gate';
import {
  purchaseWalletTopup,
  CheckoutDismissedError,
  CheckoutFailedError,
} from './wallet-topup-checkout';
import type { WalletView } from './ads.types';

/** Fallback quick-pick amounts when the live pricing config is unavailable. */
const TOPUP_PRESETS = [99, 299, 500, 1000] as const;
const DEFAULT_AMOUNT = 299;

interface WalletTopUpFormProps {
  /** Quick-pick amounts from the admin-tunable pricing config (deploy-free). */
  presets?: number[];
  /** Minimum top-up from the pricing config; falls back to BOOST_MIN_BUDGET. */
  minAmount?: number;
  /** Viewer display name, used to prefill the Razorpay checkout sheet. */
  viewerName: string;
  /** Called with the fresh wallet after a successful (live) top-up. */
  onSuccess?: (wallet: WalletView) => void;
}

export default function WalletTopUpForm({
  presets,
  minAmount,
  viewerName,
  onSuccess,
}: WalletTopUpFormProps) {
  const presetList = presets && presets.length > 0 ? presets : [...TOPUP_PRESETS];
  const minTopup = typeof minAmount === 'number' ? minAmount : BOOST_MIN_BUDGET;
  const t = useTranslations('connect.ads.wallet');
  const router = useRouter();
  const { message } = AntApp.useApp();
  const { announce, announcer } = useAnnouncer();

  // Default-select the first preset that meets the minimum so the form never
  // opens in an empty/ambiguous state (research: novices should be able to just
  // proceed). Falls back to the built-in default clamped to the min.
  const [amount, setAmount] = useState<number>(() => {
    const firstValid = presetList.find((p) => p >= minTopup);
    return firstValid ?? Math.max(DEFAULT_AMOUNT, minTopup);
  });
  const [customRaw, setCustomRaw] = useState('');
  const [pending, setPending] = useState(false);

  const errorId = useId();

  // A typed custom value takes precedence; an empty custom field falls back to
  // the selected preset. parseBudgetInput owns the hard floor (99).
  const customParsed = useMemo(
    () => (customRaw.trim() === '' ? null : parseBudgetInput(customRaw)),
    [customRaw],
  );

  // parseBudgetInput owns the hard floor; we additionally enforce the live admin
  // minimum so a raised min is respected without a deploy.
  const customErrorKey =
    customParsed && customParsed.error
      ? customParsed.error === 'below_min'
        ? 'errorBelowMin'
        : 'errorInvalid'
      : customParsed && customParsed.value !== null && customParsed.value < minTopup
        ? 'errorBelowMin'
        : null;

  const invalid = customRaw.trim() !== '' ? customErrorKey !== null : amount < minTopup;
  const disabled = pending || invalid;
  // The amount the user will actually add (preset or custom), or null while the
  // current entry is invalid - drives the live summary so the choice is visible.
  const resolvedAmount = invalid ? null : amount;

  const selectPreset = useCallback((preset: number) => {
    setAmount(preset);
    setCustomRaw('');
  }, []);

  const onCustomChange = useCallback((raw: string) => {
    setCustomRaw(raw);
    const parsed = parseBudgetInput(raw);
    if (parsed.value !== null && parsed.error === null) setAmount(parsed.value);
  }, []);

  const addCredits = useCallback(async () => {
    if (disabled) return;
    // Checkout gate: while self-serve top-up is off, surface the notice and make
    // no payment call (credits are added by the team/admin for now).
    if (!WALLET_TOPUP_ENABLED) {
      message.info(t('gatedNotice'));
      announce(t('gatedNotice'));
      return;
    }
    setPending(true);
    try {
      const updated = await purchaseWalletTopup({
        amountRupees: amount,
        prefill: { name: viewerName },
      });
      message.success(t('toastSuccess'));
      announce(t('toastSuccess'));
      onSuccess?.(updated);
      router.refresh();
    } catch (err) {
      if (err instanceof CheckoutDismissedError) {
        message.info(t('dismissed'));
        announce(t('dismissed'));
      } else if (err instanceof CheckoutFailedError) {
        message.error(t('errorFailed'));
        announce(t('errorFailed'), { assertive: true });
      } else {
        const msg = err instanceof Error && err.message ? err.message : t('errorGeneric');
        message.error(msg);
        announce(msg, { assertive: true });
      }
    } finally {
      setPending(false);
    }
  }, [disabled, amount, viewerName, message, t, router, announce, onSuccess]);

  return (
    <>
      {announcer}

      <div
        role="group"
        aria-label={t('amountLabel')}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}
      >
        {presetList.map((preset) => {
          const pressed = customRaw.trim() === '' && amount === preset;
          return (
            <button
              key={preset}
              type="button"
              className="cr-chip-toggle"
              aria-pressed={pressed}
              onClick={() => selectPreset(preset)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '6px 14px',
                borderRadius: 'var(--cr-radius-full)',
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                border: pressed ? '1.5px solid var(--cr-primary)' : '1.5px solid var(--cr-border)',
                background: pressed ? 'var(--cr-wash-indigo)' : 'var(--cr-surface)',
                color: pressed ? 'var(--cr-primary)' : 'var(--cr-text-3)',
                outline: 'none',
              }}
            >
              {formatRupees(preset)}
            </button>
          );
        })}
      </div>

      <label
        htmlFor="wallet-custom-amount"
        style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-3)' }}
      >
        {t('amountLabel')}
      </label>
      <input
        id="wallet-custom-amount"
        type="text"
        inputMode="numeric"
        value={customRaw}
        onChange={(e) => onCustomChange(e.target.value)}
        placeholder={t('customPlaceholder')}
        aria-invalid={customErrorKey !== null}
        aria-describedby={customErrorKey ? errorId : undefined}
        style={{
          marginTop: 6,
          width: '100%',
          maxWidth: 220,
          padding: '9px 12px',
          borderRadius: 'var(--cr-radius-md)',
          border: customErrorKey ? '1.5px solid var(--cr-error)' : '1.5px solid var(--cr-border)',
          background: 'var(--cr-surface)',
          color: 'var(--cr-text)',
          fontSize: 14,
        }}
      />
      {customErrorKey && (
        <p
          id={errorId}
          role="alert"
          style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--cr-error)' }}
        >
          {customErrorKey === 'errorBelowMin'
            ? t('errorBelowMin', { min: minTopup })
            : t('errorInvalid')}
        </p>
      )}

      {/* Live summary - the bug fix: always reflects the chosen amount (preset or
          custom) so a selected preset is never invisible. */}
      {resolvedAmount !== null && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr-surface-2)',
            border: '1px solid var(--cr-border)',
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-3)' }}>
            {t('summaryLabel')}
          </span>
          <strong style={{ fontSize: 18, fontWeight: 800, color: 'var(--cr-text)' }}>
            {formatRupees(resolvedAmount)}
          </strong>
        </div>
      )}

      {/* Gate notice (top-up off) OR the live tax note (top-up on). */}
      {!WALLET_TOPUP_ENABLED ? (
        <p
          role="status"
          style={{
            margin: '12px 0 0',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            fontSize: 12,
            lineHeight: 1.5,
            color: 'var(--cr-text-4)',
          }}
        >
          <Info size={13} aria-hidden style={{ flex: 'none', marginTop: 2 }} />
          {t('gatedNotice')}
        </p>
      ) : (
        <p style={{ margin: '12px 0 0', fontSize: 12, lineHeight: 1.5, color: 'var(--cr-text-4)' }}>
          {t('gstNote')}
        </p>
      )}

      <button
        type="button"
        onClick={() => void addCredits()}
        disabled={disabled}
        aria-busy={pending}
        style={{
          marginTop: 16,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          minHeight: 44,
          padding: '0 22px',
          borderRadius: 'var(--cr-radius-full)',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          // Muted while gated (no charge happens); primary when live.
          background: WALLET_TOPUP_ENABLED ? 'var(--cr-primary)' : 'var(--cr-border)',
          color: WALLET_TOPUP_ENABLED ? 'var(--cr-surface)' : 'var(--cr-text-4)',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        {pending && <Loader2 size={16} className="animate-spin" aria-hidden />}
        {pending ? t('adding') : t('addCredits')}
      </button>
    </>
  );
}
