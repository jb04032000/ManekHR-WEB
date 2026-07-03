'use client';

/**
 * WalletPanel - the standalone ads wallet page (`/connect/boost/wallet`).
 *
 * Shows the advertiser's credit balance + reserved, and hosts the shared
 * <WalletTopUpForm> for adding credits. The top-up logic (preset/custom binding,
 * the live "You'll add Rs X" summary, the checkout gate, and the real Razorpay
 * flow) all live in WalletTopUpForm, which the Boosts-hub inline drawer also
 * uses - one implementation, no drift.
 *
 * Connect is PERSON-CENTRIC: the advertiser is the authenticated user, derived
 * from the JWT on the backend. No workspaceId is ever sent.
 *
 * MONEY UNIT: all amounts shown are whole RUPEES.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Wallet } from 'lucide-react';
import { formatRupees } from '../marketplace/format';
import WalletTopUpForm from './WalletTopUpForm';
import type { WalletView } from './ads.types';

interface WalletPanelProps {
  /** The server-loaded wallet, or null when the wallet read failed. */
  wallet: WalletView | null;
  /** Viewer display name, used to prefill the Razorpay checkout sheet. */
  viewerName: string;
  /**
   * Quick-pick amounts from the admin-tunable pricing config (deploy-free).
   * Undefined when the pricing read failed -> WalletTopUpForm falls back.
   */
  presets?: number[];
  /** Minimum top-up from the pricing config; falls back to BOOST_MIN_BUDGET. */
  minAmount?: number;
}

export default function WalletPanel({ wallet, viewerName, presets, minAmount }: WalletPanelProps) {
  // Balance is seeded from the server prop and updated locally after a
  // successful top-up (the form returns the fresh WalletView); a router.refresh()
  // inside the form then reconciles the rest of the page from the server.
  const [view, setView] = useState<WalletView | null>(wallet);
  const t = useTranslations('connect.ads.wallet');

  return (
    <main className="w-full" style={{ maxWidth: 560, margin: '0 auto' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 40,
            height: 40,
            borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr-primary-light)',
            color: 'var(--cr-primary)',
          }}
        >
          <Wallet size={20} />
        </span>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--cr-text)' }}>
            {t('heading')}
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--cr-text-4)' }}>
            {t('subtitle')}
          </p>
        </div>
      </header>

      {/* Balance card */}
      <section
        aria-label={t('heading')}
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          padding: 20,
          marginBottom: 16,
        }}
      >
        {view === null ? (
          <p role="status" style={{ margin: 0, fontSize: 13.5, color: 'var(--cr-warning)' }}>
            {t('unavailable')}
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-text-4)' }}>
                {t('balanceLabel')}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--cr-text)' }}>
                {formatRupees(view.balance)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cr-text-4)' }}>
                {t('reservedLabel')}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--cr-text-3)' }}>
                {formatRupees(view.reserved)}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Top-up card - shared form (preset/custom + live summary + gate). */}
      <section
        aria-label={t('topUpTitle')}
        style={{
          background: 'var(--cr-surface)',
          border: '1px solid var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          padding: 20,
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('topUpTitle')}
        </h2>
        <WalletTopUpForm
          presets={presets}
          minAmount={minAmount}
          viewerName={viewerName}
          onSuccess={setView}
        />
      </section>
    </main>
  );
}
