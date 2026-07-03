'use client';
// Finance polish (manufacturing): i18n via finance.manufacturing.bom; DsPageHeader title.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin } from 'antd';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { listItems } from '@/lib/actions/finance.actions';
import { getBom, listBoms } from '@/lib/actions/finance/manufacturing.actions';
import BomEditor from '@/components/finance/manufacturing/BomEditor';
import type { FinanceItem, BomDefinition } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function BomDetailPage() {
  const params = useParams<{ firmId: string; bomId: string }>();
  const t = useTranslations('finance.manufacturing');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const manufacturingAccess = useFeatureAccess('manufacturing');
  const [bom, setBom] = useState<BomDefinition | null>(null);
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [boms, setBoms] = useState<BomDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || manufacturingAccess.isLocked) return;
    Promise.all([
      getBom(wsId, params.firmId, params.bomId),
      listItems(wsId, params.firmId),
      listBoms(wsId, params.firmId),
    ])
      .then(([bomData, itemsData, bomsData]) => {
        setBom(bomData);
        setItems(itemsData);
        setBoms(bomsData);
      })
      .finally(() => setLoading(false));
  }, [wsId, params.firmId, params.bomId, manufacturingAccess.isLocked]);

  if (manufacturingAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (manufacturingAccess.isLocked) {
    return <ModuleLockedPage module="manufacturing" />;
  }

  if (loading) return <div className="p-6">{t('listCommon.loadingFallback')}</div>;
  if (!bom) return <div className="p-6">{t('bom.notFound')}</div>;

  return (
    <div className="p-6">
      <DsPageHeader title={t('bom.editTitle')} style={{ marginBottom: 16 }} />
      <BomEditor
        workspaceId={wsId}
        firmId={params.firmId}
        initial={bom}
        itemList={items.map((i) => ({
          _id: i._id,
          name: i.name,
          unit: i.unit,
        }))}
        bomList={boms.map((b) => ({
          _id: b._id,
          finishedItemId: b.finishedItemId,
          outputQty: b.outputQty,
          outputUnit: b.outputUnit,
        }))}
        onSaved={setBom}
      />
    </div>
  );
}
