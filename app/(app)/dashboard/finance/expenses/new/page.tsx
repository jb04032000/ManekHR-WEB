'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spin, Empty, Alert } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms, listAccounts, listParties } from '@/lib/actions/finance.actions';
import { ExpenseVoucherForm } from '@/components/finance/expenses/ExpenseVoucherForm';
import type { Account, Firm, Party } from '@/types';

export default function NewExpensePage() {
  const t = useTranslations('finance.purchases.expenses');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const [firms, setFirms] = useState<Firm[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch((e) => setError(e?.message ?? t('loadFirmsFailed')))
      .finally(() => setLoading(false));
  }, [wsId]);

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
  if (!firms[0]) return <Empty description={t('createFirmFirst')} style={{ marginTop: 64 }} />;

  return (
    <ExpenseVoucherForm
      mode="create"
      wsId={wsId}
      firmId={firmId}
      accounts={accounts}
      parties={parties}
    />
  );
}
