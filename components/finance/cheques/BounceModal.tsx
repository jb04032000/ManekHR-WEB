'use client';

import { useTransition } from 'react';
import { Modal, Form, DatePicker, Input, InputNumber, Typography, message } from 'antd';
import { bounceCheque, type BounceChequeInput } from '@/lib/actions/finance-cheques.actions';
import type { FinanceCheque } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

interface BounceModalProps {
  open: boolean;
  cheque: FinanceCheque | null;
  wsId: string;
  firmId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function BounceModal({
  open,
  cheque,
  wsId,
  firmId,
  onSuccess,
  onCancel,
}: BounceModalProps) {
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();

  const handleOk = () => {
    form.validateFields().then((values) => {
      if (!cheque) return;
      startTransition(async () => {
        const dto: BounceChequeInput = {
          bounceDate: (values.bounceDate as ReturnType<typeof dayjs>).format('YYYY-MM-DD'),
          bounceReason: values.bounceReason as string,
          ourBankChargePaise: Math.round(((values.ourBankCharge as number) ?? 0) * 100),
          partyChargePaise: Math.round(((values.partyCharge as number) ?? 0) * 100),
        };
        try {
          await bounceCheque(wsId, firmId, cheque._id, dto);
          message.success(`Cheque #${cheque.chequeNumber} marked as bounced`);
          form.resetFields();
          onSuccess();
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Failed to bounce cheque';
          message.error(msg);
        }
      });
    });
  };

  const isReceived = cheque?.chequeType === 'received';

  return (
    <Modal
      title={`Mark Cheque #${cheque?.chequeNumber ?? ''} as Bounced`}
      open={open}
      onCancel={() => {
        form.resetFields();
        onCancel();
      }}
      onOk={handleOk}
      okText="Mark Bounced"
      okButtonProps={{ danger: true, loading: isPending }}
      destroyOnHidden
    >
      <Text type="warning" style={{ display: 'block', marginBottom: 12 }}>
        This will reverse the original payment entry and post bounce charges. This action cannot be
        undone.
      </Text>

      <Form form={form} layout="vertical" initialValues={{ ourBankCharge: 0, partyCharge: 0 }}>
        <Form.Item
          name="bounceDate"
          label="Bounce Date"
          rules={[{ required: true, message: 'Required' }]}
        >
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" defaultValue={dayjs()} />
        </Form.Item>

        <Form.Item
          name="bounceReason"
          label="Bounce Reason"
          rules={[{ required: true, min: 3, message: 'Reason must be at least 3 characters' }]}
        >
          <Input.TextArea rows={2} placeholder="e.g. Insufficient funds" />
        </Form.Item>

        <Form.Item name="ourBankCharge" label="Our Bank Charge (₹)">
          <InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} />
        </Form.Item>

        {isReceived && (
          <Form.Item name="partyCharge" label="Party Charge Recovered (₹)">
            <InputNumber min={0} precision={2} prefix="₹" style={{ width: '100%' }} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
