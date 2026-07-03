'use client';
// New contra voucher (Finance > Payments & Banking). Polish: i18n via finance.banking.contras.
// Loads firm + accounts then renders ContraVoucherForm (own-account cash<->bank transfer).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spin, Empty, Alert } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { listAccounts, listFirms } from '@/lib/actions/finance.actions';
import { ContraVoucherForm } from '@/components/finance/journal/ContraVoucherForm';
import type { Account, Firm } from '@/types';

export default function NewContraPage() {
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
      .catch((e) => setError(e?.message ?? t('contras.loadFirmsFailed')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is a stable next-intl formatter.
  }, [wsId]);

  const firmId = firms[0]?._id ?? '';

  useEffect(() => {
    if (!wsId || !firmId) return;
    listAccounts(wsId, firmId)
      .then((a) => setAccounts(a ?? []))
      .catch((e) => setError(e?.message ?? t('contras.loadAccountsFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is a stable next-intl formatter.
  }, [wsId, firmId]);

  if (error) return <Alert type="error" title={error} style={{ marginTop: 48 }} />;
  if (loading) return <Spin style={{ display: 'block', marginTop: 48 }} />;
  if (!firms[0]) return <Empty description={t('contras.noFirm')} style={{ marginTop: 64 }} />;

  return <ContraVoucherForm wsId={wsId} firmId={firmId} accounts={accounts} />;
}
