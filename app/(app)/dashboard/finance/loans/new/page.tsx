'use client';
// New loan account (Finance > Payments & Banking). Polish: i18n via finance.banking.loans
// + DsPageHeader. Loads the firm then renders LoanForm.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spin, Empty } from 'antd';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import type { Firm } from '@/types';
import LoanForm from '@/components/finance/loans/LoanForm';

export default function NewLoanPage() {
  const t = useTranslations('finance.banking');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [wsId]);

  const firmId = firms[0]?._id ?? '';

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!firmId) {
    return (
      <div className="p-6">
        <Empty description={t('loans.noFirm')} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <DsPageHeader title={t('loans.newTitle')} />
      <LoanForm wsId={wsId} firmId={firmId} />
    </div>
  );
}
