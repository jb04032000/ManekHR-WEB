'use client';
// Finance polish (inventory): i18n via finance.inventory.wastage; DsPageHeader title.
import { useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { WastageEntryEditor } from '@/components/finance/inventory/WastageEntryEditor';

export default function NewWastagePage() {
  const params = useParams<{ firmId: string }>();
  const search = useSearchParams();
  const t = useTranslations('finance.inventory');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  return (
    <div className="p-6">
      <DsPageHeader title={t('wastage.newTitle')} style={{ marginBottom: 16 }} />
      <WastageEntryEditor
        workspaceId={wsId}
        firmId={params.firmId}
        defaultItemId={search.get('itemId') ?? undefined}
      />
    </div>
  );
}
