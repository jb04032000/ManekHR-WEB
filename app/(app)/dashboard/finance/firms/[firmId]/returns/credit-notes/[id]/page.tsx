'use client';

import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Descriptions, Skeleton, Space, Typography, Alert, message, Modal, Input } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import {
  getCreditNote,
  postCreditNote,
  cancelCreditNote,
} from '@/lib/actions/finance-returns.actions';
import DsButton from '@/components/ui/DsButton';
import CreditNoteEInvoiceSection from '@/components/finance/sales/CreditNoteEInvoiceSection';
import type { CreditNote } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CreditNoteDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.returns.cnDetail');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [cn, setCn] = useState<CreditNote | null>(null);
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
    getCreditNote(workspaceId, firmId, id)
      .then(setCn)
      .catch(() => setCn(null))
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, id]);

  // Re-fetch the credit note (used as CreditNoteEInvoiceSection onRefresh so a freshly
  // generated IRN shows immediately).
  const reload = () => {
    if (!workspaceId || !firmId || !id) return;
    getCreditNote(workspaceId, firmId, id)
      .then(setCn)
      .catch(() => undefined);
  };

  const handlePost = async () => {
    if (!workspaceId || !cn) return;
    setPosting(true);
    try {
      const updated = await postCreditNote(workspaceId, firmId, cn._id);
      setCn(updated);
      message.success(t('posted'));
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('postFailed'));
    } finally {
      setPosting(false);
    }
  };

  const handleCancel = async () => {
    if (!workspaceId || !cn || !cancelReason.trim()) return;
    setCancelling(true);
    try {
      const updated = await cancelCreditNote(workspaceId, firmId, cn._id, cancelReason);
      setCn(updated);
      message.success(t('cancelled'));
      setCancelModalOpen(false);
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('cancelFailed'));
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <Skeleton active style={{ padding: 24 }} />;
  if (!cn) return <div style={{ padding: 24 }}>{t('notFound')}</div>;

  const isB2B = cn.cdnrType === 'cdnr';

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
            {t('title', { number: cn.voucherNumber ?? t('draft') })}
          </Title>
          <Space style={{ marginTop: 4 }}>
            <Tag color={STATE_COLOR[cn.state] ?? 'default'}>{cn.state.toUpperCase()}</Tag>
            <Tag color="blue">{cn.cnType.replace(/_/g, ' ').toUpperCase()}</Tag>
          </Space>
        </div>
        <Space>
          {cn.state === 'draft' && (
            <DsButton dsVariant="primary" loading={posting} onClick={handlePost}>
              {t('post')}
            </DsButton>
          )}
          {cn.state === 'posted' && (
            <DsButton dsVariant="danger" onClick={() => setCancelModalOpen(true)}>
              {t('cancel')}
            </DsButton>
          )}
        </Space>
      </div>

      {/* Details */}
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('field.voucherDate')}>
          {dayjs(cn.voucherDate).format('DD MMM YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.party')}>
          {(cn.partySnapshot as Record<string, string> | undefined)?.name ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.sourceInvoice')}>
          {cn.sourceInvoiceNumber}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.sourceInvoiceDate')}>
          {dayjs(cn.sourceInvoiceDate).format('DD MMM YYYY')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.cnType')}>
          {cn.cnType.replace(/_/g, ' ')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.reasonCode')}>
          {cn.reasonCode?.replace(/_/g, ' ') ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.taxableValue')}>
          {formatPaise(cn.taxableValuePaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.cgst')}>{formatPaise(cn.cgstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.sgst')}>{formatPaise(cn.sgstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.igst')}>{formatPaise(cn.igstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.grandTotal')}>
          {formatPaise(cn.grandTotalPaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.refundAmount')}>
          {formatPaise(cn.refundAmountPaise)}
        </Descriptions.Item>
        {cn.postedAt && (
          <Descriptions.Item label={t('field.postedAt')}>
            {dayjs(cn.postedAt).format('DD MMM YYYY HH:mm')}
          </Descriptions.Item>
        )}
        {cn.cancellationReason && (
          <Descriptions.Item label={t('field.cancellationReason')}>
            {cn.cancellationReason}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Finance Act 2025 panel */}
      {isB2B && (
        <Alert
          type={cn.recipientItcReversalStatus === 'pending' ? 'warning' : 'success'}
          showIcon
          style={{ marginBottom: 16 }}
          title={t('itcStatusTitle')}
          description={
            <span>
              {t('itcStatusBody')}
              <Text strong>{cn.recipientItcReversalStatus.replace(/_/g, ' ').toUpperCase()}</Text>
            </span>
          }
        />
      )}

      {/* e-Invoice (IRN) for the credit note - CRN. Posted CNs only. */}
      {cn.state === 'posted' && workspaceId && (
        <CreditNoteEInvoiceSection
          workspaceId={workspaceId}
          firmId={firmId}
          creditNote={cn}
          onRefresh={reload}
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
              t('col.reverseStock'),
            ].map((h) => (
              <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cn.lineItems.map((line, i) => (
            <tr key={i} style={{ borderTop: '1px solid var(--cr-border-light)' }}>
              <td style={{ padding: '8px 10px' }}>{line.itemName ?? '-'}</td>
              <td style={{ padding: '8px 10px' }}>{line.hsnSacCode ?? '-'}</td>
              <td style={{ padding: '8px 10px' }}>{line.qty ?? 0}</td>
              <td style={{ padding: '8px 10px' }}>{formatPaise(line.ratePaise ?? 0)}</td>
              <td style={{ padding: '8px 10px' }}>{line.taxRate ?? 0}%</td>
              <td style={{ padding: '8px 10px' }}>{formatPaise(line.lineTotalPaise ?? 0)}</td>
              <td style={{ padding: '8px 10px' }}>
                <Tag color={line.reverseStock ? 'green' : 'default'}>
                  {line.reverseStock ? t('yes') : t('no')}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Audit Log */}
      {cn.auditLog.length > 0 && (
        <>
          <Title level={2} style={{ fontSize: 16 }}>
            {t('auditLog')}
          </Title>
          {cn.auditLog.map((entry, i) => {
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
