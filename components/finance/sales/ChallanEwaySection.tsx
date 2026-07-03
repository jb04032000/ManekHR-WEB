'use client';
/**
 * ChallanEwaySection - one-click e-Way Bill generation on a posted Delivery Challan.
 * Challans move goods, so the e-Way bill is the primary GST document here.
 *
 * Cross-module links:
 *   - financeSalesApi.deliveryChallans.ewaybill -> BE EwaybillController POST
 *     /ewaybill/challan/:challanId/generate -> EwaybillService.generateForChallan.
 *   - Status read from DeliveryChallan.ewayBill (schema field added with this feature).
 *   - Reuses the finance.edocs.eway.* i18n keys (shared with the invoice EDocumentsSection).
 *
 * Watch:
 *   - The transport form pre-fills from challan.shipping (vehicle / distance / transporter).
 *   - Transport mode + distance are GSTN-mandatory, so this is a short form (not zero-click).
 *   - Subscription gated by gst_compliance; backend also enforces manage_gst_compliance.
 */
import { useState } from 'react';
import { Divider, Form, Input, InputNumber, Modal, Select, Tag, Typography, message } from 'antd';
import { useTranslations } from 'next-intl';
import { CheckCircleOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import type { DeliveryChallan } from '@/types';

interface EwayFormValues {
  transMode: '1' | '2' | '3' | '4';
  transDistance: number;
  vehicleNo?: string;
  vehicleType?: 'R' | 'M';
  transporterName?: string;
}

export default function ChallanEwaySection({
  workspaceId,
  firmId,
  challan,
  onRefresh,
}: {
  workspaceId: string;
  firmId: string;
  challan: DeliveryChallan;
  onRefresh: () => void;
}) {
  const t = useTranslations('finance.edocs');
  const gstAccess = useFeatureAccess('gst_compliance');
  const locked = gstAccess.isLocked;

  const ewb = challan.ewayBill;
  const ewbGenerated = !!ewb?.ewbNo;

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<EwayFormValues>();

  async function handleGenerate() {
    let values: EwayFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSubmitting(true);
    try {
      await financeSalesApi.deliveryChallans.ewaybill(workspaceId, firmId, challan._id, {
        transMode: values.transMode,
        transDistance: values.transDistance,
        vehicleNo: values.vehicleNo?.trim() || undefined,
        vehicleType: values.vehicleType,
        transporterName: values.transporterName?.trim() || undefined,
      });
      message.success(t('eway.done'));
      setOpen(false);
      form.resetFields();
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      message.error(msg || t('eway.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  const metaStyle: React.CSSProperties = { fontSize: 13, color: 'var(--cr-text-3)' };
  const monoStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono, monospace)',
    fontSize: 12,
  };

  return (
    <div style={{ padding: '0 24px 24px' }}>
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
            {t('eway.label')}
          </Typography.Title>
          {ewbGenerated ? (
            <div style={metaStyle}>
              <span style={monoStyle}>{ewb?.ewbNo}</span>
              {ewb?.validUpto ? (
                <span>
                  {' '}
                  · {t('eway.validUpto')} {new Date(ewb.validUpto).toLocaleDateString('en-IN')}
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
              dsVariant="primary"
              dsSize="sm"
              disabled={locked}
              onClick={() => setOpen(true)}
            >
              {t('eway.generate')}
            </DsButton>
          )}
        </div>
      </div>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleGenerate}
        okText={t('eway.submit')}
        okButtonProps={{ loading: submitting }}
        title={t('eway.modalTitle')}
        destroyOnHidden
      >
        <Form<EwayFormValues>
          form={form}
          layout="vertical"
          initialValues={{
            transMode: '1',
            vehicleType: 'R',
            // Pre-fill from the challan's shipping block when present.
            vehicleNo: challan.shipping?.vehicleNo,
            transDistance: challan.shipping?.distance,
            transporterName: challan.shipping?.transporter,
          }}
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
