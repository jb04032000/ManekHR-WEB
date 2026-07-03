'use client';

import React, { startTransition, useEffect, useState } from 'react';
import { DatePicker, Form, Select, message } from 'antd';
import { DsModal } from '@/components/ui/DsModal';
import { DsInput } from '@/components/ui/DsInput';
import DsButton from '@/components/ui/DsButton';
import { extendEwb } from '@/lib/actions/finance/gst.actions';

function formatDate(val: string | Date | undefined): string {
  if (!val) return '-';
  return new Date(val).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface EwbExtendModalProps {
  open: boolean;
  invoiceId: string;
  ewbNo: string;
  validUpto: string | Date;
  wsId: string;
  firmId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const EXTEND_REASONS = [
  { value: 1, label: '1 - Breakdown' },
  { value: 2, label: '2 - Detour' },
  { value: 3, label: '3 - Wrong Address' },
  { value: 4, label: '4 - Others' },
  { value: 5, label: '5 - Natural Calamity' },
  { value: 6, label: '6 - Law/Order' },
  { value: 7, label: '7 - Transshipment' },
];

export default function EwbExtendModal({
  open,
  invoiceId,
  ewbNo,
  validUpto,
  wsId,
  firmId,
  onSuccess,
  onClose,
}: EwbExtendModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [transMode, setTransMode] = useState('Road');

  useEffect(() => {
    if (open) {
      form.resetFields();
      startTransition(() => {
        setTransMode('Road');
      });
    }
  }, [open, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await extendEwb(wsId, firmId, invoiceId, {
        vehicleNo: values.vehicleNo,
        fromPlace: values.fromPlace,
        remainDist: values.remainDist,
        transMode: values.transMode,
        vehicleType: values.vehicleType,
        transDocNo: values.transDocNo,
        transDocDate: values.transDocDate ? values.transDocDate.toISOString() : undefined,
        extnReason: values.extnReason,
      });
      message.success(`EWB #${ewbNo} extended`, 3);
      onSuccess();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // form validation error
      const msg = err instanceof Error ? err.message : 'Extension failed';
      if (msg.includes('EWB_EXTENSION_WINDOW')) {
        message.error(
          'Extension not available. EWBs can only be extended within ±8 hours of expiry.',
          5,
        );
      } else {
        message.error(`e-Way Bill extension failed: ${msg}`, 5);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DsModal
      open={open}
      title={`Extend e-Way Bill #${ewbNo}`}
      onCancel={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <DsButton dsVariant="ghost" onClick={onClose}>
            Cancel
          </DsButton>
          <DsButton dsVariant="primary" loading={submitting} onClick={handleSubmit}>
            Extend EWB
          </DsButton>
        </div>
      }
      width={540}
    >
      <div className="mb-4">
        <p className="font-body text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
          Currently valid until <strong>{formatDate(validUpto)}</strong>
        </p>
      </div>

      <Form
        form={form}
        layout="vertical"
        validateTrigger="onBlur"
        initialValues={{ transMode: 'Road', vehicleType: 'Regular', extnReason: 1 }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Form.Item
            label="Vehicle No"
            name="vehicleNo"
            rules={[{ required: true, message: 'Vehicle No is required' }]}
          >
            <DsInput placeholder="GJ01AB1234" style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item
            label="From Place"
            name="fromPlace"
            rules={[{ required: true, message: 'From Place is required' }]}
          >
            <DsInput placeholder="e.g. Surat" />
          </Form.Item>

          <Form.Item
            label="Remaining Distance (km)"
            name="remainDist"
            rules={[{ required: true, message: 'Remaining distance is required' }]}
          >
            <DsInput type="number" placeholder="0" />
          </Form.Item>

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

          {transMode === 'Road' && (
            <Form.Item label="Vehicle Type" name="vehicleType">
              <Select
                options={[
                  { value: 'Regular', label: 'Regular' },
                  { value: 'ODC', label: 'ODC (Over-dimensional cargo)' },
                ]}
              />
            </Form.Item>
          )}

          <Form.Item label="Extension Reason" name="extnReason">
            <Select options={EXTEND_REASONS} />
          </Form.Item>

          <Form.Item label="Trans Doc No (optional)" name="transDocNo">
            <DsInput placeholder="Optional" />
          </Form.Item>

          <Form.Item label="Trans Doc Date (optional)" name="transDocDate">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>
    </DsModal>
  );
}
