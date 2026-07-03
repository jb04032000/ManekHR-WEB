'use client';

import { useState, useTransition } from 'react';
import { Modal, Table, InputNumber, Typography, Space, Alert, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { CashRegisterExtended, DenominationCount } from '@/types';
import { dayEndTally } from '@/lib/actions/finance-cash-registers.actions';

const { Text } = Typography;

const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

interface DenomRow {
  denomination: number;
  count: number;
  value: number; // denomination × count
}

interface DayEndTallyModalProps {
  wsId: string;
  firmId: string;
  register: CashRegisterExtended;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DayEndTallyModal({
  wsId,
  firmId,
  register,
  open,
  onClose,
  onSuccess,
}: DayEndTallyModalProps) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<DenomRow[]>(
    DENOMINATIONS.map((d) => ({ denomination: d, count: 0, value: 0 })),
  );

  function updateCount(denomination: number, count: number) {
    setRows((prev) =>
      prev.map((r) =>
        r.denomination === denomination ? { ...r, count, value: denomination * count } : r,
      ),
    );
  }

  const physicalTotalRupees = rows.reduce((s, r) => s + r.value, 0);
  const systemBalanceRupees = register.currentBalance ?? 0;
  const varianceRupees = physicalTotalRupees - systemBalanceRupees;

  const formatRs = (rupees: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(rupees);

  function handleOk() {
    const breakdown: DenominationCount[] = rows
      .filter((r) => r.count > 0)
      .map((r) => ({ denomination: r.denomination, count: r.count }));

    startTransition(async () => {
      try {
        const result = await dayEndTally(wsId, firmId, register._id, {
          denominationBreakdown: breakdown,
          narration: `Day-end tally for ${register.name}`,
        });
        const jvNum = result.varianceJv?.voucherNumber;
        if (jvNum) {
          message.success(`Tally posted. Variance JV: ${jvNum}`);
        } else {
          message.success('Tally posted - no variance');
        }
        onSuccess();
      } catch (e: any) {
        message.error(e?.message ?? 'Failed to post tally');
      }
    });
  }

  const columns: ColumnsType<DenomRow> = [
    {
      title: 'Denomination',
      dataIndex: 'denomination',
      render: (v) => <Text>₹{v}</Text>,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      render: (val, record) => (
        <InputNumber
          size="small"
          min={0}
          value={val}
          onChange={(v) => updateCount(record.denomination, v ?? 0)}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: 'Value (₹)',
      dataIndex: 'value',
      align: 'right',
      render: (v) => <Text>{v.toLocaleString('en-IN')}</Text>,
    },
  ];

  return (
    <Modal
      title={`Day-End Tally - ${register.name}`}
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="Post Tally"
      confirmLoading={isPending}
      width={480}
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary">System Balance: </Text>
        <Text strong>{formatRs(systemBalanceRupees)}</Text>
      </div>

      <Table
        dataSource={rows}
        columns={columns}
        rowKey="denomination"
        pagination={false}
        size="small"
        style={{ marginBottom: 12 }}
      />

      <Space direction="vertical" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text>Physical Total:</Text>
          <Text strong>{formatRs(physicalTotalRupees)}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text>System Balance:</Text>
          <Text>{formatRs(systemBalanceRupees)}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text>Variance:</Text>
          <Text
            strong
            style={{
              color:
                varianceRupees === 0
                  ? 'var(--cr-success-500)'
                  : varianceRupees > 0
                    ? 'var(--cr-info-500)'
                    : 'var(--cr-danger-500)',
            }}
          >
            {varianceRupees >= 0 ? '+' : ''}
            {formatRs(varianceRupees)}
            {varianceRupees > 0 && ' (Surplus)'}
            {varianceRupees < 0 && ' (Shortage)'}
          </Text>
        </div>
      </Space>

      {varianceRupees !== 0 && (
        <Alert
          type={varianceRupees < 0 ? 'error' : 'warning'}
          style={{ marginTop: 12 }}
          title={`${varianceRupees < 0 ? 'Shortage' : 'Surplus'} of ${formatRs(Math.abs(varianceRupees))} will be posted as a variance JV`}
          showIcon
        />
      )}
    </Modal>
  );
}
