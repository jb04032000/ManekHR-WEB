'use client';
import Link from 'next/link';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';

const DRILL_URLS: Record<string, (firmId: string, id: string) => string> = {
  sale_invoice: (fId, id) => `/dashboard/finance/firms/${fId}/sales/invoices/${id}`,
  purchase_bill: (fId, id) => `/dashboard/finance/firms/${fId}/purchases/bills/${id}`,
  payment_in: (fId, id) => `/dashboard/finance/firms/${fId}/payments/received/${id}`,
  payment_out: (fId, id) => `/dashboard/finance/firms/${fId}/payments/made/${id}`,
  expense: (fId, id) => `/dashboard/finance/firms/${fId}/expenses/${id}`,
  journal: (fId, id) => `/dashboard/finance/firms/${fId}/journal-vouchers/${id}`,
  credit_note: (fId, id) => `/dashboard/finance/firms/${fId}/returns/credit-notes/${id}`,
  debit_note: (fId, id) => `/dashboard/finance/firms/${fId}/returns/debit-notes/${id}`,
  bank_reconciliation_new: (fId, id) =>
    `/dashboard/finance/firms/${fId}/bank-accounts/${id}/reconcile`,
  manufacturing_voucher: (fId, id) =>
    `/dashboard/finance/firms/${fId}/manufacturing/vouchers/${id}`,
};

interface DrillLinkProps {
  firmId: string;
  sourceVoucherId: string;
  sourceVoucherType: string;
  label: string;
}

export function DrillLink({ firmId, sourceVoucherId, sourceVoucherType, label }: DrillLinkProps) {
  const builder = DRILL_URLS[sourceVoucherType];
  if (!builder || !sourceVoucherId) return <span>{label}</span>;
  const href = builder(firmId, sourceVoucherId);
  return (
    <Tooltip title="View voucher">
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open ${sourceVoucherType} ${label} in new tab`}
        style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
      >
        {label} <ArrowRightOutlined style={{ fontSize: 10 }} />
      </Link>
    </Tooltip>
  );
}
