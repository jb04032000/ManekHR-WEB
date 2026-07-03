'use client';

import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Descriptions, Skeleton, Space, Typography, Alert, message, Modal, Input } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import {
  getGrnReturn,
  dispatchGrnReturn,
  confirmGrnReturn,
  cancelGrnReturn,
} from '@/lib/actions/finance-returns.actions';
import DsButton from '@/components/ui/DsButton';
import type { GrnReturn } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  dispatched: 'processing',
  confirmed: 'success',
  cancelled: 'error',
};

export default function GrnReturnDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.returns.grDetail');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [gr, setGr] = useState<GrnReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId || !id) return;
    startTransition(() => {
      setLoading(true);
    });
    getGrnReturn(workspaceId, firmId, id)
      .then(setGr)
      .catch(() => setGr(null))
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, id]);

  const handleDispatch = async () => {
    if (!workspaceId || !gr) return;
    setDispatching(true);
    try {
      const updated = await dispatchGrnReturn(workspaceId, firmId, gr._id);
      setGr(updated);
      message.success(t('dispatched'));
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('dispatchFailed'));
    } finally {
      setDispatching(false);
    }
  };

  const handleConfirm = async () => {
    if (!workspaceId || !gr) return;
    setConfirming(true);
    try {
      const result = await confirmGrnReturn(workspaceId, firmId, gr._id);
      setGr(result.grnReturn);
      if (result.promptCreateDebitNote) {
        message.success(t('confirmedWithDn'));
      } else {
        message.success(t('confirmed'));
      }
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('confirmFailed'));
    } finally {
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!workspaceId || !gr || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const updated = await cancelGrnReturn(workspaceId, firmId, gr._id, cancelReason);
      setGr(updated);
      message.success(t('cancelled'));
      setCancelModalOpen(false);
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('cancelFailed'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Skeleton active style={{ padding: 24 }} />;
  if (!gr) return <div style={{ padding: 24 }}>{t('notFound')}</div>;

  const stockReducedStates: Array<GrnReturn['state']> = ['dispatched', 'confirmed'];
  const wasStockReduced = stockReducedStates.includes(gr.state);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={1} style={{ margin: 0, fontSize: 22 }}>
            {t('title', { number: gr.voucherNumber ?? t('draft') })}
          </Title>
          <Space style={{ marginTop: 4 }}>
            <Tag color={STATE_COLOR[gr.state] ?? 'default'}>{gr.state.toUpperCase()}</Tag>
          </Space>
        </div>

        {/* State-aware action buttons */}
        <Space>
          {gr.state === 'draft' && (
            <DsButton dsVariant="primary" loading={dispatching} onClick={handleDispatch}>
              {t('dispatch')}
            </DsButton>
          )}
          {gr.state === 'dispatched' && (
            <DsButton dsVariant="primary" loading={confirming} onClick={handleConfirm}>
              {t('confirm')}
            </DsButton>
          )}
          {gr.state === 'confirmed' && !gr.linkedDebitNoteId && (
            <DsButton
              dsVariant="secondary"
              onClick={() => {
                const params = new URLSearchParams();
                params.set('sourceGrnReturnId', String(gr._id));
                if (gr.sourceBillId) params.set('sourceBillId', String(gr.sourceBillId));
                router.push(
                  `/dashboard/finance/firms/${firmId}/returns/debit-notes/new?${params.toString()}`,
                );
              }}
            >
              {t('createDebitNote')}
            </DsButton>
          )}
          {gr.state !== 'cancelled' && (
            <DsButton dsVariant="danger" onClick={() => setCancelModalOpen(true)}>
              {t('cancel')}
            </DsButton>
          )}
        </Space>
      </div>

      {/* Linked Debit Note */}
      {gr.linkedDebitNoteId && (
        <Alert
          type="success"
          style={{ marginBottom: 16 }}
          title={
            <span>
              {t('linkedDebitNote')}
              <a
                onClick={() =>
                  router.push(
                    `/dashboard/finance/firms/${firmId}/returns/debit-notes/${String(gr.linkedDebitNoteId)}`,
                  )
                }
                style={{ cursor: 'pointer' }}
              >
                {gr.linkedDebitNoteNumber ?? String(gr.linkedDebitNoteId)}
              </a>
            </span>
          }
        />
      )}

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('field.returnDate')}>
          {dayjs(gr.voucherDate).format('DD MMM YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendor')}>
          {(gr.partySnapshot as Record<string, string> | undefined)?.name ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.sourceGrn')}>
          {gr.sourceGrnNumber ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.sourceBill')}>
          {gr.sourceBillNumber ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendorRma')}>
          {gr.vendorRmaNumber ?? '-'}
        </Descriptions.Item>
        {gr.transport && (
          <>
            <Descriptions.Item label={t('field.carrier')}>
              {gr.transport.carrier ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('field.lrNumber')}>
              {gr.transport.lrNumber ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('field.dispatchDate')}>
              {gr.transport.dispatchDate
                ? dayjs(gr.transport.dispatchDate).format('DD MMM YYYY')
                : '-'}
            </Descriptions.Item>
          </>
        )}
        {gr.dispatchedAt && (
          <Descriptions.Item label={t('field.dispatchedAt')}>
            {dayjs(gr.dispatchedAt).format('DD MMM YYYY HH:mm')}
          </Descriptions.Item>
        )}
        {gr.confirmedAt && (
          <Descriptions.Item label={t('field.confirmedAt')}>
            {dayjs(gr.confirmedAt).format('DD MMM YYYY HH:mm')}
          </Descriptions.Item>
        )}
        {gr.cancellationReason && (
          <Descriptions.Item label={t('field.cancellationReason')}>
            {gr.cancellationReason}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Line Items */}
      <Title level={2} style={{ fontSize: 16 }}>
        {t('lineItemsReturned')}
      </Title>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead style={{ background: 'var(--cr-neutral-100)' }}>
          <tr>
            {[
              t('col.item'),
              t('col.qtyReturned'),
              t('col.reason'),
              t('col.batchNo'),
              t('col.notes'),
            ].map((h) => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gr.lineItems.map((line, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--cr-border-light)' }}>
              <td style={{ padding: '8px 10px' }}>{line.itemName ?? '-'}</td>
              <td style={{ padding: '8px 10px' }}>{line.qtyReturned ?? 0}</td>
              <td style={{ padding: '8px 10px' }}>{line.reason ?? '-'}</td>
              <td style={{ padding: '8px 10px' }}>{line.batchNumber ?? '-'}</td>
              <td style={{ padding: '8px 10px' }}>{line.notes ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Audit Log */}
      {gr.auditLog.length > 0 && (
        <>
          <Title level={2} style={{ fontSize: 16 }}>
            {t('auditLog')}
          </Title>
          {gr.auditLog.map((entry, i) => {
            const e = entry as Record<string, string>;
            return (
              <div key={i} style={{ fontSize: 12, color: 'var(--cr-text-3)', marginBottom: 4 }}>
                {e.action ?? String(entry)} - {e.at ? dayjs(e.at).format('DD MMM YYYY HH:mm') : ''}
              </div>
            );
          })}
        </>
      )}

      {/* Cancel modal */}
      <Modal
        title={t('cancelModalTitle')}
        open={cancelModalOpen}
        onOk={handleCancel}
        onCancel={() => setCancelModalOpen(false)}
        confirmLoading={cancelling}
        okText={t('cancelModalOk')}
        okButtonProps={{ danger: true, disabled: !cancelReason.trim() }}
      >
        {wasStockReduced && (
          <Alert
            type="warning"
            showIcon
            icon={<WarningOutlined />}
            style={{ marginBottom: 12 }}
            title={t('stockRestoreTitle')}
            description={t('stockRestoreBody')}
          />
        )}
        <Text>{t('cancelModalBody')}</Text>
        <Input.TextArea
          style={{ marginTop: 8 }}
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder={t('cancelReasonPlaceholder')}
        />
      </Modal>
    </div>
  );
}
