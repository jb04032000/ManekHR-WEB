'use client';

import React from 'react';
import { Popover, Button, Typography } from 'antd';
import dayjs from 'dayjs';
import type { BankStatementRow, BankReconciliationCandidate } from '@/types';

const { Text } = Typography;

function getConfidenceColor(confidence: number): string {
  if (confidence >= 90) return 'var(--cr-success)';
  if (confidence >= 70) return 'var(--cr-warning)';
  return 'var(--cr-error)';
}

interface MatchSuggestionsPanelProps {
  row: BankStatementRow;
  candidates: BankReconciliationCandidate[];
  onMatch: (entryId: string) => void;
}

interface PopoverContentProps {
  row: BankStatementRow;
  candidates: BankReconciliationCandidate[];
  onMatch: (entryId: string) => void;
}

function PopoverContent({ row, candidates, onMatch }: PopoverContentProps) {
  const isDebit = row.debitPaise > 0;
  const absAmount = (isDebit ? row.debitPaise : row.creditPaise) / 100;
  const topCandidates = candidates.slice(0, 3);

  return (
    <div style={{ width: 360 }}>
      <Text strong style={{ display: 'block', marginBottom: 12, color: 'var(--cr-text)' }}>
        Top matches for ₹{absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
        {isDebit ? 'Dr' : 'Cr'} - {dayjs(row.txnDate).format('DD MMM')}
      </Text>
      {topCandidates.length === 0 ? (
        <Text type="secondary">No candidates found</Text>
      ) : (
        topCandidates.map((candidate) => {
          const confidence =
            row.topSuggestions?.find((s) => s.ledgerEntryId === candidate._id)?.confidence ?? 0;
          const confidenceColor = getConfidenceColor(confidence);
          const absEntryAmount = Math.abs(candidate.bankLineNetPaise) / 100;

          return (
            <div
              key={candidate._id}
              style={{
                padding: '10px 0',
                borderBottom: '1px solid var(--cr-border)',
                marginBottom: 8,
              }}
            >
              {/* Voucher info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <div>
                  <Text code style={{ fontSize: 12 }}>
                    {candidate.sourceVoucherNumber}
                  </Text>
                  <Text style={{ fontSize: 12, color: 'var(--cr-text-3)', marginLeft: 8 }}>
                    {candidate.entryType}
                  </Text>
                </div>
                <div>
                  <Text style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>
                    {dayjs(candidate.entryDate).format('DD MMM')}
                  </Text>
                  <Text strong style={{ fontSize: 12, marginLeft: 8 }}>
                    ₹{absEntryAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </Text>
                </div>
              </div>

              {/* Confidence bar */}
              {confidence > 0 && (
                <div style={{ marginBottom: 6 }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}
                  >
                    <Text style={{ fontSize: 11, color: 'var(--cr-text-3)' }}>
                      Match confidence
                    </Text>
                    <span
                      aria-label={`Match confidence: ${confidence} percent`}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: confidenceColor,
                      }}
                    >
                      {confidence}%
                    </span>
                  </div>
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
                      }}
                    />
                  </div>
                </div>
              )}

              <Button size="small" onClick={() => onMatch(candidate._id)}>
                Match this
              </Button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function MatchSuggestionsPanel({
  row,
  candidates,
  onMatch,
}: MatchSuggestionsPanelProps) {
  const count = candidates.length;
  if (count === 0) return null;

  return (
    <Popover
      content={<PopoverContent row={row} candidates={candidates} onMatch={onMatch} />}
      trigger="click"
      placement="rightTop"
    >
      <Button type="link" size="small" style={{ padding: 0, fontSize: 12 }}>
        See all {count}
      </Button>
    </Popover>
  );
}
