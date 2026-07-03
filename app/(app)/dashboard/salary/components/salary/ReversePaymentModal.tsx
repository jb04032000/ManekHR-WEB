'use client';

import { Modal, Form, Input, Button } from 'antd';
import type { FormInstance } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import type { LedgerTransaction } from '../../types/salary-page.types';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

interface ReversePaymentModalProps {
  open: boolean;
  transaction: LedgerTransaction | null;
  form: FormInstance;
  loading: boolean;
  onCancel: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (vals: any) => void;
}

export function ReversePaymentModal({
  open,
  transaction,
  form,
  loading,
  onCancel,
  onSubmit,
}: ReversePaymentModalProps) {
  const currencyFmt = useCurrencyFormatter();
  const formatCurrencyFull = currencyFmt.full;

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={
        <div className="flex items-center gap-2">
          <ExclamationCircleOutlined style={{ color: 'var(--cr-danger-700)', fontSize: 18 }} />
          <span className="font-display">Reverse Payment</span>
        </div>
      }
      footer={null}
      width={480}
      forceRender
      zIndex={1060}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        {transaction && (
          <>
            <div
              className="mb-4 rounded-[10px] p-3"
              style={{ background: 'var(--cr-danger-50)', border: '1px solid var(--cr-danger-50)' }}
            >
              <p
                className="m-0 text-[13px] font-semibold"
                style={{ color: 'var(--cr-danger-700)' }}
              >
                This will reverse the payment of {formatCurrencyFull(transaction.amount)}
              </p>
              <p className="m-0 mt-1 text-[12px] text-subtle">
                Any commission or excess additions auto-created with this payment will also be
                reversed. This action cannot be undone.
              </p>
            </div>

            <Form.Item
              name="reversalReason"
              label="Reason for reversal"
              rules={[{ required: true, message: 'Please provide a reason' }]}
            >
              <Input.TextArea
                rows={3}
                placeholder="Why is this payment being reversed?"
                maxLength={500}
              />
            </Form.Item>
            <div className="flex justify-end gap-2">
              <Button onClick={onCancel}>Cancel</Button>
              <Button type="primary" danger htmlType="submit" loading={loading}>
                Confirm Reversal
              </Button>
            </div>
          </>
        )}
      </Form>
    </Modal>
  );
}
