'use client';
// Finance polish (inventory): DsPageHeader title with status tag (titleAside). The voucher
// number stays dynamic; status uses .listCommon posted/draft labels are not used here as the
// tag mirrors the raw status. No data logic changed.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Spin, Tag } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { DsPageHeader } from '@/components/ui';
import { StockTransferEditor } from '@/components/finance/inventory/StockTransferEditor';
import { getStockTransfer } from '@/lib/actions/inventory.actions';
import type { StockTransfer } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function TransferDetailPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [transfer, setTransfer] = useState<StockTransfer | null>(null);

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    getStockTransfer(wsId, params.firmId, params.id).then(setTransfer);
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

  if (!transfer) return <Spin style={{ margin: 40 }} />;

  return (
    <div className="p-6">
      <DsPageHeader
        title={transfer.voucherNo}
        style={{ marginBottom: 16 }}
        titleAside={
          <Tag color={transfer.status === 'posted' ? 'green' : 'gold'}>
            {transfer.status.toUpperCase()}
          </Tag>
        }
      />
      <StockTransferEditor workspaceId={wsId} firmId={params.firmId} initial={transfer} />
    </div>
  );
}
