'use client';

/**
 * HubWalletStrip - the compact wallet strip on the Boosts hub (`/connect/boosts`).
 *
 * Shows available balance + reserved inline so a routine top-up never needs a
 * trip to the full wallet page. "Add credits" opens a right-side slide-over
 * (AntD Drawer) hosting the SHARED <WalletTopUpForm> (same preset/custom + live
 * summary + checkout gate as the full page). A low-balance nudge appears when
 * the balance cannot cover the minimum boost budget.
 *
 * The standalone /connect/boost/wallet page still works; this is the in-context
 * shortcut, not a replacement.
 *
 * Cross-module: WalletTopUpForm -> wallet-topup-checkout; balance from getWallet;
 * thresholds from getConnectPricing (boostMinBudget / walletTopup min+presets).
 *
 * MONEY UNIT: whole RUPEES.
 */

import { useState } from 'react';
import { Drawer } from 'antd';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Info, Plus, Wallet } from 'lucide-react';
import { formatRupees } from '../marketplace/format';
import WalletTopUpForm from './WalletTopUpForm';
import { WALLET_TOPUP_ENABLED } from './checkout-gate';
import type { WalletView } from './ads.types';

interface HubWalletStripProps {
  /** Server-loaded wallet, or null when the read failed. */
  wallet: WalletView | null;
  /** Viewer display name for the checkout-sheet prefill. */
  viewerName: string;
  /** Top-up quick-pick amounts (admin-tunable); WalletTopUpForm falls back. */
  presets?: number[];
  /** Minimum top-up amount; WalletTopUpForm falls back to the boost floor. */
  minTopup?: number;
  /** Minimum budget to launch a boost - the low-balance threshold. */
  minBoostBudget?: number;
}

export default function HubWalletStrip({
  wallet,
  viewerName,
  presets,
  minTopup,
  minBoostBudget,
}: HubWalletStripProps) {
  const t = useTranslations('connect.boosts.wallet');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<WalletView | null>(wallet);

  // Low balance = the wallet cannot cover the cheapest boost. Only shown when we
  // actually know both the balance and the threshold (never on a failed read).
  const lowBalance =
    view !== null && typeof minBoostBudget === 'number' && view.balance < minBoostBudget;

  return (
    <section
      aria-label={t('aria')}
      className="mb-5 rounded-[var(--cr-radius-lg)] p-4"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <span
          aria-hidden
          className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--cr-radius-md)]"
          style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
        >
          <Wallet size={20} />
        </span>

        {view === null ? (
          <p role="status" className="m-0 text-[13px]" style={{ color: 'var(--cr-warning)' }}>
            {t('unavailable')}
          </p>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <div className="text-[11px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
                {t('balanceLabel')}
              </div>
              <div
                className="text-[20px] font-extrabold tabular-nums"
                style={{ color: 'var(--cr-text)' }}
              >
                {formatRupees(view.balance)}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold" style={{ color: 'var(--cr-text-4)' }}>
                {t('reservedLabel')}
              </div>
              <div
                className="text-[20px] font-extrabold tabular-nums"
                style={{ color: 'var(--cr-text-3)' }}
              >
                {formatRupees(view.reserved)}
              </div>
            </div>
          </div>
        )}

        {/* Self-serve top-up button only when the gateway is live; otherwise a
            quiet note - credits are added by the team/admin for now. */}
        {WALLET_TOPUP_ENABLED ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--cr-radius-full)] px-4 text-[13px] font-bold"
            style={{
              background: 'var(--cr-primary)',
              color: 'var(--cr-surface)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} aria-hidden /> {t('addCredits')}
          </button>
        ) : (
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium"
            style={{ color: 'var(--cr-text-4)' }}
          >
            <Info size={14} aria-hidden /> {t('addByTeam')}
          </span>
        )}
      </div>

      {lowBalance && (
        <p
          role="status"
          className="m-0 mt-3 flex items-start gap-1.5 rounded-[var(--cr-radius-md)] px-3 py-2 text-[12.5px] leading-relaxed"
          style={{
            background: 'var(--cr-warning-bg)',
            color: 'var(--cr-warning)',
            border: '1px solid var(--cr-warning-border,var(--cr-border))',
          }}
        >
          <AlertTriangle size={14} aria-hidden style={{ flex: 'none', marginTop: 1 }} />
          {t('lowBalance', { min: formatRupees(minBoostBudget ?? 0) })}
        </p>
      )}

      {/* Slide-over top-up (AntD v6: open + size, body unmounts on hide so the
          form opens clean every time). Only mounted when self-serve top-up is on;
          while off there is no trigger and credits come from the team/admin. */}
      {WALLET_TOPUP_ENABLED && (
        <Drawer
          title={t('drawerTitle')}
          open={open}
          onClose={() => setOpen(false)}
          size={380}
          destroyOnHidden
          rootClassName="cr-connect-drawer"
        >
          <p className="m-0 mb-4 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
            {t('drawerSubtitle')}
          </p>
          <WalletTopUpForm
            presets={presets}
            minAmount={minTopup}
            viewerName={viewerName}
            onSuccess={setView}
          />
        </Drawer>
      )}
    </section>
  );
}
