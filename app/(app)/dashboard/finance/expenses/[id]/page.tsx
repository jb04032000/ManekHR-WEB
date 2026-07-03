'use client';

import { startTransition, use, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Spin,
  Empty,
  Alert,
  Card,
  Typography,
  Descriptions,
  Tag,
  Button,
  Modal,
  message,
} from 'antd';
import { StopOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { useSearchParams } from 'next/navigation';
import { listFirms, listAccounts, listParties } from '@/lib/actions/finance.actions';
import { getExpense, cancelExpense } from '@/lib/actions/finance-expenses.actions';
import { ExpenseVoucherForm } from '@/components/finance/expenses/ExpenseVoucherForm';
import type { Account, ExpenseVoucher, Firm, Party } from '@/types';

const { Title, Text } = Typography;

const STATE_COLORS: Record<string, string> = {
  draft: 'orange',
  posted: 'green',
  cancelled: 'red',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ExpenseDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations('finance.purchases.expenses');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const searchParams = useSearchParams();
  const isEdit = searchParams.get('edit') === '1';

  const [firms, setFirms] = useState<Firm[]>([]);
  const [voucher, setVoucher] = useState<ExpenseVoucher | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [cancelReason, setCancelReason] = useState('');

  // Single sequential effect: load firms first, then fetch the expense using the
  // real firmId. This avoids the stale-closure bug where firmId is '' on first
  // render (WR-02) and ensures loading is always terminated (CR-02).
  useEffect(() => {
    if (!wsId) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    listFirms(wsId)
      .then(async (f) => {
        setFirms(f ?? []);
        const fId = f?.[0]?._id;
        if (!fId) return;
        const v = await getExpense(wsId, fId, id).catch((e) => {
          if (e?.statusCode === 404 || e?.response?.status === 404) {
            setVoucher(null);
          } else {
            setError(e?.message ?? t('loadExpenseFailed'));
          }
          return null;
        });
        if (v !== null) setVoucher(v);
      })
      .catch((e) => setError(e?.message ?? t('loadFirmsFailed')))
      .finally(() => setLoading(false));
  }, [wsId, id]);

  const firmId = firms[0]?._id ?? '';

  useEffect(() => {
    if (!wsId || !firmId) return;
    listAccounts(wsId, firmId)
      .then((a) => setAccounts(a ?? []))
      .catch((e) => setError(e?.message ?? t('loadAccountsFailed')));
    listParties(wsId, firmId)
      .then((r) => setParties(r?.items ?? []))
      .catch((e) => setError(e?.message ?? t('loadPartiesFailed')));
  }, [wsId, firmId]);

  if (error) return <Alert type="error" title={error} style={{ marginTop: 48 }} />;
  if (loading) return <Spin style={{ display: 'block', marginTop: 48 }} />;
  if (!voucher) return <Empty description={t('notFound')} style={{ marginTop: 64 }} />;

  const mode = isEdit && voucher.state === 'draft' ? 'edit' : 'view';

  function handleCancel() {
    // Reset reason each time modal opens
    setCancelReason('');
    Modal.confirm({
      title: t('cancelModalTitle'),
      content: (
        <div>
          <p>{t('cancelModalLabel')}</p>
          <input
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            style={{
              width: '100%',
              padding: 4,
              border: '1px solid var(--cr-neutral-300)',
              borderRadius: 4,
            }}
            placeholder={t('cancelModalPlaceholder')}
          />
        </div>
      ),
      okText: t('cancelVoucher'),
      okButtonProps: { danger: true },
      onOk: async () => {
        if (!voucher) return;
        if (!cancelReason.trim()) {
          message.error(t('cancelReasonRequired'));
          return Promise.reject();
        }
        setCancelling(true);
        try {
          const updated = await cancelExpense(wsId, firmId, voucher._id, cancelReason);
          setVoucher(updated);
          message.success(t('cancelled'));
        } catch (e: any) {
          message.error(e?.message ?? t('cancelFailedShort'));
          throw e;
        } finally {
          setCancelling(false);
        }
      },
    });
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={1} style={{ margin: 0, fontSize: 22 }}>
            {t('voucherTitle', { number: voucher.voucherNumber ?? `(${t('draft')})` })}
          </Title>
          <Tag color={STATE_COLORS[voucher.state] ?? 'default'}>{voucher.state.toUpperCase()}</Tag>
        </div>
        {voucher.state === 'posted' && (
          <Button danger icon={<StopOutlined />} loading={cancelling} onClick={handleCancel}>
            {t('cancelVoucher')}
          </Button>
        )}
      </div>

      <ExpenseVoucherForm
        mode={mode}
        wsId={wsId}
        firmId={firmId}
        initialData={voucher}
        accounts={accounts}
        parties={parties}
      />

      {/* Ledger Journal Preview for posted vouchers */}
      {voucher.state === 'posted' && (
        <Card size="small" title={t('ledgerPreviewTitle')} style={{ marginTop: 24 }}>
          <Text type="secondary">{t('ledgerPreviewBody')}</Text>
          <Descriptions size="small" column={2} style={{ marginTop: 12 }}>
            <Descriptions.Item label={t('ledger.taxable')}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                (voucher.taxableValuePaise ?? 0) / 100,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('ledger.gst')}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                (voucher.totalGstPaise ?? 0) / 100,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('ledger.tdsDeducted')}>
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                (voucher.tdsApplied?.tdsPaise ?? 0) / 100,
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('ledger.netPayable')}>
              <Text strong>
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
                  (voucher.netPayablePaise ?? 0) / 100,
                )}
              </Text>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </div>
  );
}
