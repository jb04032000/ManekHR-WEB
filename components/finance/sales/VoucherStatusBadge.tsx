'use client';
import { Tag } from 'antd';
import type { VoucherState, PaymentStatus, EInvoiceStatus } from '@/types';

type StatusKey = VoucherState | PaymentStatus | 'unpaid';

const STATE_COLORS: Record<
  StatusKey,
  { bg: string; text: string; label: string; strikethrough?: boolean }
> = {
  draft: { bg: 'var(--cr-border-light)', text: 'var(--cr-text-5)', label: 'Draft' },
  pending_approval: {
    bg: 'var(--cr-warning-50)',
    text: 'var(--cr-warning-700)',
    label: 'Pending Approval',
  },
  posted: { bg: 'var(--cr-primary-light)', text: 'var(--cr-primary)', label: 'Posted' },
  partial: { bg: 'var(--cr-warning-50)', text: 'var(--cr-warning-700)', label: 'Partial' },
  paid: { bg: 'var(--cr-success-50)', text: 'var(--cr-success-700)', label: 'Paid' },
  overdue: { bg: 'var(--cr-danger-50)', text: 'var(--cr-danger-700)', label: 'Overdue' },
  cancelled: {
    bg: 'var(--cr-bg)',
    text: 'var(--cr-neutral-400)',
    label: 'Cancelled',
    strikethrough: true,
  },
  void: { bg: 'var(--cr-bg)', text: 'var(--cr-neutral-300)', label: 'Void' },
  unpaid: { bg: 'var(--cr-border-light)', text: 'var(--cr-text-5)', label: 'Unpaid' },
};

export function VoucherStatusBadge({ state }: { state: StatusKey }) {
  const meta = STATE_COLORS[state] ?? {
    bg: 'var(--cr-border-light)',
    text: 'var(--cr-text-5)',
    label: String(state),
  };
  return (
    <Tag
      style={{
        backgroundColor: meta.bg,
        color: meta.text,
        border: 'none',
        textDecoration: meta.strikethrough ? 'line-through' : 'none',
        fontWeight: 700,
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 6,
      }}
    >
      {meta.label}
    </Tag>
  );
}

const EINVOICE_COLORS = {
  generated: { bg: 'var(--cr-success-50)', text: 'var(--cr-success-700)' },
  pending: { bg: 'var(--cr-warning-50)', text: 'var(--cr-warning-700)' },
  not_applicable: { bg: 'var(--cr-border-light)', text: 'var(--cr-neutral-400)' },
  failed: { bg: 'var(--cr-danger-50)', text: 'var(--cr-danger-700)' },
} as const;

export function EInvoiceBadge({ status, irn }: { status: EInvoiceStatus; irn?: string }) {
  const palette = EINVOICE_COLORS[status] ?? EINVOICE_COLORS.not_applicable;
  const label =
    status === 'generated'
      ? irn
        ? irn.slice(0, 8) + '…'
        : 'IRN OK'
      : status === 'pending'
        ? 'Pending'
        : status === 'failed'
          ? 'Failed'
          : 'N/A';
  return (
    <Tag
      style={{
        backgroundColor: palette.bg,
        color: palette.text,
        border: 'none',
        fontWeight: 700,
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 6,
      }}
    >
      {label}
    </Tag>
  );
}
