'use client';
/**
 * EDocumentsSection - one-click GST e-document generation from a posted Tax Invoice
 * (ClearOne pattern). Shows e-Invoice (IRN) + e-Way Bill status at a glance and lets the
 * user generate both without leaving the invoice.
 *
 * Cross-module links:
 *   - e-Invoice: financeSalesApi.invoices.einvoice -> BE EInvoiceController POST
 *     /einvoice/:invoiceId/generate (IRN + signed QR). QR preview via .irpQr -> GET /einvoice/:id/qr.
 *   - e-Way: financeSalesApi.invoices.ewaybill -> BE EwaybillController POST
 *     /ewaybill/:invoiceId/generate (needs transport details, hence the modal).
 *   - Status fields read from SaleInvoice.eInvoice + SaleInvoice.ewayBill.
 *
 * Watch:
 *   - e-Way generation is NOT zero-input (transport mode + distance are mandatory at the
 *     GSTN), so it opens a compact form; e-Invoice is true one-click.
 *   - NIC-direct firms need an IRP session/OTP that this inline action does not collect; on
 *     a session error we route the user to the full e-Invoice page. SurePass firms (session
 *     auto-ready) generate inline.
 *   - Subscription gating: gst_compliance (useFeatureAccess); backend also enforces the
 *     manage_gst_compliance permission and returns 403, surfaced as an error message.
 */
import { useState } from 'react';
import {
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Spin,
  Tag,
  Typography,
  message,
} from 'antd';
import { useTranslations } from 'next-intl';
import { CheckCircleOutlined, QrcodeOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { SaleInvoice } from '@/types';

interface EwayFormValues {
  transMode: '1' | '2' | '3' | '4';
  transDistance: number;
  vehicleNo?: string;
  vehicleType?: 'R' | 'M';
  transporterName?: string;
}

export default function EDocumentsSection({
  workspaceId,
  firmId,
  invoice,
  onRefresh,
}: {
  workspaceId: string;
  firmId: string;
  invoice: SaleInvoice;
  onRefresh: () => void;
}) {
  const t = useTranslations('finance.edocs');
  const gstAccess = useFeatureAccess('gst_compliance');
  const locked = gstAccess.isLocked;

  const invoiceId = invoice._id;
  const ein = invoice.eInvoice;
  const ewb = invoice.ewayBill;
  const irnGenerated = ein?.status === 'generated' && !!ein?.irn;
  const ewbGenerated = !!ewb?.ewbNo;

  const [genIrn, setGenIrn] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [ewayOpen, setEwayOpen] = useState(false);
  const [ewaySubmitting, setEwaySubmitting] = useState(false);
  const [form] = Form.useForm<EwayFormValues>();

  async function handleGenerateIrn() {
    setGenIrn(true);
    try {
      await financeSalesApi.invoices.einvoice(workspaceId, firmId, invoiceId);
      message.success(t('einvoice.done'));
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      // NIC-direct firms need an IRP session/OTP we do not collect inline.
      if (/session|otp|sign|login/i.test(msg)) {
        message.warning(t('einvoice.sessionNeeded'));
      } else {
        message.error(msg || t('einvoice.failed'));
      }
    } finally {
      setGenIrn(false);
    }
  }

  async function openQr() {
    setQrOpen(true);
    setQrLoading(true);
    try {
      const res = await financeSalesApi.invoices.irpQr(workspaceId, firmId, invoiceId);
      setQrDataUrl(res.qrDataUrl);
    } catch {
      message.error(t('einvoice.qrFailed'));
    } finally {
      setQrLoading(false);
    }
  }

  async function handleGenerateEway() {
    let values: EwayFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // validation messages shown inline
    }
    setEwaySubmitting(true);
    try {
      await financeSalesApi.invoices.ewaybill(workspaceId, firmId, invoiceId, {
        transMode: values.transMode,
        transDistance: values.transDistance,
        vehicleNo: values.vehicleNo?.trim() || undefined,
        vehicleType: values.vehicleType,
        transporterName: values.transporterName?.trim() || undefined,
      });
      message.success(t('eway.done'));
      setEwayOpen(false);
      form.resetFields();
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      message.error(msg || t('eway.failed'));
    } finally {
      setEwaySubmitting(false);
    }
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 0',
    flexWrap: 'wrap',
  };
  const metaStyle: React.CSSProperties = { fontSize: 13, color: 'var(--cr-text-3)' };
  const monoStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 12,
  };

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <Divider />
      <Typography.Title level={2} style={{ margin: '0 0 4px', fontSize: 16 }}>
        {t('title')}
      </Typography.Title>

      {/* e-Invoice (IRN) row */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{t('einvoice.label')}</div>
          {irnGenerated ? (
            <div style={metaStyle}>
              <span style={monoStyle}>{ein?.irn}</span>
              {ein?.ackNo ? (
                <span>
                  {' '}
                  · {t('einvoice.ackNo')} {ein.ackNo}
                </span>
              ) : null}
            </div>
          ) : ein?.status === 'not_applicable' ? (
            <div style={metaStyle}>{t('einvoice.notApplicable')}</div>
          ) : (
            <div style={metaStyle}>{t(`status.${ein?.status ?? 'pending'}`)}</div>
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
            </>
          ) : ein?.status === 'not_applicable' ? null : (
            <DsButton
              dsVariant="primary"
              dsSize="sm"
              loading={genIrn}
              disabled={locked}
              onClick={handleGenerateIrn}
            >
              {t('einvoice.generate')}
            </DsButton>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--cr-border-light)' }} />

      {/* e-Way Bill row */}
      <div style={rowStyle}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{t('eway.label')}</div>
          {ewbGenerated ? (
            <div style={metaStyle}>
              <span style={monoStyle}>{ewb?.ewbNo}</span>
              {ewb?.validUpto ? (
                <span>
                  {' '}
                  · {t('eway.validUpto')} {ewb.validUpto}
                </span>
              ) : null}
              {ewb?.vehicleNo ? <span> · {ewb.vehicleNo}</span> : null}
            </div>
          ) : (
            <div style={metaStyle}>{t('eway.notGenerated')}</div>
          )}
        </div>
        <div>
          {ewbGenerated ? (
            <Tag icon={<CheckCircleOutlined />} color="success">
              {t('eway.generated')}
            </Tag>
          ) : (
            <DsButton
              dsVariant="secondary"
              dsSize="sm"
              disabled={locked}
              onClick={() => setEwayOpen(true)}
            >
              {t('eway.generate')}
            </DsButton>
          )}
        </div>
      </div>

      {/* QR preview modal */}
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

      {/* e-Way transport-details modal */}
      <Modal
        open={ewayOpen}
        onCancel={() => setEwayOpen(false)}
        onOk={handleGenerateEway}
        okText={t('eway.submit')}
        okButtonProps={{ loading: ewaySubmitting }}
        title={t('eway.modalTitle')}
        destroyOnHidden
      >
        <Form<EwayFormValues>
          form={form}
          layout="vertical"
          initialValues={{ transMode: '1', vehicleType: 'R' }}
        >
          <Form.Item name="transMode" label={t('eway.transMode')} rules={[{ required: true }]}>
            <Select
              options={[
                { value: '1', label: t('eway.mode.road') },
                { value: '2', label: t('eway.mode.rail') },
                { value: '3', label: t('eway.mode.air') },
                { value: '4', label: t('eway.mode.ship') },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="transDistance"
            label={t('eway.distance')}
            rules={[{ required: true, message: t('eway.distanceRequired') }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="vehicleNo" label={t('eway.vehicleNo')}>
            <Input placeholder="GJ05AB1234" />
          </Form.Item>
          <Form.Item name="vehicleType" label={t('eway.vehicleType')}>
            <Select
              options={[
                { value: 'R', label: t('eway.vtype.regular') },
                { value: 'M', label: t('eway.vtype.odc') },
              ]}
            />
          </Form.Item>
          <Form.Item name="transporterName" label={t('eway.transporterName')}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
