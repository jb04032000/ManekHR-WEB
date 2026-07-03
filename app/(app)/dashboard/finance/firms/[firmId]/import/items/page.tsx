'use client';
// D19 item-masters import. Hosts the upload -> map -> review -> commit wizard.
// Client + interactive (no server-side fetch on load), so no loading.tsx is required per the rule.
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { ImportItemsWizard } from '@/components/finance/import/ImportItemsWizard';

export default function ImportItemsPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.import');
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{t('itemsTitle')}</h1>
      <p style={{ color: 'var(--cr-text-3)', marginBottom: 24 }}>{t('itemsSubtitle')}</p>
      <ImportItemsWizard firmId={firmId} />
    </div>
  );
}
