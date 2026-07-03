'use client';
// Finance polish (job-work): i18n via finance.jobWork.invoices; DsPageHeader title (voucher
// number, status tag + back button as titleAside). No data logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Tag, Skeleton, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { getJwInvoice } from '@/lib/actions/finance/job-work.actions';
import JwInvoiceDetail from '@/components/finance/job-work/JwInvoiceDetail';
import type { JobWorkInvoice } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--cr-info-bg)', color: 'var(--cr-info)' },
  posted: { bg: 'var(--cr-success-bg)', color: 'var(--cr-success)' },
  cancelled: { bg: 'var(--cr-error-bg)', color: 'var(--cr-error)' },
};

export default function JwInvoiceDetailPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const firmId = params.firmId;
  const id = params.id;
  const router = useRouter();
  const t = useTranslations('finance.jobWork');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkAccess = useFeatureAccess('job_work');

  const [invoice, setInvoice] = useState<JobWorkInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || !firmId || !id || jobWorkAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    getJwInvoice(wsId, firmId, id)
      .then(setInvoice)
      .finally(() => setLoading(false));
  }, [wsId, firmId, id, jobWorkAccess.isLocked]);

  if (jobWorkAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (jobWorkAccess.isLocked) {
    return <ModuleLockedPage module="job_work" />;
  }

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <p style={{ color: 'var(--cr-error)' }}>{t('invoices.notFound')}</p>
        <Button onClick={() => router.push(`/dashboard/finance/firms/${firmId}/job-work/invoices`)}>
          {t('invoices.backToList')}
        </Button>
      </div>
    );
  }

  const statusC = STATUS_COLOR[invoice.status] ?? {
    bg: 'var(--cr-surface-2)',
    color: 'var(--cr-text-3)',
  };
  const pageTitle =
    invoice.status === 'draft'
      ? t('invoices.detailTitleDraft', { voucher: invoice.voucherNumber })
      : t('invoices.detailTitle', { voucher: invoice.voucherNumber });

  return (
    <div className="p-6">
      {/* Header */}
      <DsPageHeader
        title={pageTitle}
        style={{ marginBottom: 24 }}
        titleAside={
          <>
            <Link href={`/dashboard/finance/firms/${firmId}/job-work/invoices`}>
              <Button type="text" icon={<ArrowLeftOutlined />} />
            </Link>
            <Tag style={{ background: statusC.bg, color: statusC.color, border: 'none' }}>
              {invoice.status?.toUpperCase()}
            </Tag>
          </>
        }
      />

      {/* Invoice detail component */}
      <JwInvoiceDetail wsId={wsId} firmId={firmId} invoice={invoice} onUpdated={setInvoice} />
    </div>
  );
}
