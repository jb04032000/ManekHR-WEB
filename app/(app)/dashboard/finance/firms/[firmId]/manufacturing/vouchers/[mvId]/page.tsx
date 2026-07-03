'use client';
// Finance polish (manufacturing): i18n via finance.manufacturing.vouchers; DsPageHeader title
// (voucher number or Draft). No data logic changed.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin } from 'antd';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { listItems, listAccounts } from '@/lib/actions/finance.actions';
import { listGodowns } from '@/lib/actions/inventory.actions';
import { getManufacturingVoucher, listBoms } from '@/lib/actions/finance/manufacturing.actions';
import ManufacturingVoucherForm from '@/components/finance/manufacturing/ManufacturingVoucherForm';
import type { FinanceItem, BomDefinition, Account, Godown, ManufacturingVoucher } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function ManufacturingVoucherDetailPage() {
  const params = useParams<{ firmId: string; mvId: string }>();
  const t = useTranslations('finance.manufacturing');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const manufacturingAccess = useFeatureAccess('manufacturing');
  const [mv, setMv] = useState<ManufacturingVoucher | null>(null);
  const [boms, setBoms] = useState<BomDefinition[]>([]);
  const [items, setItems] = useState<FinanceItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || manufacturingAccess.isLocked) return;
    Promise.all([
      getManufacturingVoucher(wsId, params.firmId, params.mvId),
      listBoms(wsId, params.firmId),
      listItems(wsId, params.firmId),
      listGodowns(wsId, params.firmId),
      listAccounts(wsId, params.firmId),
    ])
      .then(([mvData, bomsData, itemsData, godownsData, accountsData]) => {
        setMv(mvData);
        setBoms(bomsData);
        setItems(itemsData);
        setGodowns(godownsData);
        setAccounts(accountsData.filter((a) => a.type === 'expense'));
      })
      .finally(() => setLoading(false));
  }, [wsId, params.firmId, params.mvId, manufacturingAccess.isLocked]);

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
  if (!mv) return <div className="p-6">{t('vouchers.notFound')}</div>;

  return (
    <div className="p-6">
      <DsPageHeader
        title={
          mv.voucherNumber
            ? t('vouchers.detailTitleWithNumber', { number: mv.voucherNumber })
            : t('vouchers.detailTitleDraft')
        }
        style={{ marginBottom: 16 }}
      />
      <ManufacturingVoucherForm
        workspaceId={wsId}
        firmId={params.firmId}
        initial={mv}
        bomList={boms}
        itemList={items.map((i) => ({ _id: i._id, name: i.name, unit: i.unit }))}
        godownList={godowns.map((g) => ({ _id: g._id, name: g.name }))}
        expenseAccounts={accounts.map((a) => ({
          _id: a._id,
          code: a.code,
          name: a.name,
        }))}
        onSaved={setMv}
      />
    </div>
  );
}
