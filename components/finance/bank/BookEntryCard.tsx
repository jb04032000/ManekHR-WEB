'use client';

import React from 'react';
import { Typography, Tag, Checkbox } from 'antd';
import dayjs from 'dayjs';
import type { BankReconciliationCandidate } from '@/types';

const { Text } = Typography;

// Matches existing SOURCE_TYPE_COLORS patterns in the project
const SOURCE_TYPE_COLORS: Record<string, string> = {
  payment_in: 'var(--cr-success)',
  payment_out: 'var(--cr-error)',
  expense: 'var(--cr-warning)',
  journal: 'var(--cr-text-3)',
  bank_reconciliation_new: 'var(--cr-info)',
  contra: 'purple',
  sales_invoice: 'cyan',
  purchase_invoice: 'orange',
  credit_note: 'red',
  debit_note: 'volcano',
  salary: 'geekblue',
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  payment_in: 'Payment In',
  payment_out: 'Payment Out',
  expense: 'Expense',
  journal: 'Journal',
  bank_reconciliation_new: 'Created',
  contra: 'Contra',
  sales_invoice: 'Sales',
  purchase_invoice: 'Purchase',
  credit_note: 'Credit Note',
  debit_note: 'Debit Note',
  salary: 'Salary',
};

interface BookEntryCardProps {
  entry: BankReconciliationCandidate;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
}

export default function BookEntryCard({ entry, isSelected, onSelect }: BookEntryCardProps) {
  const bankLineNetPaise = entry.bankLineNetPaise;
  const isDebit = bankLineNetPaise < 0;
  const absAmount = Math.abs(bankLineNetPaise) / 100;

  const tagColor = SOURCE_TYPE_COLORS[entry.entryType] ?? 'default';
  const tagLabel = ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType;

  // For bank_reconciliation_new, use var(--cr-info) directly
  const tagStyle =
    entry.entryType === 'bank_reconciliation_new'
      ? { background: 'var(--cr-info)', color: '#fff', borderColor: 'transparent' }
      : tagColor.startsWith('var(')
        ? { background: tagColor, color: '#fff', borderColor: 'transparent' }
        : undefined;

  return (
    <div
      style={{
        borderRadius: 'var(--cr-radius-md)',
        border: `1px solid ${isSelected ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
        padding: 12,
        marginBottom: 8,
        background: isSelected ? 'var(--cr-primary-light)' : 'var(--cr-surface)',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
        cursor: 'pointer',
      }}
      onClick={() => onSelect(!isSelected)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(!isSelected)}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cr-primary-border)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--cr-shadow-sm)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cr-border)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
        }
      }}
    >
      {/* Top row: Date | Amount */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 14, color: 'var(--cr-text-3)' }}>
          {dayjs(entry.entryDate).format('DD MMM')}
        </Text>
        {isDebit ? (
          <Text
            type="danger"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}
          >
            ₹{absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Dr
          </Text>
        ) : (
          <Text
            type="success"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}
          >
            ₹{absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} Cr
          </Text>
        )}
      </div>

      {/* Voucher # | Entry Type Tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Text code style={{ fontSize: 12 }}>
          {entry.sourceVoucherNumber || '-'}
        </Text>
        <Tag style={tagStyle} color={!tagStyle ? tagColor : undefined}>
          {tagLabel}
        </Tag>
      </div>

      {/* Narration / Particulars */}
      <Text
        style={{
          fontSize: 14,
          color: 'var(--cr-text-2)',
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 8,
        }}
      >
        {entry.narration}
      </Text>

      {/* Bottom row: Cleared badge + Checkbox */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Cleared badge could be added here if the entry has a clearedInReconciliation flag */}
        </div>
        <Checkbox checked={isSelected} onChange={(e) => onSelect(e.target.checked)} />
      </div>
    </div>
  );
}
