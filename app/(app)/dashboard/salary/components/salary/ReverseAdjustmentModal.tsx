'use client';

import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';

interface ReverseAdjustmentModalProps {
  open: boolean;
  intent: 'reverse' | 'reverse_and_correct';
  form: FormInstance;
  confirmLoading: boolean;
  onCancel: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (vals: any) => void;
}

export function ReverseAdjustmentModal({
  open,
  intent,
  form,
  confirmLoading,
  onCancel,
  onSubmit,
}: ReverseAdjustmentModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={
        <span className="font-display">
          {intent === 'reverse_and_correct'
            ? 'Reverse And Prepare Correction'
            : 'Reverse Adjustment'}
        </span>
      }
      onOk={() => form.submit()}
      confirmLoading={confirmLoading}
      okText={intent === 'reverse_and_correct' ? 'Reverse And Continue' : 'Reverse'}
      okButtonProps={{ danger: true }}
    >
      {intent === 'reverse_and_correct' && (
        <div
          className="mb-4 rounded-[10px] px-3 py-2 text-[12px]"
          style={{ background: 'var(--cr-info-50)', color: 'var(--cr-info-700)' }}
        >
          The original posted entry will be reversed first. We&apos;ll then prefill a corrected
          re-entry so the money trail stays immutable.
        </div>
      )}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={onSubmit}>
        <Form.Item
          name="reversalReason"
          label="Reversal Note"
          rules={[{ required: true, message: 'Enter a reversal note' }]}
        >
          <Input.TextArea rows={3} placeholder="Why is this adjustment being reversed?" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
