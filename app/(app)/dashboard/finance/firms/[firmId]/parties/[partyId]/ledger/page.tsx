'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin, Space } from 'antd';
import { ArrowLeftOutlined, ReadOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { getPartyLedger } from '@/lib/actions/finance.actions';
import PartyLedgerTable from '@/components/finance/party-ledger/PartyLedgerTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import type { PartyLedgerRow } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function PartyLedgerPage() {
  const { firmId, partyId } = useParams<{ firmId: string; partyId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.parties');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const [rows, setRows] = useState<PartyLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !isHydrated || financeAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    getPartyLedger(wsId, firmId, partyId)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, partyId, financeAccess.isLocked]);

  if (financeAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (financeAccess.isLocked) {
    return <ModuleLockedPage module="finance" />;
  }

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push(`/dashboard/finance/firms/${firmId}/parties`)}
        >
          {t('ledger.back')}
        </DsButton>
      </Space>

      <DsPageHeader
        title={t('ledger.title')}
        icon={<ReadOutlined />}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <PartyLedgerTable rows={rows} />
      )}
    </div>
  );
}
