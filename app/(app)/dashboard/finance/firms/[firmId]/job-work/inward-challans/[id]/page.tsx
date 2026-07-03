'use client';
// Finance polish (job-work): i18n via finance.jobWork.inward; DsPageHeader title for the
// challan detail and the edit-mode header. Field labels use ICU placeholders. No data logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, Tag, Table, Skeleton, Spin, Popconfirm, message } from 'antd';
import { ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { getJwInwardChallan, cancelJwInwardChallan } from '@/lib/actions/finance/job-work.actions';
import JwInwardChallanForm from '@/components/finance/job-work/JwInwardChallanForm';
import { parseApiError } from '@/lib/utils';
import type { JobWorkInwardChallan } from '@/types';
import dayjs from 'dayjs';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--cr-info-bg)', color: 'var(--cr-info)' },
  posted: { bg: 'var(--cr-success-bg)', color: 'var(--cr-success)' },
  closed: { bg: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' },
};

export default function InwardChallanDetailPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const firmId = params.firmId;
  const id = params.id;
  const router = useRouter();
  const t = useTranslations('finance.jobWork');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkAccess = useFeatureAccess('job_work');

  const [challan, setChallan] = useState<JobWorkInwardChallan | null>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!wsId || !firmId || !id || jobWorkAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    getJwInwardChallan(wsId, firmId, id)
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

  if (loading) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!challan) {
    return (
      <div className="p-6">
        <p style={{ color: 'var(--cr-error)' }}>{t('inward.notFound')}</p>
        <Button
          onClick={() => router.push(`/dashboard/finance/firms/${firmId}/job-work/inward-challans`)}
        >
          {t('inward.backToList')}
        </Button>
      </div>
    );
  }

  const statusC = STATUS_COLOR[challan.status] ?? {
    bg: 'var(--cr-surface-2)',
    color: 'var(--cr-text-3)',
  };
  const party = typeof challan.partyId === 'object' ? challan.partyId : null;

  // Edit mode: render form
  if (editMode && challan.status === 'draft') {
    return (
      <div className="p-6">
        <DsPageHeader
          title={t('inward.editTitle', { voucher: challan.voucherNumber })}
          style={{ marginBottom: 24 }}
          titleAside={
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => setEditMode(false)} />
          }
        />
        <JwInwardChallanForm
          wsId={wsId}
          firmId={firmId}
          initial={challan}
          onSaved={(updated) => {
            setChallan(updated);
            setEditMode(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <DsPageHeader
        title={t('inward.challanTitle', { voucher: challan.voucherNumber })}
        style={{ marginBottom: 24 }}
        titleAside={
          <>
            <Link href={`/dashboard/finance/firms/${firmId}/job-work/inward-challans`}>
              <Button type="text" icon={<ArrowLeftOutlined />} />
            </Link>
            <Tag style={{ background: statusC.bg, color: statusC.color, border: 'none' }}>
              {challan.status?.toUpperCase()}
            </Tag>
          </>
        }
        right={
          <div style={{ display: 'flex', gap: 8 }}>
            {challan.status === 'draft' && (
              <>
                <Button onClick={() => setEditMode(true)}>{t('inward.edit')}</Button>
                <Popconfirm
                  title={t('inward.cancelConfirmTitle')}
                  description={t('inward.cancelConfirmDesc')}
                  okText={t('inward.cancelOk')}
                  cancelText={t('inward.keepDraft')}
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    try {
                      const updated = await cancelJwInwardChallan(wsId, firmId, challan._id);
                      setChallan(updated);
                      message.success(t('inward.cancelled'), 3);
                    } catch (err) {
                      message.error(parseApiError(err), 6);
                    }
                  }}
                >
                  <Button danger>{t('inward.cancel')}</Button>
                </Popconfirm>
              </>
            )}
            {challan.status === 'posted' && (
              <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                {t('inward.print')}
              </Button>
            )}
          </div>
        }
      />

      {/* Two-column layout */}
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
          {/* Party info */}
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
              {t('inward.principalParty')}
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

          {/* Line items */}
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
              {t('inward.lineItems')}
            </h3>
            <Table
              dataSource={challan.lines}
              rowKey="lineNo"
              size="small"
              pagination={false}
              columns={[
                { title: '#', dataIndex: 'lineNo', width: 40 },
                { title: t('inward.colDescription'), dataIndex: 'itemDescription' },
                { title: t('inward.colHsn'), dataIndex: 'hsnCode', width: 90 },
                { title: t('inward.colQty'), dataIndex: 'qty', width: 80 },
                { title: t('inward.colUnit'), dataIndex: 'unit', width: 80 },
              ]}
            />
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Dates & transport */}
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
              {t('inward.details')}
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
                {t('inward.fieldDate', { date: dayjs(challan.voucherDate).format('DD MMM YYYY') })}
              </div>
              {challan.vehicleNo && (
                <div>{t('inward.fieldVehicle', { value: challan.vehicleNo })}</div>
              )}
              {challan.transporterName && (
                <div>{t('inward.fieldTransporter', { value: challan.transporterName })}</div>
              )}
              {challan.lrNo && <div>{t('inward.fieldLrNo', { value: challan.lrNo })}</div>}
              {challan.narration && (
                <div>{t('inward.fieldNarration', { value: challan.narration })}</div>
              )}
            </div>
          </div>

          {/* Lots summary */}
          {challan.status !== 'draft' && (
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
                {t('inward.generatedLots')}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
                {t('inward.lotsCreated', { count: challan.lines?.length ?? 0 })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
