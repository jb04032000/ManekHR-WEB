'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { InputNumber, Typography, Checkbox, Spin, Space } from 'antd';
import { useTranslations } from 'next-intl';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { listPurchaseBills } from '@/lib/actions/finance-purchases.actions';
import { planFifoAllocation, planSettleInFull } from '@/lib/finance/payment-allocation';
import type { PurchaseBill, PaymentOutBillAllocation } from '@/types';

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

interface Props {
  partyId: string;
  firmId: string;
  wsId: string;
  allocations: PaymentOutBillAllocation[];
  onChange: (next: PaymentOutBillAllocation[]) => void;
  totalAmountPaise: number;
  /** Settle-in-full asks the form to set the payment amount to the sum of dues. */
  onRequestTotal?: (paise: number) => void;
}

export default function PaymentOutBillAllocationTable({
  partyId,
  firmId,
  wsId,
  allocations,
  onChange,
  totalAmountPaise,
  onRequestTotal,
}: Props) {
  const t = useTranslations('finance.purchases');
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!partyId || !wsId || !firmId) return;
    startTransition(() => {
      setLoading(true);
    });
    listPurchaseBills(wsId, firmId, { partyId, paymentStatus: ['unpaid', 'partial', 'overdue'] })
      .then((data) => setBills(Array.isArray(data) ? data : []))
      .catch(() => setBills([]))
      .finally(() => setLoading(false));
  }, [partyId, wsId, firmId]);

  const alloc = (billId: string): PaymentOutBillAllocation | undefined =>
    allocations.find((a) => a.billId === billId);

  const allocatedSum = allocations.reduce((s, a) => s + a.allocatedPaise, 0);
  const unapplied = totalAmountPaise - allocatedSum;

  const toggle = (bill: PurchaseBill, checked: boolean) => {
    if (!checked) {
      onChange(allocations.filter((a) => a.billId !== bill._id));
    } else {
      const remaining =
        totalAmountPaise -
        allocations.filter((a) => a.billId !== bill._id).reduce((s, a) => s + a.allocatedPaise, 0);
      const toAllocate = Math.min(remaining, bill.amountDuePaise);
      onChange([
        ...allocations.filter((a) => a.billId !== bill._id),
        {
          billId: bill._id,
          billNumber: bill.voucherNumber ?? bill.vendorBillNumber ?? bill._id,
          billDuePaise: bill.amountDuePaise,
          allocatedPaise: toAllocate,
          runningDuePaise: bill.amountDuePaise - toAllocate,
        },
      ]);
    }
  };

  const setAlloc = (bill: PurchaseBill, rupees: number) => {
    const paise = Math.round(rupees * 100);
    onChange(
      allocations.map((a) =>
        a.billId === bill._id
          ? { ...a, allocatedPaise: paise, runningDuePaise: a.billDuePaise - paise }
          : a,
      ),
    );
  };

  const dues = () =>
    bills.map((b) => ({ id: b._id, amountDuePaise: b.amountDuePaise, dueDate: b.voucherDate }));

  const buildAllocations = (
    plan: { id: string; allocatedPaise: number }[],
  ): PaymentOutBillAllocation[] => {
    const byId = new Map(plan.map((p) => [p.id, p.allocatedPaise]));
    return bills
      .filter((b) => (byId.get(b._id) ?? 0) > 0)
      .map((b) => {
        const allocatedPaise = byId.get(b._id) ?? 0;
        return {
          billId: b._id,
          billNumber: b.voucherNumber ?? b.vendorBillNumber ?? b._id,
          billDuePaise: b.amountDuePaise,
          allocatedPaise,
          runningDuePaise: b.amountDuePaise - allocatedPaise,
        };
      });
  };

  const handleAutoAllocate = () =>
    onChange(buildAllocations(planFifoAllocation(dues(), totalAmountPaise)));
  const handleSettleInFull = () => {
    const { allocations: plan, totalPaise } = planSettleInFull(dues());
    onChange(buildAllocations(plan));
    onRequestTotal?.(totalPaise);
  };
  const handleClear = () => onChange([]);

  const columns = [
    {
      title: <span className="sr-only">{t('editor.allocation.select')}</span>,
      key: 'select',
      width: 40,
      render: (_: unknown, bill: PurchaseBill) => (
        <Checkbox checked={!!alloc(bill._id)} onChange={(e) => toggle(bill, e.target.checked)} />
      ),
    },
    {
      title: t('editor.allocation.billNumber'),
      key: 'billNum',
      render: (_: unknown, bill: PurchaseBill) =>
        bill.voucherNumber ?? bill.vendorBillNumber ?? '-',
    },
    {
      title: t('editor.allocation.date'),
      dataIndex: 'voucherDate',
      key: 'voucherDate',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
    },
    {
      title: t('editor.allocation.due'),
      key: 'due',
      align: 'right' as const,
      render: (_: unknown, bill: PurchaseBill) => formatPaise(bill.amountDuePaise),
    },
    {
      title: t('editor.allocation.allocate'),
      key: 'allocate',
      align: 'right' as const,
      width: 140,
      render: (_: unknown, bill: PurchaseBill) => {
        const a = alloc(bill._id);
        if (!a) return '-';
        return (
          <InputNumber
            value={a.allocatedPaise / 100}
            min={0}
            max={Math.min(bill.amountDuePaise, totalAmountPaise) / 100}
            precision={2}
            size="small"
            style={{ width: 120 }}
            onChange={(v) => setAlloc(bill, v ?? 0)}
          />
        );
      },
    },
    {
      title: t('editor.allocation.runningDue'),
      key: 'runningDue',
      align: 'right' as const,
      render: (_: unknown, bill: PurchaseBill) => {
        const a = alloc(bill._id);
        if (!a) return formatPaise(bill.amountDuePaise);
        return formatPaise(a.runningDuePaise);
      },
    },
  ];

  if (loading) return <Spin />;

  return (
    <div>
      {bills.length > 0 && (
        <Space wrap style={{ marginBottom: 8 }}>
          <DsButton
            dsVariant="secondary"
            dsSize="sm"
            onClick={handleAutoAllocate}
            disabled={totalAmountPaise <= 0}
            title={
              totalAmountPaise <= 0
                ? t('editor.allocation.enterAmountFirst')
                : t('editor.allocation.autoAllocateTooltip')
            }
          >
            {t('editor.allocation.autoAllocate')}
          </DsButton>
          <DsButton dsVariant="neutral" dsSize="sm" onClick={handleSettleInFull}>
            {t('editor.allocation.settleAllInFull')}
          </DsButton>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={handleClear}>
            {t('editor.allocation.clear')}
          </DsButton>
        </Space>
      )}
      <DsTable dataSource={bills} columns={columns} rowKey="_id" pagination={false} size="small" />
      <div style={{ marginTop: 8, textAlign: 'right' }}>
        <Typography.Text>
          {t('editor.allocation.allocated')}: <strong>{formatPaise(allocatedSum)}</strong> |{' '}
          {unapplied >= 0 ? (
            <Typography.Text type="warning">
              {t('editor.allocation.advanceCredit', { amount: formatPaise(unapplied) })}
            </Typography.Text>
          ) : (
            <Typography.Text type="danger">
              {t('editor.allocation.overAllocatedBy', { amount: formatPaise(Math.abs(unapplied)) })}
            </Typography.Text>
          )}
        </Typography.Text>
      </div>
    </div>
  );
}
