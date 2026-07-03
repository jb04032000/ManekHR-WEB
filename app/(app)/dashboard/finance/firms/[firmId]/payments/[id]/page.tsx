'use client';
// Payment receipt detail (Finance > Payments & Banking). Polish: i18n via
// finance.banking.payments + DsPageHeader. Reads getPaymentReceipt; cancel via cancelPaymentReceipt.
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Typography, Descriptions, Space, message, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { getPaymentReceipt, cancelPaymentReceipt } from '@/lib/actions/finance.actions';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import type { PaymentReceipt, PaymentAllocation } from '@/types';

const STATE_COLORS: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PaymentReceiptDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.banking');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const PAYMENT_MODE_LABELS: Record<string, string> = {
    cash: t('payments.mode.cash'),
    bank: t('payments.mode.bank'),
    upi: t('payments.mode.upi'),
    cheque: t('payments.mode.cheque'),
    neft: t('payments.mode.neft'),
    rtgs: t('payments.mode.rtgs'),
    imps: t('payments.mode.imps'),
    razorpay: t('payments.mode.razorpay'),
    cashfree: t('payments.mode.cashfree'),
  };

  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
    });
    getPaymentReceipt(wsId, firmId, id)
      .then(setReceipt)
      .catch(() => message.error(t('payments.loadFailed')))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, id]);

  async function handleCancel() {
    if (!wsId || !receipt) return;
    setCancelling(true);
    try {
      await cancelPaymentReceipt(wsId, firmId, receipt._id);
      message.success(t('payments.cancelled'));
      setReceipt((prev) => (prev ? { ...prev, state: 'cancelled' } : null));
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('payments.cancelFailed'));
    } finally {
      setCancelling(false);
    }
  }

  const allocationColumns = [
    { title: t('payments.allocCol.invoiceNo'), dataIndex: 'invoiceNumber', key: 'invoiceNumber' },
    {
      title: t('payments.allocCol.invoiceDue'),
      dataIndex: 'invoiceDuePaise',
      key: 'invoiceDuePaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('payments.allocCol.allocated'),
      dataIndex: 'allocatedPaise',
      key: 'allocatedPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('payments.allocCol.remainingDue'),
      dataIndex: 'runningDuePaise',
      key: 'runningDuePaise',
      align: 'right' as const,
      render: (v: number) => (
        <Typography.Text type={v === 0 ? 'success' : undefined}>{formatPaise(v)}</Typography.Text>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Text type="danger">{t('payments.notFound')}</Typography.Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`/dashboard/finance/firms/${firmId}/payments`)}
        >
          {t('common.back')}
        </DsButton>
      </Space>

      <DsPageHeader
        title={receipt.voucherNumber ?? t('payments.detailFallbackTitle')}
        style={{ marginBottom: 16 }}
        right={
          <Space>
            <Tag
              color={STATE_COLORS[receipt.state] ?? 'default'}
              style={{ fontSize: 13, padding: '4px 10px' }}
            >
              {receipt.state.toUpperCase()}
            </Tag>
            {receipt.state === 'draft' && (
              <DsButton dsVariant="danger" dsSize="sm" loading={cancelling} onClick={handleCancel}>
                {t('payments.cancel')}
              </DsButton>
            )}
          </Space>
        }
      />

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('common.party')}>
          {receipt.partySnapshot?.name ?? receipt.partyId}
        </Descriptions.Item>
        <Descriptions.Item label={t('payments.field.receiptDate')}>
          {new Date(receipt.receiptDate).toLocaleDateString('en-IN')}
        </Descriptions.Item>
        <Descriptions.Item label={t('payments.field.paymentMode')}>
          {PAYMENT_MODE_LABELS[receipt.paymentMode] ?? receipt.paymentMode}
        </Descriptions.Item>
        <Descriptions.Item label={t('payments.field.referenceNo')}>
          {receipt.referenceNo ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('payments.field.totalAmount')}>
          {formatPaise(receipt.totalAmountPaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('payments.field.unapplied')}>
          {receipt.unappliedPaise > 0 ? (
            <Typography.Text type="warning">{formatPaise(receipt.unappliedPaise)}</Typography.Text>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        {receipt.postedAt && (
          <Descriptions.Item label={t('payments.field.postedAt')}>
            {new Date(receipt.postedAt).toLocaleString('en-IN')}
          </Descriptions.Item>
        )}
      </Descriptions>

      {receipt.allocations.length > 0 && (
        <>
          <Typography.Title level={2} style={{ marginBottom: 12, fontSize: 16 }}>
            {t('payments.allocations')}
          </Typography.Title>
          <DsTable
            dataSource={receipt.allocations}
            columns={allocationColumns}
            rowKey="invoiceId"
            pagination={false}
            size="small"
            scrollX={700}
          />
        </>
      )}
    </div>
  );
}
