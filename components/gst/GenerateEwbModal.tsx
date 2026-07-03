'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { Form, Select, Tag, message } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { DsModal } from '@/components/ui/DsModal';
import { DsInput } from '@/components/ui/DsInput';
import DsButton from '@/components/ui/DsButton';
import { generateEwb } from '@/lib/actions/finance/gst.actions';

/**
 * Gujarat textile exemption HSN range check - matches backend logic:
 * fromStateCode===24 AND toStateCode===24 AND ALL items HSN in [5001, 6309] OR === 9988
 */
function allItemsHsnInRange(lineItems: any[]): boolean {
  if (!lineItems || lineItems.length === 0) return false;
  return lineItems.every((item) => {
    const hsn = parseInt((item.hsnSacCode ?? item.hsnCd ?? '').replace(/\D/g, ''), 10);
    if (isNaN(hsn)) return false;
    return (hsn >= 5001 && hsn <= 6309) || hsn === 9988;
  });
}

interface GenerateEwbModalProps {
  open: boolean;
  invoiceId: string;
  wsId: string;
  firmId: string;
  /** Optional: from firm (for Gujarat exemption check) */
  firmStateCode?: number;
  /** Optional: from partySnapshot */
  partyStateCode?: number;
  lineItems?: any[];
  onSuccess: (ewbNo: string, validUpto: string) => void;
  onClose: () => void;
}

export default function GenerateEwbModal({
  open,
  invoiceId,
  wsId,
  firmId,
  firmStateCode,
  partyStateCode,
  lineItems,
  onSuccess,
  onClose,
}: GenerateEwbModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [transMode, setTransMode] = useState('Road');
  const [overrideExemption, setOverrideExemption] = useState(false);

  const isGujaratExempt =
    firmStateCode === 24 && partyStateCode === 24 && allItemsHsnInRange(lineItems ?? []);

  useEffect(() => {
    if (open) {
      form.resetFields();
      startTransition(() => {
        setTransMode('Road');
        setOverrideExemption(false);
      });
    }
  }, [open, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const result = await generateEwb(wsId, firmId, invoiceId, {
        transMode: values.transMode,
        transDistance: parseInt(values.transDistance, 10),
        vehicleNo: values.vehicleNo,
        vehicleType: values.vehicleType,
        overrideExemption: overrideExemption || undefined,
      });
      message.success(`EWB generated: ${(result as any).ewbNo}`, 3);
      onSuccess((result as any).ewbNo, (result as any).validUpto);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      const msg = err instanceof Error ? err.message : 'EWB generation failed';
      message.error(`e-Way Bill generation failed: ${msg}`, 5);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DsModal
      open={open}
      title="Generate e-Way Bill"
      onCancel={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <DsButton dsVariant="ghost" onClick={onClose}>
            Cancel
          </DsButton>
          <DsButton dsVariant="primary" loading={submitting} onClick={handleSubmit}>
            Generate EWB
          </DsButton>
        </div>
      }
      width={520}
    >
      {/* Gujarat textile exemption badge */}
      {isGujaratExempt && !overrideExemption && (
        <div className="mb-4">
          <Tag
            icon={<CheckCircleOutlined />}
            color="success"
            style={{ whiteSpace: 'normal', fontSize: 13, padding: '6px 10px', lineHeight: 1.5 }}
          >
            Gujarat textile exemption - EWB not required for this intrastate movement.
          </Tag>
          <div className="mt-2">
            <DsButton dsVariant="ghost" dsSize="sm" onClick={() => setOverrideExemption(true)}>
              Generate EWB anyway
            </DsButton>
          </div>
        </div>
      )}

      {(!isGujaratExempt || overrideExemption) && (
        <Form
          form={form}
          layout="vertical"
          validateTrigger="onBlur"
          initialValues={{ transMode: 'Road', vehicleType: 'Regular' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Transport Mode" name="transMode">
              <Select
                options={[
                  { value: 'Road', label: 'Road' },
                  { value: 'Rail', label: 'Rail' },
                  { value: 'Air', label: 'Air' },
                  { value: 'Ship', label: 'Ship' },
                ]}
                onChange={(v) => setTransMode(v)}
              />
            </Form.Item>

            <Form.Item
              label="Distance (km)"
              name="transDistance"
              rules={[{ required: true, message: 'Distance is required' }]}
            >
              <DsInput type="number" placeholder="0" />
            </Form.Item>

            {transMode === 'Road' && (
              <>
                <Form.Item
                  label="Vehicle No"
                  name="vehicleNo"
                  rules={[{ required: true, message: 'Vehicle No is required for Road mode' }]}
                >
                  <DsInput placeholder="GJ01AB1234" style={{ textTransform: 'uppercase' }} />
                </Form.Item>

                <Form.Item label="Vehicle Type" name="vehicleType">
                  <Select
                    options={[
                      { value: 'Regular', label: 'Regular' },
                      { value: 'ODC', label: 'ODC (Over-dimensional cargo)' },
                    ]}
                  />
                </Form.Item>
              </>
            )}

            <Form.Item label="Transporter ID (optional)" name="transporterId">
              <DsInput placeholder="Optional" />
            </Form.Item>

            <Form.Item label="Transporter Name (optional)" name="transporterName">
              <DsInput placeholder="Optional" />
            </Form.Item>

            <Form.Item label="Trans Doc No (optional)" name="transDocNo">
              <DsInput placeholder="Optional" />
            </Form.Item>
          </div>
        </Form>
      )}
    </DsModal>
  );
}
