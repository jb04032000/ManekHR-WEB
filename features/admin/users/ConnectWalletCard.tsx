'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Button, Input, InputNumber, Space, Spin, Statistic, Tag } from 'antd';
import { MinusOutlined, PlusOutlined, ReloadOutlined, WalletOutlined } from '@ant-design/icons';
import { getAdminWallet, adminAdjustWallet } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { AdminConnectWallet } from '@/types';

/**
 * Admin Connect ads-wallet (boost credits) card for one person. Shows the
 * spendable balance prominently with read-only grant/reserved figures, and lets
 * an admin add or deduct whole-rupee credits with an audit reason. "Deduct"
 * sends a NEGATIVE amount to the same adjust endpoint.
 *
 * Cross-module links: lib/actions/admin.actions.ts (getAdminWallet /
 * adminAdjustWallet) -> the admin connect ads-wallet endpoint. Embedded by
 * ManagePlansDrawer ("Boost credits" section).
 *
 * Watch: amounts are WHOLE RUPEES (no paise); the backend rejects a deduct that
 * would overdraw, so surface its error rather than guessing client-side.
 *
 * Admin is English-only + AntD (matches app/admin/*); no i18n here by design.
 */

export interface ConnectWalletCardProps {
  userId: string;
  /** Bubbled up after a successful adjust so the parent can refetch the user row. */
  onAdjusted?: () => void;
}

export function ConnectWalletCard({ userId, onAdjusted }: ConnectWalletCardProps) {
  const { message } = App.useApp();
  const [wallet, setWallet] = useState<AdminConnectWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const w = await getAdminWallet(userId);
      setWallet(w);
    } catch (e) {
      setLoadError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // sign: +1 = add credits, -1 = deduct (negative amount on the same endpoint).
  const adjust = async (sign: 1 | -1) => {
    if (!amount || amount <= 0) {
      message.error('Enter an amount greater than zero.');
      return;
    }
    if (!reason.trim()) {
      message.error('A reason is required for wallet adjustments.');
      return;
    }
    setAdjusting(true);
    try {
      const updated = await adminAdjustWallet(userId, {
        amount: sign * amount,
        reason: reason.trim(),
      });
      setWallet(updated);
      setAmount(null);
      setReason('');
      message.success(sign === 1 ? 'Credits added.' : 'Credits deducted.');
      onAdjusted?.();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setAdjusting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ fontSize: 13 }}>
        <span style={{ color: 'var(--cr-error, #cf1322)' }}>
          Could not load the boost wallet. {loadError}
        </span>
        <div style={{ marginTop: 10 }}>
          <Button size="small" icon={<ReloadOutlined />} onClick={load}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
        <Statistic
          title={
            <span>
              <WalletOutlined style={{ marginRight: 6 }} />
              Boost wallet balance
            </span>
          }
          value={wallet?.balance ?? 0}
          prefix="₹"
          // v6: `valueStyle` is deprecated -> style the value via styles.content.
          styles={{ content: { fontWeight: 700 } }}
        />
        <Space size={8} style={{ paddingBottom: 4 }}>
          <Tag>Granted ₹{wallet?.grantBalance ?? 0}</Tag>
          <Tag>Reserved ₹{wallet?.reserved ?? 0}</Tag>
        </Space>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <InputNumber
          value={amount}
          onChange={(v) => setAmount(v ?? null)}
          min={1}
          step={1}
          precision={0}
          prefix="₹"
          placeholder="Amount (whole rupees)"
          style={{ width: '100%' }}
          disabled={adjusting}
          aria-label="Adjustment amount"
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (required, e.g. goodwill credit, manual top-up)"
          disabled={adjusting}
          aria-label="Adjustment reason"
        />
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            loading={adjusting}
            onClick={() => adjust(1)}
          >
            Add credits
          </Button>
          <Button danger icon={<MinusOutlined />} loading={adjusting} onClick={() => adjust(-1)}>
            Deduct credits
          </Button>
        </Space>
      </div>
    </div>
  );
}
