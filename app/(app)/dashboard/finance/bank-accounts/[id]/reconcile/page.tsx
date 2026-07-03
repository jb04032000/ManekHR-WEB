'use client';
// Bank reconciliation hub (Finance > Payments & Banking). Polish: i18n via
// finance.banking.reconcile + DsPageHeader. Lists ReconciliationSessions; links to reconcile/[sessionId].
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Statistic, Button, Empty, Spin, message, Typography } from 'antd';
import { PlusOutlined, BankOutlined } from '@ant-design/icons';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { financeBankReconciliationApi } from '@/lib/api/modules/finance-bank-reconciliation.api';
import { listFirms } from '@/lib/actions/finance.actions';
import { getBankAccount } from '@/lib/actions/finance-bank-accounts.actions';
import ReconcileSessionCard from '@/components/finance/bank/ReconcileSessionCard';
import DsCard from '@/components/ui/DsCard';
import type { ReconciliationSession, FinanceBankAccount, Firm } from '@/types';

export default function ReconcileHubPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('finance.banking');
  const bankAccountId = params.id as string;

  const { currentWorkspace, isHydrated } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [firms, setFirms] = useState<Firm[]>([]);
  const [sessions, setSessions] = useState<ReconciliationSession[]>([]);
  const [bankAccount, setBankAccount] = useState<FinanceBankAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const firmId = firms[0]?._id ?? '';

  // Load firms first, then load sessions + account in parallel
  useEffect(() => {
    if (!isHydrated || !wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch(() => {});
  }, [isHydrated, wsId]);

  useEffect(() => {
    if (!wsId || !firmId || !bankAccountId) return;
    let cancelled = false;
    startTransition(() => {
      setLoading(true);
    });
    Promise.all([
      financeBankReconciliationApi.listSessions(wsId, firmId, bankAccountId),
      getBankAccount(wsId, firmId, bankAccountId),
    ])
      .then(([sessionsList, account]) => {
        if (!cancelled) {
          setSessions(sessionsList);
          setBankAccount(account);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          const err = e as { response?: { data?: { message?: string } } };
          message.error(err?.response?.data?.message ?? t('reconcile.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, firmId, bankAccountId]);

  const handleNewReconciliation = () => {
    // Navigate to new-session route - the worksheet page (Plan 07) handles the upload wizard
    router.push(`/dashboard/finance/bank-accounts/${bankAccountId}/reconcile/new`);
  };

  const counts = {
    total: sessions.length,
    reconciled: sessions.filter((s) => s.status === 'completed' || s.status === 'locked').length,
    inProgress: sessions.filter((s) => s.status === 'in_progress').length,
    pending: sessions.filter((s) => s.status === 'draft').length,
  };

  // accountNumber from API is already masked (e.g. "XXXX1234") or the last 4 shown
  const accountNumberMasked = bankAccount?.accountNumber
    ? bankAccount.accountNumber.startsWith('X') || bankAccount.accountNumber.startsWith('•')
      ? bankAccount.accountNumber
      : '••••' + bankAccount.accountNumber.slice(-4)
    : '';

  if (!isHydrated || loading) {
    return (
      <div className="p-lg" style={{ display: 'flex', justifyContent: 'center', paddingTop: 64 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="p-lg">
      {/* Page header */}
      <DsPageHeader
        title={t('reconcile.title')}
        icon={<BankOutlined />}
        titleAside={<InfoTooltip text={t('reconcile.info')} />}
        style={{ marginBottom: 24 }}
        right={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleNewReconciliation}>
            {t('reconcile.new')}
          </Button>
        }
      />

      {/* Bank account context */}
      {bankAccount && (
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          <BankOutlined /> {bankAccount.name}
          {accountNumberMasked ? ` • ${accountNumberMasked}` : ''}
        </Typography.Text>
      )}

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
        className="lg:grid-cols-4"
      >
        <DsCard>
          <Statistic title={t('reconcile.kpi.totalStatements')} value={counts.total} />
        </DsCard>
        <DsCard>
          <Statistic
            title={t('reconcile.kpi.reconciled')}
            value={counts.reconciled}
            styles={{ content: { color: 'var(--cr-success)' } }}
          />
        </DsCard>
        <DsCard>
          <Statistic
            title={t('reconcile.kpi.inProgress')}
            value={counts.inProgress}
            styles={{ content: { color: 'var(--cr-warning)' } }}
          />
        </DsCard>
        <DsCard>
          <Statistic
            title={t('reconcile.kpi.pending')}
            value={counts.pending}
            styles={{ content: { color: 'var(--cr-text-3)' } }}
          />
        </DsCard>
      </div>

      {/* Sessions list */}
      {sessions.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Typography.Title level={2} style={{ marginBottom: 8, fontSize: 18 }}>
                {t('reconcile.emptyTitle')}
              </Typography.Title>
              <Typography.Paragraph type="secondary">
                {t('reconcile.emptyBody')}
              </Typography.Paragraph>
            </div>
          }
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={handleNewReconciliation}>
            {t('reconcile.upload')}
          </Button>
        </Empty>
      ) : (
        <div>
          {sessions.map((s) => (
            <ReconcileSessionCard
              key={s._id}
              session={s}
              bankAccountName={bankAccount?.name ?? ''}
              bankAccountNumberMasked={accountNumberMasked}
              wsId={wsId}
              firmId={firmId}
              bankAccountId={bankAccountId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
