'use client';
/**
 * CreditNoteEInvoiceSection - one-click IRN (e-Invoice) generation on a posted Credit Note.
 * Credit notes are CRN e-invoice documents for e-invoice-eligible firms.
 *
 * Cross-module links:
 *   - generateCreditNoteIrn -> BE EInvoiceController POST /einvoice/credit-note/:id/generate
 *     -> EInvoiceService.generateIrnForCreditNote (payload includes PrecDocDtls = original invoice).
 *   - getCreditNoteIrnQr -> GET /einvoice/credit-note/:id/qr (signed QR as a PNG data URL).
 *   - Status read from CreditNote.eInvoice (schema field added with this feature).
 *   - Reuses the finance.edocs.einvoice i18n keys (shared with the invoice EDocumentsSection).
 *
 * Watch: NIC-direct firms need an IRP session/OTP this inline action does not collect; a session
 * error routes the user to the full e-Invoice page. SurePass firms generate inline. Subscription
 * gated by gst_compliance; backend also enforces manage_gst_compliance.
 */
import { useState } from 'react';
import { Divider, Form, Input, Modal, Select, Spin, Tag, Typography, message } from 'antd';
import { useTranslations } from 'next-intl';
import { CheckCircleOutlined, QrcodeOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  cancelCreditNoteIrn,
  generateCreditNoteIrn,
  getCreditNoteIrnQr,
} from '@/lib/actions/finance-returns.actions';
import type { CreditNote } from '@/types';

export default function CreditNoteEInvoiceSection({
  workspaceId,
  firmId,
  creditNote,
  onRefresh,
}: {
  workspaceId: string;
  firmId: string;
  creditNote: CreditNote;
  onRefresh: () => void;
}) {
  const t = useTranslations('finance.edocs');
  const gstAccess = useFeatureAccess('gst_compliance');
  const locked = gstAccess.isLocked;

  const ein = creditNote.eInvoice;
  const irnGenerated = ein?.status === 'generated' && !!ein?.irn;

  const [gen, setGen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelForm] = Form.useForm<{ cancelReason: number; cancelRemarks: string }>();

  async function handleGenerate() {
    setGen(true);
    try {
      await generateCreditNoteIrn(workspaceId, firmId, creditNote._id);
      message.success(t('einvoice.done'));
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (/session|otp|sign|login/i.test(msg)) message.warning(t('einvoice.sessionNeeded'));
      else message.error(msg || t('einvoice.failed'));
    } finally {
      setGen(false);
    }
  }

  async function openQr() {
    setQrOpen(true);
    setQrLoading(true);
    try {
      const res = await getCreditNoteIrnQr(workspaceId, firmId, creditNote._id);
      setQrDataUrl(res.qrDataUrl);
    } catch {
      message.error(t('einvoice.qrFailed'));
    } finally {
      setQrLoading(false);
    }
  }

  async function handleCancel() {
    let values: { cancelReason: number; cancelRemarks: string };
    try {
      values = await cancelForm.validateFields();
    } catch {
      return;
    }
    setCancelling(true);
    try {
      await cancelCreditNoteIrn(
        workspaceId,
        firmId,
        creditNote._id,
        values.cancelReason,
        values.cancelRemarks.trim(),
      );
      message.success(t('einvoice.cancel.done'));
      setCancelOpen(false);
      cancelForm.resetFields();
      onRefresh();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('einvoice.cancel.failed'));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <Divider />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <Typography.Title level={2} style={{ margin: 0, fontSize: 16 }}>
            {t('einvoice.label')}
          </Typography.Title>
          {irnGenerated ? (
            <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
              <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
                {ein?.irn}
              </span>
              {ein?.ackNo ? (
                <span>
                  {' '}
                  · {t('einvoice.ackNo')} {ein.ackNo}
                </span>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
              {t(`status.${ein?.status ?? 'pending'}`)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {irnGenerated ? (
            <>
              <Tag icon={<CheckCircleOutlined />} color="success">
                {t('einvoice.generated')}
              </Tag>
              <DsButton dsVariant="secondary" dsSize="sm" onClick={openQr}>
                <QrcodeOutlined /> {t('einvoice.viewQr')}
              </DsButton>
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                disabled={locked}
                onClick={() => setCancelOpen(true)}
              >
                {t('einvoice.cancel.action')}
              </DsButton>
            </>
          ) : (
            <DsButton
              dsVariant="primary"
              dsSize="sm"
              loading={gen}
              disabled={locked}
              onClick={handleGenerate}
            >
              {t('einvoice.generate')}
            </DsButton>
          )}
        </div>
      </div>

      <Modal
        open={qrOpen}
        onCancel={() => setQrOpen(false)}
        footer={null}
        title={t('qrModalTitle')}
      >
        <div style={{ textAlign: 'center', padding: 16 }}>
          {qrLoading ? (
            <Spin />
          ) : qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="e-Invoice QR" style={{ maxWidth: 240, width: '100%' }} />
          ) : (
            <Typography.Text type="secondary">{t('einvoice.qrFailed')}</Typography.Text>
          )}
        </div>
      </Modal>

      {/* Cancel IRN modal - GST portal allows IRN cancellation within 24h of acknowledgement. */}
      <Modal
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={handleCancel}
        okText={t('einvoice.cancel.action')}
        okButtonProps={{ loading: cancelling, danger: true }}
        title={t('einvoice.cancel.modalTitle')}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          {t('einvoice.cancel.note')}
        </Typography.Paragraph>
        <Form form={cancelForm} layout="vertical" initialValues={{ cancelReason: 2 }}>
          <Form.Item
            name="cancelReason"
            label={t('einvoice.cancel.reason')}
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 1, label: t('einvoice.cancel.reasons.duplicate') },
                { value: 2, label: t('einvoice.cancel.reasons.dataEntry') },
                { value: 3, label: t('einvoice.cancel.reasons.orderCancelled') },
                { value: 4, label: t('einvoice.cancel.reasons.others') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="cancelRemarks"
            label={t('einvoice.cancel.remarks')}
            rules={[{ required: true, message: t('einvoice.cancel.remarksRequired') }]}
          >
            <Input.TextArea rows={2} maxLength={100} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
