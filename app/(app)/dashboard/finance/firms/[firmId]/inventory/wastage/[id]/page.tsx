'use client';
// Finance polish (inventory): DsPageHeader title (voucher number) with status tag aside.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Spin, Tag } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { WastageEntryEditor } from '@/components/finance/inventory/WastageEntryEditor';
import { getWastageEntry } from '@/lib/actions/inventory.actions';
import type { WastageEntry } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function WastageDetailPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [entry, setEntry] = useState<WastageEntry | null>(null);

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    getWastageEntry(wsId, params.firmId, params.id).then(setEntry);
  }, [wsId, params.firmId, params.id, inventoryAccess.isLocked]);

  if (inventoryAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (inventoryAccess.isLocked) {
    return <ModuleLockedPage module="inventory" />;
  }

  if (!entry) return <Spin style={{ margin: 40 }} />;

  return (
    <div className="p-6">
      <DsPageHeader
        title={entry.voucherNo}
        style={{ marginBottom: 16 }}
        titleAside={
          <Tag color={entry.status === 'posted' ? 'green' : 'gold'}>
            {entry.status.toUpperCase()}
          </Tag>
        }
      />
      <WastageEntryEditor workspaceId={wsId} firmId={params.firmId} initial={entry} />
    </div>
  );
}
