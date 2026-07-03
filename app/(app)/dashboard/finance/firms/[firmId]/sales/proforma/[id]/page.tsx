'use client';
/**
 * Edit/view Proforma Invoice editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/proforma/[id]
 */
import { use, useEffect, useState } from 'react';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { Proforma, SaleInvoice } from '@/types';
import { Spin } from 'antd';
import { useTranslations } from 'next-intl';

export default function EditProformaPage({
  params,
}: {
  params: Promise<{ firmId: string; id: string }>;
}) {
  const { firmId, id } = use(params);
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [voucher, setVoucher] = useState<Proforma | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  useEffect(() => {
    if (!ws?._id) return;
    financeSalesApi.proforma
      .get(ws._id, firmId, id)
      .then(setVoucher)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('detail.loadFailed')))
      .finally(() => setLoading(false));
  }, [ws?._id, firmId, id, reloadKey]);

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
          setReloadKey((k) => k + 1);
        }}
      />
    );
  }

  return (
    <VoucherEditor
      voucherType="proforma"
      firmId={firmId}
      mode="edit"
      existingDraft={voucher as unknown as SaleInvoice}
    />
  );
}
