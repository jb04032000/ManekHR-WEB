'use client';
// Finance polish (inventory): i18n via finance.inventory.samples; DsPageHeader for the
// sample voucher detail header (title + Accept/Return actions, status tag aside).
// Pre-existing <InputNumber addonBefore> is left as-is (not introduced here). No data logic changed.
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin, Tag, Steps, Modal, InputNumber, message } from 'antd';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import {
  getSampleVoucher,
  acceptSampleVoucher,
  returnSampleVoucher,
} from '@/lib/actions/inventory.actions';
import type { SampleVoucher, SampleVoucherLine, SampleVoucherStatus } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLORS: Record<SampleVoucherStatus, string> = {
  draft: 'gold',
  sent: 'blue',
  partially_accepted: 'cyan',
  fully_accepted: 'green',
  rejected_returned: 'default',
  overdue: 'red',
};

function getStepIndex(status: SampleVoucherStatus): number {
  switch (status) {
    case 'draft':
      return 0;
    case 'sent':
    case 'overdue':
      return 1;
    case 'partially_accepted':
      return 2;
    case 'fully_accepted':
    case 'rejected_returned':
      return 3;
    default:
      return 0;
  }
}

interface LineWithIdx extends SampleVoucherLine {
  _lineIdx: number;
}

export default function SampleDetailPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const t = useTranslations('finance.inventory');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [voucher, setVoucher] = useState<SampleVoucher | null>(null);
  const [renderNow] = useState(() => Date.now());

  // Accept modal state
  const [acceptLine, setAcceptLine] = useState<LineWithIdx | null>(null);
  const [acceptQty, setAcceptQty] = useState<number>(0);
  const [accepting, setAccepting] = useState(false);

  // Return modal state
  const [returnLine, setReturnLine] = useState<LineWithIdx | null>(null);
  const [returnQty, setReturnQty] = useState<number>(0);
  const [returning, setReturning] = useState(false);

  const loadVoucher = () => {
    if (!wsId || inventoryAccess.isLocked) return;
    getSampleVoucher(wsId, params.firmId, params.id).then(setVoucher);
  };

  useEffect(() => {
    loadVoucher();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (!voucher) return <Spin style={{ margin: 40 }} />;

  const isTerminal = voucher.status === 'fully_accepted' || voucher.status === 'rejected_returned';

  const daysRemaining = Math.ceil(
    (new Date(voucher.expectedReturnDate).getTime() - renderNow) / (24 * 60 * 60 * 1000),
  );

  const handleAccept = async () => {
    if (!acceptLine) return;
    setAccepting(true);
    try {
      await acceptSampleVoucher(wsId, params.firmId, params.id, {
        lines: [{ lineIdx: acceptLine._lineIdx, acceptedQty: acceptQty }],
      });
      message.success(t('samples.linesAccepted'));
      setAcceptLine(null);
      loadVoucher();
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(e?.message ?? t('samples.acceptFailed'));
    } finally {
      setAccepting(false);
    }
  };

  const handleReturn = async () => {
    if (!returnLine) return;
    setReturning(true);
    try {
      await returnSampleVoucher(wsId, params.firmId, params.id, {
        lines: [{ lineIdx: returnLine._lineIdx, returnedQty: returnQty }],
      });
      message.success(t('samples.linesReturned'));
      setReturnLine(null);
      loadVoucher();
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(e?.message ?? t('samples.returnFailed'));
    } finally {
      setReturning(false);
    }
  };

  const linesWithIdx: LineWithIdx[] = voucher.lines.map((l, i) => ({
    ...l,
    _lineIdx: i,
  }));

  return (
    <div className="p-6">
      {/* Header */}
      <DsPageHeader
        title={voucher.voucherNo}
        style={{ marginBottom: 16 }}
        titleAside={
          <Tag color={STATUS_COLORS[voucher.status]}>
            {voucher.status.replace(/_/g, ' ').toUpperCase()}
          </Tag>
        }
        right={
          !isTerminal ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <DsButton
                dsVariant="primary"
                onClick={() => {
                  const first = linesWithIdx[0];
                  if (first) {
                    setAcceptQty(first.qty - first.acceptedQty - first.returnedQty);
                    setAcceptLine(first);
                  }
                }}
              >
                {t('samples.acceptLines')}
              </DsButton>
              <DsButton
                dsVariant="ghost"
                onClick={() => {
                  const first = linesWithIdx[0];
                  if (first) {
                    setReturnQty(first.qty - first.acceptedQty - first.returnedQty);
                    setReturnLine(first);
                  }
                }}
              >
                {t('samples.returnLines')}
              </DsButton>
            </div>
          ) : undefined
        }
      />

      {/* Info card */}
      <DsCard style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <div className="cr-label">{t('samples.fieldType')}</div>
            <Tag color={voucher.sampleType === 'consignment' ? 'purple' : 'blue'}>
              {voucher.sampleType === 'consignment'
                ? t('samples.typeConsignment')
                : t('samples.typeSample')}
            </Tag>
          </div>
          <div>
            <div className="cr-label">{t('samples.fieldParty')}</div>
            <span>{voucher.partyId}</span>
          </div>
          <div>
            <div className="cr-label">{t('samples.fieldDateSent')}</div>
            <span>{new Date(voucher.date).toLocaleDateString()}</span>
          </div>
          <div>
            <div className="cr-label">{t('samples.fieldExpectedReturn')}</div>
            <span>{new Date(voucher.expectedReturnDate).toLocaleDateString()}</span>
          </div>
          <div>
            <div className="cr-label">{t('samples.fieldAutoAlarm')}</div>
            <span>{t('samples.autoAlarmValue', { days: voucher.autoAlarmDays })}</span>
          </div>
          <div>
            <div className="cr-label">
              {daysRemaining >= 0 ? t('samples.daysRemaining') : t('samples.daysOverdue')}
            </div>
            <span
              style={{
                color:
                  daysRemaining < 0
                    ? 'var(--cr-error)'
                    : daysRemaining <= voucher.autoAlarmDays
                      ? 'var(--cr-warning)'
                      : 'var(--cr-success)',
                fontWeight: 600,
              }}
            >
              {Math.abs(daysRemaining)}d
            </span>
          </div>
        </div>
      </DsCard>

      {/* Timeline (Steps) */}
      <div style={{ marginBottom: 24 }}>
        <Steps
          current={getStepIndex(voucher.status)}
          items={[
            { title: t('samples.stepDraft') },
            { title: t('samples.stepSent') },
            { title: t('samples.stepPartiallyAccepted') },
            {
              title:
                voucher.status === 'rejected_returned'
                  ? t('samples.stepReturned')
                  : t('samples.stepFullyAccepted'),
            },
          ]}
        />
      </div>

      {/* Lines table */}
      <DsTable
        rowKey="_lineIdx"
        dataSource={linesWithIdx}
        pagination={false}
        columns={[
          { title: t('listCommon.item'), dataIndex: 'itemId' },
          { title: t('samples.colLot'), dataIndex: 'lotId', render: (v?: string) => v ?? '-' },
          { title: t('samples.colQtySent'), dataIndex: 'qty' },
          { title: t('samples.colQtyAccepted'), dataIndex: 'acceptedQty' },
          { title: t('samples.colQtyReturned'), dataIndex: 'returnedQty' },
          {
            title: t('listCommon.rate'),
            dataIndex: 'rate',
            render: (v?: number) =>
              v !== undefined
                ? (v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })
                : '-',
          },
          {
            title: t('listCommon.remarks'),
            dataIndex: 'remarks',
            render: (v?: string) => v ?? '-',
          },
          { title: t('listCommon.godown'), dataIndex: 'godownId' },
          {
            title: t('listCommon.actions'),
            key: 'actions',
            render: (_: unknown, r: LineWithIdx) => {
              const remaining = r.qty - r.acceptedQty - r.returnedQty;
              if (isTerminal || remaining <= 0) return null;
              return (
                <div style={{ display: 'flex', gap: 8 }}>
                  <DsButton
                    dsVariant="primary"
                    onClick={() => {
                      setAcceptQty(remaining);
                      setAcceptLine(r);
                    }}
                  >
                    {t('samples.accept')}
                  </DsButton>
                  <DsButton
                    dsVariant="ghost"
                    onClick={() => {
                      setReturnQty(remaining);
                      setReturnLine(r);
                    }}
                  >
                    {t('samples.return')}
                  </DsButton>
                </div>
              );
            },
          },
        ]}
      />

      {/* Accept Modal */}
      <Modal
        open={!!acceptLine}
        title={t('samples.acceptModalTitle')}
        onCancel={() => setAcceptLine(null)}
        onOk={handleAccept}
        okText={t('samples.accept')}
        confirmLoading={accepting}
      >
        {acceptLine && (
          <div>
            <p>
              {t('samples.modalItem')} <strong>{acceptLine.itemId}</strong>
            </p>
            <p>
              {t('samples.modalRemaining')}{' '}
              <strong>{acceptLine.qty - acceptLine.acceptedQty - acceptLine.returnedQty}</strong>
            </p>
            <InputNumber
              min={1}
              max={acceptLine.qty - acceptLine.acceptedQty - acceptLine.returnedQty}
              value={acceptQty}
              onChange={(v) => setAcceptQty(Number(v))}
              style={{ width: '100%', marginTop: 8 }}
              addonBefore={t('samples.qtyToAccept')}
            />
          </div>
        )}
      </Modal>

      {/* Return Modal */}
      <Modal
        open={!!returnLine}
        title={t('samples.returnModalTitle')}
        onCancel={() => setReturnLine(null)}
        onOk={handleReturn}
        okText={t('samples.return')}
        confirmLoading={returning}
      >
        {returnLine && (
          <div>
            <p>
              {t('samples.modalItem')} <strong>{returnLine.itemId}</strong>
            </p>
            <p>
              {t('samples.modalRemaining')}{' '}
              <strong>{returnLine.qty - returnLine.acceptedQty - returnLine.returnedQty}</strong>
            </p>
            <InputNumber
              min={1}
              max={returnLine.qty - returnLine.acceptedQty - returnLine.returnedQty}
              value={returnQty}
              onChange={(v) => setReturnQty(Number(v))}
              style={{ width: '100%', marginTop: 8 }}
              addonBefore={t('samples.qtyToReturn')}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
