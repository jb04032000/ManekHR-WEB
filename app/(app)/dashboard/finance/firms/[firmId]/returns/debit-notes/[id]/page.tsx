'use client';

import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Descriptions, Skeleton, Space, Typography, Alert, message, Modal, Input } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import {
  getDebitNote,
  postDebitNote,
  cancelDebitNote,
} from '@/lib/actions/finance-returns.actions';
import DsButton from '@/components/ui/DsButton';
import type { DebitNote } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function DebitNoteDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.returns.dnDetail');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [dn, setDn] = useState<DebitNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId || !id) return;
    startTransition(() => {
      setLoading(true);
    });
    getDebitNote(workspaceId, firmId, id)
      .then(setDn)
      .catch(() => setDn(null))
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, id]);

  const handlePost = async () => {
    if (!workspaceId || !dn) return;
    setPosting(true);
    try {
      const updated = await postDebitNote(workspaceId, firmId, dn._id);
      setDn(updated);
      message.success(t('posted'));
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('postFailed'));
    } finally {
      setPosting(false);
    }
  };

  const handleCancel = async () => {
    if (!workspaceId || !dn || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const updated = await cancelDebitNote(workspaceId, firmId, dn._id, cancelReason);
      setDn(updated);
      message.success(t('cancelled'));
      setCancelModalOpen(false);
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('cancelFailed'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Skeleton active style={{ padding: 24 }} />;
  if (!dn) return <div style={{ padding: 24 }}>{t('notFound')}</div>;

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
            {t('title', { number: dn.voucherNumber ?? t('draft') })}
          </Title>
          <Space style={{ marginTop: 4 }}>
            <Tag color={STATE_COLOR[dn.state] ?? 'default'}>{dn.state.toUpperCase()}</Tag>
            <Tag color="blue">{dn.dnType.replace(/_/g, ' ').toUpperCase()}</Tag>
          </Space>
        </div>
        <Space>
          {dn.state === 'draft' && (
            <DsButton dsVariant="primary" loading={posting} onClick={handlePost}>
              {t('post')}
            </DsButton>
          )}
          {dn.state === 'posted' && (
            <DsButton dsVariant="danger" onClick={() => setCancelModalOpen(true)}>
              {t('cancel')}
            </DsButton>
          )}
        </Space>
      </div>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('field.voucherDate')}>
          {dayjs(dn.voucherDate).format('DD MMM YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendor')}>
          {(dn.partySnapshot as Record<string, string> | undefined)?.name ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.sourceBill')}>{dn.sourceBillNumber}</Descriptions.Item>
        <Descriptions.Item label={t('field.sourceBillDate')}>
          {dayjs(dn.sourceBillDate).format('DD MMM YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.dnType')}>
          {dn.dnType.replace(/_/g, ' ')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendorBillRef')}>
          {dn.vendorBillRef ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.sourceGrnReturn')}>
          {dn.sourceGrnReturnNumber ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendorAccepted')}>
          {dn.vendorAccepted ? t('yes') : t('no')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.taxableValue')}>
          {formatPaise(dn.taxableValuePaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.cgst')}>{formatPaise(dn.cgstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.sgst')}>{formatPaise(dn.sgstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.igst')}>{formatPaise(dn.igstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.grandTotal')}>
          {formatPaise(dn.grandTotalPaise)}
        </Descriptions.Item>
        {dn.cancellationReason && (
          <Descriptions.Item label={t('field.cancellationReason')}>
            {dn.cancellationReason}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* TDS Adjustment Note */}
      {dn.tdsAdjustmentNote && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          title={t('tdsNoteTitle')}
          description={dn.tdsAdjustmentNote.note}
        />
      )}

      {/* Line Items */}
      <Title level={2} style={{ fontSize: 16 }}>
        {t('lineItems')}
      </Title>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead style={{ background: 'var(--cr-neutral-100)' }}>
          <tr>
            {[
              t('col.item'),
              t('col.hsn'),
              t('col.qty'),
              t('col.rate'),
              t('col.gstPercent'),
              t('col.total'),
              t('col.capitalGoods'),
            ].map((h) => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dn.lineItems.map((line, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--cr-border-light)' }}>
              <td style={{ padding: '8px 10px' }}>{line.itemName ?? '-'}</td>
              <td style={{ padding: '8px 10px' }}>{line.hsnSacCode ?? '-'}</td>
              <td style={{ padding: '8px 10px' }}>{line.qty ?? 0}</td>
              <td style={{ padding: '8px 10px' }}>{formatPaise(line.ratePaise ?? 0)}</td>
              <td style={{ padding: '8px 10px' }}>{line.taxRate ?? 0}%</td>
              <td style={{ padding: '8px 10px' }}>{formatPaise(line.lineTotalPaise ?? 0)}</td>
              <td style={{ padding: '8px 10px' }}>
                {line.isCapitalGoods ? (
                  <Tag color="orange">{t('capitalGoodsTag')}</Tag>
                ) : (
                  <Tag color="default">{t('regularTag')}</Tag>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Audit Log */}
      {dn.auditLog.length > 0 && (
        <>
          <Title level={2} style={{ fontSize: 16 }}>
            {t('auditLog')}
          </Title>
          {dn.auditLog.map((entry, i) => {
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
