'use client';
// Finance polish (job-work): i18n via finance.jobWork.outward; DsPageHeader title for the
// challan detail and the edit-mode header. Field labels use ICU placeholders. No data logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Tag, Table, Skeleton, Spin, Popconfirm, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import {
  getJwOutwardChallan,
  cancelJwOutwardChallan,
} from '@/lib/actions/finance/job-work.actions';
import JwOutwardChallanForm from '@/components/finance/job-work/JwOutwardChallanForm';
import { parseApiError } from '@/lib/utils';
import type { JobWorkOutwardChallan } from '@/types';
import dayjs from 'dayjs';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--cr-info-bg)', color: 'var(--cr-info)' },
  posted: { bg: 'var(--cr-success-bg)', color: 'var(--cr-success)' },
  cancelled: { bg: 'var(--cr-error-bg)', color: 'var(--cr-error)' },
};

export default function OutwardChallanDetailPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const firmId = params.firmId;
  const id = params.id;
  const router = useRouter();
  const t = useTranslations('finance.jobWork');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkAccess = useFeatureAccess('job_work');

  const [challan, setChallan] = useState<JobWorkOutwardChallan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!wsId || !firmId || !id || jobWorkAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    getJwOutwardChallan(wsId, firmId, id)
      .then(setChallan)
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

  if (loading)
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );

  if (!challan) {
    return (
      <div className="p-6">
        <p style={{ color: 'var(--cr-error)' }}>{t('outward.notFound')}</p>
        <Button
          onClick={() =>
            router.push(`/dashboard/finance/firms/${firmId}/job-work/outward-challans`)
          }
        >
          {t('outward.backToList')}
        </Button>
      </div>
    );
  }

  const statusC = STATUS_COLOR[challan.status] ?? {
    bg: 'var(--cr-surface-2)',
    color: 'var(--cr-text-3)',
  };
  const party = typeof challan.partyId === 'object' ? challan.partyId : null;

  if (editMode && challan.status === 'draft') {
    return (
      <div className="p-6">
        <DsPageHeader
          title={t('outward.editTitle', { voucher: challan.voucherNumber })}
          style={{ marginBottom: 24 }}
          titleAside={
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setEditMode(false)} />
          }
        />
        <JwOutwardChallanForm
          wsId={wsId}
          firmId={firmId}
          initial={challan}
          onSaved={(result) => {
            setChallan(result.jwo);
            setEditMode(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <DsPageHeader
        title={t('outward.challanTitle', { voucher: challan.voucherNumber })}
        style={{ marginBottom: 24 }}
        titleAside={
          <>
            <Link href={`/dashboard/finance/firms/${firmId}/job-work/outward-challans`}>
              <Button type="text" icon={<ArrowLeftOutlined />} />
            </Link>
            <Tag style={{ background: statusC.bg, color: statusC.color, border: 'none' }}>
              {challan.status?.toUpperCase()}
            </Tag>
            {challan.jwInvoiceId && (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  router.push(
                    `/dashboard/finance/firms/${firmId}/job-work/invoices/${challan.jwInvoiceId}`,
                  )
                }
              >
                {t('outward.invoiceLink', { id: challan.jwInvoiceId })}
              </Button>
            )}
          </>
        }
        right={
          challan.status === 'draft' ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => setEditMode(true)}>{t('outward.edit')}</Button>
              <Popconfirm
                title={t('outward.cancelConfirmTitle')}
                okText={t('outward.cancelOk')}
                cancelText={t('outward.keepDraft')}
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try {
                    const updated = await cancelJwOutwardChallan(wsId, firmId, challan._id);
                    setChallan(updated);
                    message.success(t('outward.cancelled'), 3);
                  } catch (err) {
                    message.error(parseApiError(err), 6);
                  }
                }}
              >
                <Button danger>{t('outward.cancel')}</Button>
              </Popconfirm>
            </div>
          ) : undefined
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 320px',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Party */}
          <div
            style={{
              background: 'var(--cr-surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--cr-border)',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {t('outward.principalParty')}
            </h3>
            {party ? (
              <>
                <div style={{ fontSize: 14 }}>{party.name}</div>
                {party.gstin && (
                  <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>{party.gstin}</div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
                {String(challan.partyId)}
              </div>
            )}
          </div>

          {/* Return lines */}
          <div
            style={{
              background: 'var(--cr-surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--cr-border)',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                marginBottom: 12,
              }}
            >
              {t('outward.returnLines')}
            </h3>
            <Table
              dataSource={challan.returnLines}
              rowKey="lineNo"
              size="small"
              pagination={false}
              columns={[
                { title: t('outward.colLotNo'), dataIndex: 'lotNo', width: 160 },
                { title: t('outward.colDescription'), dataIndex: 'itemDescription' },
                { title: t('outward.colQtyReturned'), dataIndex: 'qtyReturning', width: 110 },
                { title: t('outward.colUnit'), dataIndex: 'unit', width: 80 },
              ]}
            />
          </div>

          {/* Wastage lines */}
          {challan.wastageLines?.length > 0 && (
            <div
              style={{
                background: 'var(--cr-surface)',
                borderRadius: 8,
                padding: 16,
                border: '1px solid var(--cr-border)',
              }}
            >
              <h3
                style={{
                  fontSize: 16,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                {t('outward.wastageLines')}
              </h3>
              <Table
                dataSource={challan.wastageLines}
                rowKey="lineNo"
                size="small"
                pagination={false}
                columns={[
                  { title: t('outward.colDescription'), dataIndex: 'itemDescription' },
                  { title: t('outward.colQtyWasted'), dataIndex: 'qtyWasted', width: 110 },
                  { title: t('outward.colUnit'), dataIndex: 'unit', width: 80 },
                  { title: t('outward.colReason'), dataIndex: 'reasonCode', width: 130 },
                ]}
              />
            </div>
          )}

          {/* Karigar chips */}
          {challan.karigarIds?.length > 0 && (
            <div
              style={{
                background: 'var(--cr-surface)',
                borderRadius: 8,
                padding: 16,
                border: '1px solid var(--cr-border)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--cr-text-3)',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                {t('outward.workPerformedBy')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {challan.karigarIds.map((k) => (
                  <Tag key={String(k)} style={{ fontSize: 13 }}>
                    {String(k)}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              background: 'var(--cr-surface)',
              borderRadius: 8,
              padding: 16,
              border: '1px solid var(--cr-border)',
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {t('outward.details')}
            </h3>
            <div
              style={{
                fontSize: 13,
                color: 'var(--cr-text-3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div>
                {t('outward.fieldDate', { date: dayjs(challan.voucherDate).format('DD MMM YYYY') })}
              </div>
              {challan.vehicleNo && (
                <div>{t('outward.fieldVehicle', { value: challan.vehicleNo })}</div>
              )}
              {challan.transporterName && (
                <div>{t('outward.fieldTransporter', { value: challan.transporterName })}</div>
              )}
              {challan.lrNo && <div>{t('outward.fieldLrNo', { value: challan.lrNo })}</div>}
              {challan.narration && (
                <div>{t('outward.fieldNarration', { value: challan.narration })}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
