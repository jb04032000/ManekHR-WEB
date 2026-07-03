'use client';
// Cheque register (Finance > Payments & Banking). Polish: i18n via finance.banking.cheques
// + DsPageHeader. Wraps PdcMaturityBanner + ChequeRegisterTabs (issued/received/PDC tabs).
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Spin } from 'antd';
import { BankOutlined } from '@ant-design/icons';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import type { Firm } from '@/types';
import PdcMaturityBanner from '@/components/finance/cheques/PdcMaturityBanner';
import ChequeRegisterTabs from '@/components/finance/cheques/ChequeRegisterTabs';

export default function ChequesPage() {
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

  return (
    <div className="space-y-4 p-6">
      <DsPageHeader
        title={t('cheques.title')}
        icon={<BankOutlined />}
        titleAside={<InfoTooltip text={t('cheques.info')} />}
      />

      {firmId && wsId && (
        <>
          <PdcMaturityBanner wsId={wsId} firmId={firmId} />
          <ChequeRegisterTabs wsId={wsId} firmId={firmId} />
        </>
      )}
    </div>
  );
}
