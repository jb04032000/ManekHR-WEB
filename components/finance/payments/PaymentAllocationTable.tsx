'use client';
import React, { useState } from 'react';
import { InputNumber, Typography, Space } from 'antd';
import DsButton from '@/components/ui/DsButton';
import DsTable from '@/components/ui/DsTable';
import { planFifoAllocation, planSettleInFull } from '@/lib/finance/payment-allocation';
import type { OutstandingInvoice } from '@/types';

export interface AllocationRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDuePaise: number;
  allocatedPaise: number;
}

interface Props {
  outstandingInvoices: OutstandingInvoice[];
  /** The payment amount entered on the form, in paise - drives auto-allocate. */
  paymentTotalPaise: number;
  onAllocationsChange: (allocs: AllocationRow[]) => void;
  /** Settle-in-full asks the form to set the payment amount to the sum of dues. */
  onRequestTotal?: (paise: number) => void;
}

export default function PaymentAllocationTable({
  outstandingInvoices,
  paymentTotalPaise,
  onAllocationsChange,
  onRequestTotal,
}: Props) {
  const [amounts, setAmounts] = useState<Record<string, number>>({});

  const formatRupees = (paise: number) =>
    `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const emitAllocations = (next: Record<string, number>) => {
    const allocs: AllocationRow[] = outstandingInvoices
      .filter((inv) => (next[inv._id] ?? 0) > 0)
      .map((inv) => ({
        invoiceId: inv._id,
        invoiceNumber: inv.voucherNumber,
        invoiceDuePaise: inv.amountDuePaise,
        allocatedPaise: Math.round((next[inv._id] ?? 0) * 100),
      }));
    onAllocationsChange(allocs);
  };

  const handleChange = (invoiceId: string, value: number | null) => {
    const next = { ...amounts, [invoiceId]: value ?? 0 };
    setAmounts(next);
    emitAllocations(next);
  };

  /** Apply a paise-keyed allocation plan to the table inputs + bubble it up. */
  const applyPlan = (plan: { id: string; allocatedPaise: number }[]) => {
    const byId = new Map(plan.map((p) => [p.id, p.allocatedPaise]));
    const next: Record<string, number> = {};
    for (const inv of outstandingInvoices) {
      const paise = byId.get(inv._id) ?? 0;
      if (paise > 0) next[inv._id] = paise / 100;
    }
    setAmounts(next);
    emitAllocations(next);
  };

  const dues = () =>
    outstandingInvoices.map((inv) => ({
      id: inv._id,
      amountDuePaise: inv.amountDuePaise,
      dueDate: (inv as { dueDate?: string }).dueDate,
    }));

  const handleAutoAllocate = () => applyPlan(planFifoAllocation(dues(), paymentTotalPaise));

  const handleSettleInFull = () => {
    const { allocations, totalPaise } = planSettleInFull(dues());
    applyPlan(allocations);
    onRequestTotal?.(totalPaise);
  };

  const handleClear = () => {
    setAmounts({});
    onAllocationsChange([]);
  };

  const totalAllocated = Object.values(amounts).reduce((s, v) => s + (v ?? 0), 0);

  const columns = [
    { title: 'Invoice #', dataIndex: 'voucherNumber', key: 'voucherNumber' },
    {
      title: 'Due Date',
      dataIndex: 'dueDate',
      key: 'dueDate',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
    },
    {
      title: 'Outstanding',
      dataIndex: 'amountDuePaise',
      key: 'amountDuePaise',
      align: 'right' as const,
      render: (v: number) => formatRupees(v),
    },
    {
      title: 'Allocate (₹)',
      key: 'allocate',
      render: (_: unknown, inv: OutstandingInvoice) => (
        <InputNumber
          min={0}
          max={inv.amountDuePaise / 100}
          precision={2}
          value={amounts[inv._id]}
          onChange={(v) => handleChange(inv._id, v)}
          style={{ width: 140 }}
          status={(amounts[inv._id] ?? 0) * 100 > inv.amountDuePaise ? 'error' : undefined}
        />
      ),
    },
  ];

  const hasInvoices = outstandingInvoices.length > 0;

  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      {hasInvoices && (
        <Space wrap>
          <DsButton
            dsVariant="secondary"
            dsSize="sm"
            onClick={handleAutoAllocate}
            disabled={paymentTotalPaise <= 0}
            title={
              paymentTotalPaise <= 0
                ? 'Enter the payment amount first'
                : 'Apply the payment amount to the oldest invoices first'
            }
          >
            Auto-allocate
          </DsButton>
          <DsButton dsVariant="neutral" dsSize="sm" onClick={handleSettleInFull}>
            Settle all in full
          </DsButton>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={handleClear}>
            Clear
          </DsButton>
        </Space>
      )}
      <DsTable
        dataSource={outstandingInvoices}
        rowKey="_id"
        columns={columns}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No outstanding invoices for this party.' }}
      />
      <Typography.Text strong>
        Total Allocated: {formatRupees(totalAllocated * 100)}
      </Typography.Text>
    </Space>
  );
}
