'use client';
/**
 * Edit/view Tax Invoice editor page.
 * Route: /dashboard/finance/firms/[firmId]/sales/invoices/[id]
 * Uses client-side data fetching via financeSalesApi (client Axios) - consistent with
 * other sales pages in this codebase which are all 'use client' with useWorkspaceStore.
 */
import { startTransition, use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VoucherEditor } from '@/components/finance/sales/VoucherEditor';
import EDocumentsSection from '@/components/finance/sales/EDocumentsSection';
import InvoiceApprovalBar from '@/components/finance/sales/InvoiceApprovalBar';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { listCreditNotesByInvoice } from '@/lib/actions/finance-returns.actions';
import { useWorkspaceStore } from '@/lib/store';
import type { SaleInvoice, CreditNote } from '@/types';
import { Spin, Typography, Tag, Divider, message } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { Can } from '@/components/rbac/Can';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

function CreditNotesSection({
  workspaceId,
  firmId,
  invoiceId,
}: {
  workspaceId: string;
  firmId: string;
  invoiceId: string;
}) {
  const router = useRouter();
  const t = useTranslations('finance.sales');
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [loadingCNs, setLoadingCNs] = useState(true);

  useEffect(() => {
    if (!workspaceId || !firmId || !invoiceId) return;
    startTransition(() => {
      setLoadingCNs(true);
    });
    listCreditNotesByInvoice(workspaceId, firmId, invoiceId)
      .then(setCreditNotes)
      .catch(() => message.error(t('detail.loadCreditNotesFailed')))
      .finally(() => setLoadingCNs(false));
  }, [workspaceId, firmId, invoiceId, t]);

  if (loadingCNs) return <Spin size="small" />;

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <Divider />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Typography.Title level={2} style={{ margin: 0, fontSize: 16 }}>
          {t('detail.creditNotesTitle')}
        </Typography.Title>
        <Can path="finance.creditNote.create" scope="all">
          <DsButton
            dsVariant="secondary"
            onClick={() =>
              router.push(
                `/dashboard/finance/firms/${firmId}/returns/credit-notes/new?sourceInvoiceId=${invoiceId}`,
              )
            }
          >
            {t('detail.issueCreditNote')}
          </DsButton>
        </Can>
      </div>
      {creditNotes.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('detail.noCreditNotes')}
        </Typography.Text>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: 'var(--cr-neutral-100)' }}>
            <tr>
              {[
                t('detail.cnCol.voucherNo'),
                t('detail.cnCol.date'),
                t('detail.cnCol.type'),
                t('detail.cnCol.amount'),
                t('detail.cnCol.state'),
              ].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creditNotes.map((cn) => (
              <tr
                key={cn._id}
                style={{ borderTop: '1px solid var(--cr-border-light)', cursor: 'pointer' }}
                onClick={() =>
                  router.push(`/dashboard/finance/firms/${firmId}/returns/credit-notes/${cn._id}`)
                }
              >
                <td style={{ padding: '8px 10px' }}>{cn.voucherNumber ?? t('detail.draft')}</td>
                <td style={{ padding: '8px 10px' }}>
                  {dayjs(cn.voucherDate).format('DD MMM YYYY')}
                </td>
                <td style={{ padding: '8px 10px' }}>{cn.cnType ?? '-'}</td>
                <td style={{ padding: '8px 10px' }}>{formatPaise(cn.grandTotalPaise ?? 0)}</td>
                <td style={{ padding: '8px 10px' }}>
                  <Tag color={STATE_COLOR[cn.state] ?? 'default'}>{cn.state?.toUpperCase()}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function EditInvoicePage({
  params,
}: {
  params: Promise<{ firmId: string; id: string }>;
}) {
  const { firmId, id } = use(params);
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [invoice, setInvoice] = useState<SaleInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // reload doubles as the EDocumentsSection onRefresh so a freshly generated IRN / e-Way
  // bill is reflected in the invoice immediately.
  const reload = useCallback(() => {
    if (!ws?._id) return;
    financeSalesApi.invoices
      .get(ws._id, firmId, id)
      .then(setInvoice)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : t('detail.loadFailed')))
      .finally(() => setLoading(false));
    // Depend on `ws` (the reactive value the compiler infers) rather than the
    // narrowed `ws?._id`, so React Compiler can preserve this memoization.
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
      {invoice?.state === 'pending_approval' && ws?._id && (
        <InvoiceApprovalBar
          workspaceId={ws._id}
          firmId={firmId}
          invoice={invoice}
          onRefresh={reload}
        />
      )}
      <VoucherEditor
        voucherType="sale_invoice"
        firmId={firmId}
        mode="edit"
        existingDraft={invoice}
      />
      {invoice?.state === 'posted' && ws?._id && (
        <>
          <EDocumentsSection
            workspaceId={ws._id}
            firmId={firmId}
            invoice={invoice}
            onRefresh={reload}
          />
          <CreditNotesSection workspaceId={ws._id} firmId={firmId} invoiceId={invoice._id} />
        </>
      )}
    </>
  );
}
