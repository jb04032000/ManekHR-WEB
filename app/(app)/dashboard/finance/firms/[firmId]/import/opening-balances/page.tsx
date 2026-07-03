'use client';
// D19 opening-balances import. Hosts the upload -> map -> review -> commit wizard.
// Client + interactive (no server-side fetch on load), so no loading.tsx is required per the rule.
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { ImportOpeningBalancesWizard } from '@/components/finance/import/ImportOpeningBalancesWizard';

export default function ImportOpeningBalancesPage({
  params,
}: {
  params: Promise<{ firmId: string }>;
}) {
  const { firmId } = use(params);
  const t = useTranslations('finance.import');
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{t('obTitle')}</h1>
      <p style={{ color: 'var(--cr-text-3)', marginBottom: 24 }}>{t('obSubtitle')}</p>
      <ImportOpeningBalancesWizard firmId={firmId} />
    </div>
  );
}
