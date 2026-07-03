'use client';

import React from 'react';
import { Button, Typography, Checkbox } from 'antd';
import { LinkOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { BankStatementRow, BankReconciliationCandidate } from '@/types';

const { Text } = Typography;

interface BankStatementRowCardProps {
  row: BankStatementRow;
  isSelected: boolean;
  suggestionEntry?: BankReconciliationCandidate;
  onConfirmSuggestion: () => void;
  onLink: () => void;
  onCreate: () => void;
  onExclude: () => void;
  onSelect: (selected: boolean) => void;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'var(--cr-success)';
  if (confidence >= 70) return 'var(--cr-warning)';
  return 'var(--cr-error)';
}

function getCardBorderColor(row: BankStatementRow): string {
  if (row.matchConfidence != null) {
    if (row.matchConfidence >= 90) return 'rgba(34, 197, 94, 0.4)'; // var(--cr-success) 40%
    if (row.matchConfidence >= 70) return 'rgba(245, 158, 11, 0.4)'; // var(--cr-warning) 40%
  }
  if (row.status === 'excluded' || row.status === 'disputed') {
    return row.status === 'disputed' ? 'rgba(239, 68, 68, 0.3)' : 'var(--cr-border)';
  }
  return 'var(--cr-border)';
}

function getCardBackground(row: BankStatementRow, isSelected: boolean): string {
  if (isSelected) return 'var(--cr-primary-light)';
  if (row.status === 'excluded') return 'var(--cr-surface-2)';
  if (row.status === 'disputed') return 'rgba(239, 68, 68, 0.05)';
  return 'var(--cr-surface)';
}

export default function BankStatementRowCard({
  row,
  isSelected,
  suggestionEntry,
  onConfirmSuggestion,
  onLink,
  onCreate,
  onExclude,
  onSelect,
}: BankStatementRowCardProps) {
  const isDebit = row.debitPaise > 0;
  const absAmount = (isDebit ? row.debitPaise : row.creditPaise) / 100;
  const amountLabel = isDebit ? 'Dr' : 'Cr';
  const confidence = row.matchConfidence ?? 0;
  const hasSuggestion = confidence >= 70 && suggestionEntry;
  const confidenceColor = getConfidenceColor(confidence);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${isDebit ? 'Debit' : 'Credit'}: ${absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} rupees`}
      onClick={() => onSelect(!isSelected)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(!isSelected)}
      style={{
        borderRadius: 'var(--cr-radius-md)',
        border: `1px solid ${isSelected ? 'var(--cr-primary)' : getCardBorderColor(row)}`,
        padding: 12,
        marginBottom: 8,
        background: getCardBackground(row, isSelected),
        cursor: 'pointer',
        transition: 'border-color 0.18s ease, box-shadow 0.18s ease',
        outline: 'none',
        borderStyle: row.status === 'excluded' ? 'dashed' : 'solid',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--cr-primary-border)';
          (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--cr-shadow-sm)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = getCardBorderColor(row);
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
          {dayjs(row.txnDate).format('DD MMM')}
        </Text>
        {isDebit ? (
          <Text
            type="danger"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}
          >
            ₹{absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {amountLabel}
          </Text>
        ) : (
          <Text
            type="success"
            style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}
          >
            ₹{absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })} {amountLabel}
          </Text>
        )}
      </div>

      {/* Narration */}
      <div style={{ marginBottom: 4 }}>
        <Text
          style={{
            fontSize: 14,
            color: 'var(--cr-text-2)',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.narration}
        </Text>
        {row.refNumber && (
          <Text code style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>
            {row.refNumber}
          </Text>
        )}
      </div>

      {/* Confidence bar (if suggestion >= 70%) */}
      {hasSuggestion && (
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
              Suggested: {suggestionEntry.sourceVoucherNumber}
            </Text>
            <span
              aria-label={`Match confidence: ${confidence} percent`}
              style={{
                display: 'inline-block',
                padding: '1px 8px',
                borderRadius: 'var(--cr-radius-full)',
                background: confidenceColor,
                color: '#fff',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {confidence}%
            </span>
          </div>
          {/* Confidence bar */}
          <div
            style={{
              height: 6,
              width: '100%',
              borderRadius: 'var(--cr-radius-full)',
              background: 'var(--cr-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(confidence, 100)}%`,
                background: confidenceColor,
                borderRadius: 'var(--cr-radius-full)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* Action row */}
      <div
        style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Confirm N% - only if confidence >= 70 */}
        {hasSuggestion && (
          <Button
            type="primary"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmSuggestion();
            }}
          >
            Confirm {confidence}%
          </Button>
        )}
        <Button
          size="small"
          icon={<LinkOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onLink();
          }}
        >
          Link
        </Button>
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onCreate();
          }}
        >
          Create Entry
        </Button>
        <Button
          type="link"
          danger
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onExclude();
          }}
        >
          Exclude
        </Button>
      </div>
    </div>
  );
}
