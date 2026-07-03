'use client';
/**
 * Edit recurring template page.
 * Fetches the template client-side (wsId is in localStorage, not cookies - same pattern as
 * voucher editor pages per F-02-07b deviation note).
 * Gated by EntitlementGate(feature='sales_recurring') per D-08 + T-F02-08-04.
 */
import { startTransition, useEffect, useState, use } from 'react';
import { Spin } from 'antd';
import { EntitlementGate } from '@/components/finance/EntitlementGate';
import { RecurringTemplateEditor } from '@/components/finance/sales/RecurringTemplateEditor';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { RecurringInvoiceTemplate } from '@/types';
import { useTranslations } from 'next-intl';

export default function EditRecurringPage({
  params,
}: {
  params: Promise<{ firmId: string; id: string }>;
}) {
  const { firmId, id } = use(params);
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [template, setTemplate] = useState<RecurringInvoiceTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  useEffect(() => {
    if (!ws?._id) return;
    startTransition(() => {
      setLoading(true);
    });
    financeSalesApi.recurring
      .get(ws._id, firmId, id)
      .then((tpl) => setTemplate(tpl))
      .catch((e: any) =>
        setError(e?.response?.data?.message ?? e?.message ?? t('detail.loadFailed')),
      )
      .finally(() => setLoading(false));
  }, [ws?._id, firmId, id, t, reloadKey]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
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

  if (!template) return null;

  return (
    <EntitlementGate feature="sales_recurring" fallback="upsell-overlay">
      <RecurringTemplateEditor firmId={firmId} mode="edit" existingTemplate={template} />
    </EntitlementGate>
  );
}
