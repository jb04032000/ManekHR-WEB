'use client';
/**
 * Edit/view Delivery Challan editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/delivery-challans/[id]
 */
import { use, useCallback, useEffect, useState } from 'react';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';
import ChallanEwaySection from '@/components/finance/sales/ChallanEwaySection';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { DeliveryChallan, SaleInvoice } from '@/types';
import { Spin } from 'antd';
import { useTranslations } from 'next-intl';

export default function EditDeliveryChallanPage({
  params,
}: {
  params: Promise<{ firmId: string; id: string }>;
}) {
  const { firmId, id } = use(params);
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [voucher, setVoucher] = useState<DeliveryChallan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // reload doubles as ChallanEwaySection onRefresh so a freshly generated e-Way bill shows.
  const reload = useCallback(() => {
    if (!ws?._id) return;
    financeSalesApi.deliveryChallans
      .get(ws._id, firmId, id)
      .then(setVoucher)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('detail.loadFailed')))
      .finally(() => setLoading(false));
    // deps use `ws` (not ws?._id) to match the React Compiler's inferred dependency.
  }, [ws, firmId, id, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    // Designed error state with a Retry that re-fetches, instead of a raw error line.
    return (
      <ListErrorState
        title={t('detail.loadFailed')}
        body={error}
        retryLabel={t('listCommon.retry')}
        onRetry={() => {
          setError(null);
          setLoading(true);
          reload();
        }}
      />
    );
  }

  return (
    <>
      <VoucherEditor
        voucherType="delivery_challan"
        firmId={firmId}
        mode="edit"
        existingDraft={voucher as unknown as SaleInvoice}
      />
      {voucher?.state === 'posted' && ws?._id && (
        <ChallanEwaySection
          workspaceId={ws._id}
          firmId={firmId}
          challan={voucher}
          onRefresh={reload}
        />
      )}
    </>
  );
}
