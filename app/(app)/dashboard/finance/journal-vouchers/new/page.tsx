'use client';
// New journal voucher (Finance > Payments & Banking). Polish: i18n via finance.banking.journalVouchers.
// Loads firm + accounts then renders JournalVoucherForm (direct balanced ledger entry).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spin, Empty, Alert } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { listAccounts, listFirms } from '@/lib/actions/finance.actions';
import { JournalVoucherForm } from '@/components/finance/journal/JournalVoucherForm';
import type { Account, Firm } from '@/types';

export default function NewJournalVoucherPage() {
  const t = useTranslations('finance.banking');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const [firms, setFirms] = useState<Firm[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch((e) => setError(e?.message ?? t('journalVouchers.loadFirmsFailed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is a stable next-intl formatter.
  }, [wsId]);

  const firmId = firms[0]?._id ?? '';

  useEffect(() => {
    if (!wsId || !firmId) return;
    listAccounts(wsId, firmId)
      .then((a) => setAccounts(a ?? []))
      .catch((e) => setError(e?.message ?? t('journalVouchers.loadAccountsFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is a stable next-intl formatter.
  }, [wsId, firmId]);

  if (error) return <Alert type="error" title={error} style={{ marginTop: 48 }} />;
  if (loading) return <Spin style={{ display: 'block', marginTop: 48 }} />;
  if (!firms[0])
    return <Empty description={t('journalVouchers.noFirm')} style={{ marginTop: 64 }} />;

  return <JournalVoucherForm wsId={wsId} firmId={firmId} accounts={accounts} mode="create" />;
}
