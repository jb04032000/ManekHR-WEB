'use client';
// Finance polish (inventory): i18n via finance.inventory.transfers; DsPageHeader title.
import { useSearchParams, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { StockTransferEditor } from '@/components/finance/inventory/StockTransferEditor';

export default function NewTransferPage() {
  const params = useParams<{ firmId: string }>();
  const search = useSearchParams();
  const t = useTranslations('finance.inventory');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  return (
    <div className="p-6">
      <DsPageHeader title={t('transfers.newTitle')} style={{ marginBottom: 16 }} />
      <StockTransferEditor
        workspaceId={wsId}
        firmId={params.firmId}
        defaultFromGodownId={search.get('fromGodownId') ?? undefined}
      />
    </div>
  );
}
