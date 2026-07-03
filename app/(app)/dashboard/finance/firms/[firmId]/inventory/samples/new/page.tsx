'use client';
// Finance polish (inventory): i18n via finance.inventory.samples; DsPageHeader title.
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { SampleVoucherEditor } from '@/components/finance/inventory/SampleVoucherEditor';

export default function NewSamplePage() {
  const params = useParams<{ firmId: string }>();
  const t = useTranslations('finance.inventory');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  return (
    <div className="p-6">
      <DsPageHeader title={t('samples.newTitle')} style={{ marginBottom: 16 }} />
      <SampleVoucherEditor workspaceId={wsId} firmId={params.firmId} />
    </div>
  );
}
