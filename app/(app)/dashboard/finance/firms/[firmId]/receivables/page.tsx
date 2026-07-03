'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin } from 'antd';
import { FieldTimeOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { getAgingBuckets, getReceivablesSummary } from '@/lib/actions/finance.actions';
import AgingBuckets from '@/components/finance/party-ledger/AgingBuckets';
import type { AgingPartyRow, ReceivablesSummary } from '@/types';

export default function ReceivablesPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.misc');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [agingRows, setAgingRows] = useState<AgingPartyRow[]>([]);
  const [summary, setSummary] = useState<ReceivablesSummary>({
    totalOutstanding: 0,
    totalOverdue: 0,
    collectedThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
    });
    Promise.all([getAgingBuckets(wsId, firmId), getReceivablesSummary(wsId, firmId)])
      .then(([aging, summ]) => {
        setAgingRows(aging);
        setSummary(summ);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId]);

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('receivables.title')}
        icon={<FieldTimeOutlined />}
        style={{ marginBottom: 24 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <AgingBuckets summary={summary} agingRows={agingRows} />
      )}
    </div>
  );
}
