'use client';
// Purchases hub: KPI summary cards (payables, overdue, pending GRN, draft bills) with
// quick-create actions. Polish slot: i18n via finance.purchases.dashboard + DsPageHeader.
// Links to the purchase-orders / grn / purchase-bills / payment-out sub-modules.
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Row, Col, Skeleton, Space } from 'antd';
import {
  FileTextOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  FileDoneOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { getPayablesSummary } from '@/lib/actions/finance-purchases.actions';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

interface SummaryData {
  totalOutstandingPaise: number;
  counts: Record<string, number>;
}

export default function PurchasesDashboardPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.dashboard');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
    });
    getPayablesSummary(wsId, firmId)
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId]);

  if (!isHydrated) return <Skeleton active style={{ padding: 24 }} />;

  const base = `/dashboard/finance/firms/${firmId}/purchases`;

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('title')}
        icon={<ShoppingOutlined />}
        style={{ marginBottom: 24 }}
        right={
          <Space>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={() => router.push(`${base}/purchase-orders/new`)}
            >
              {t('newPo')}
            </DsButton>
            <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${base}/grn/new`)}>
              {t('newGrn')}
            </DsButton>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              onClick={() => router.push(`${base}/purchase-bills/new`)}
            >
              {t('newBill')}
            </DsButton>
            <DsButton
              dsVariant="primary"
              dsSize="sm"
              onClick={() => router.push(`${base}/payment-out/new`)}
            >
              {t('newPaymentOut')}
            </DsButton>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <DsCard loading={loading}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileTextOutlined style={{ fontSize: 28, color: 'var(--cr-primary)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--cr-text-3)' }}>
                  {t('totalPayables')}
                </h2>
                <div
                  style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text-1)' }}
                  aria-label={t('totalPayablesAria', {
                    value: summary ? formatPaise(summary.totalOutstandingPaise) : t('unavailable'),
                  })}
                >
                  {summary ? formatPaise(summary.totalOutstandingPaise) : '-'}
                </div>
              </div>
            </div>
          </DsCard>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <DsCard loading={loading}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <ExclamationCircleOutlined style={{ fontSize: 28, color: 'var(--cr-danger-500)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--cr-text-3)' }}>
                  {t('overdueBills')}
                </h2>
                <div
                  style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text-1)' }}
                  aria-label={t('overdueBillsAria', {
                    value: summary ? (summary.counts['overdue'] ?? 0) : t('unavailable'),
                  })}
                >
                  {summary ? (summary.counts['overdue'] ?? 0) : '-'}
                </div>
              </div>
            </div>
          </DsCard>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <DsCard loading={loading}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <InboxOutlined style={{ fontSize: 28, color: 'var(--cr-warning-500)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--cr-text-3)' }}>
                  {t('pendingGrn')}
                </h2>
                <div
                  style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text-1)' }}
                  aria-label={t('pendingGrnAria', {
                    value: summary ? (summary.counts['grn_draft'] ?? 0) : t('unavailable'),
                  })}
                >
                  {summary ? (summary.counts['grn_draft'] ?? 0) : '-'}
                </div>
              </div>
            </div>
          </DsCard>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <DsCard loading={loading}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <FileDoneOutlined style={{ fontSize: 28, color: 'var(--cr-success-500)' }} />
              <div>
                <h2 style={{ margin: 0, fontSize: 12, fontWeight: 400, color: 'var(--cr-text-3)' }}>
                  {t('draftPurchaseBills')}
                </h2>
                <div
                  style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text-1)' }}
                  aria-label={t('draftPurchaseBillsAria', {
                    value: summary ? (summary.counts['draft'] ?? 0) : t('unavailable'),
                  })}
                >
                  {summary ? (summary.counts['draft'] ?? 0) : '-'}
                </div>
              </div>
            </div>
          </DsCard>
        </Col>
      </Row>
    </div>
  );
}
