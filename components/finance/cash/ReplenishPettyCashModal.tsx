'use client';

import { useTransition } from 'react';
import { Modal, Form, Select, InputNumber, Input, message } from 'antd';
import type { CashRegisterExtended } from '@/types';
import { replenishPettyCash } from '@/lib/actions/finance-cash-registers.actions';

interface ReplenishPettyCashModalProps {
  wsId: string;
  firmId: string;
  register: CashRegisterExtended;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReplenishPettyCashModal({
  wsId,
  firmId,
  register,
  open,
  onClose,
  onSuccess,
}: ReplenishPettyCashModalProps) {
  const [form] = Form.useForm();
  const [isPending, startTransition] = useTransition();

  function handleOk() {
    form.validateFields().then((values) => {
      const dto = {
        sourceAccountId: values.sourceAccountId,
        sourceCashRegisterId: values.sourceCashRegisterId,
        amountPaise: Math.round((values.amountRupees ?? 0) * 100),
        narration: values.narration,
      };
      startTransition(async () => {
        try {
          const result = await replenishPettyCash(wsId, firmId, register._id, dto);
          message.success(`Petty cash replenished. JV: ${result.jv?.voucherNumber ?? 'created'}`);
          form.resetFields();
          onSuccess();
        } catch (e: any) {
          message.error(e?.message ?? 'Failed to replenish petty cash');
        }
      });
    });
  }

  return (
    <Modal
      title={`Replenish - ${register.name}`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Replenish"
      confirmLoading={isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="Source Account"
          name="sourceAccountId"
          rules={[{ required: true, message: 'Select source account' }]}
        >
          <Select placeholder="Select bank or main cash account" />
        </Form.Item>

        <Form.Item
          label="Amount (₹)"
          name="amountRupees"
          rules={[
            { required: true, message: 'Enter amount' },
            { type: 'number', min: 0.01, message: 'Amount must be positive' },
          ]}
        >
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            precision={2}
            prefix="₹"
            placeholder="0.00"
          />
        </Form.Item>

        <Form.Item
          label="Narration"
          name="narration"
          rules={[
            { required: true, message: 'Narration is required' },
            { min: 5, message: 'Narration must be at least 5 characters' },
          ]}
        >
          <Input placeholder="e.g. Monthly top-up (min 5 chars)" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
