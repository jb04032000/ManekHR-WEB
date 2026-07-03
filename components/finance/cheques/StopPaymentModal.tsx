'use client';

import { useTransition } from 'react';
import { Modal, Form, DatePicker, Input, Typography, message } from 'antd';
import { stopPayment, type StopPaymentInput } from '@/lib/actions/finance-cheques.actions';
import type { FinanceCheque } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface StopPaymentModalProps {
  open: boolean;
  cheque: FinanceCheque | null;
  wsId: string;
  firmId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function StopPaymentModal({
  open,
  cheque,
  wsId,
  firmId,
  onSuccess,
  onCancel,
}: StopPaymentModalProps) {
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();

  const handleOk = () => {
    form.validateFields().then((values) => {
      if (!cheque) return;
      startTransition(async () => {
        const dto: StopPaymentInput = {
          narration: values.narration as string,
        };
        try {
          await stopPayment(wsId, firmId, cheque._id, dto);
          message.success(`Stop payment placed on cheque #${cheque.chequeNumber}`);
          form.resetFields();
          onSuccess();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to stop payment';
          message.error(msg);
        }
      });
    });
  };

  return (
    <Modal
      title={`Stop Payment - Cheque #${cheque?.chequeNumber ?? ''}`}
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      okText="Confirm Stop Payment"
      okButtonProps={{ danger: true, loading: isPending }}
      destroyOnHidden
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        A stop payment instruction will be recorded. The cheque status will change to Stopped.
      </Text>

      <Form form={form} layout="vertical">
        <Form.Item
          name="narration"
          label="Reason for Stop Payment"
          rules={[
            { required: true, message: 'Required' },
            { min: 5, message: 'Must be at least 5 characters' },
          ]}
        >
          <Input.TextArea
            rows={3}
            placeholder="Reason for stop payment (e.g. Dispute with vendor, goods not delivered)"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
