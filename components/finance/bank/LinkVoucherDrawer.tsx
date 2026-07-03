'use client';

import React, { useEffect, useState, useCallback, startTransition } from 'react';
import { Drawer, Input, Button, Spin, Alert, Space, Typography } from 'antd';
import DatePicker from 'antd/lib/date-picker';
import dayjs, { Dayjs } from 'dayjs';
import type { BankStatementRow, BankReconciliationCandidate } from '@/types';
import { financeBankReconciliationApi } from '@/lib/api/modules/finance-bank-reconciliation.api';
import BookEntryCard from './BookEntryCard';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface LinkVoucherDrawerProps {
  open: boolean;
  row: BankStatementRow;
  wsId: string;
  firmId: string;
  bankAccountId: string;
  sessionId: string;
  onClose: () => void;
  onLinked: () => void;
}

export default function LinkVoucherDrawer({
  open,
  row,
  wsId,
  firmId,
  bankAccountId,
  sessionId,
  onClose,
  onLinked,
}: LinkVoucherDrawerProps) {
  const [candidates, setCandidates] = useState<BankReconciliationCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    dayjs(row.txnDate).subtract(7, 'day'),
    dayjs(row.txnDate).add(7, 'day'),
  ]);

  const loadCandidates = useCallback(async () => {
    if (!wsId || !firmId) return;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const data = await financeBankReconciliationApi.candidates(
        wsId,
        firmId,
        bankAccountId,
        sessionId,
        row._id,
      );
      startTransition(() => {
        setCandidates(data);
      });
    } catch {
      startTransition(() => {
        setError('Failed to load candidates. Please try again.');
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [wsId, firmId, bankAccountId, sessionId, row._id]);

  useEffect(() => {
    if (open) {
      loadCandidates();
      startTransition(() => {
        setSearchText('');
        setDateRange([dayjs(row.txnDate).subtract(7, 'day'), dayjs(row.txnDate).add(7, 'day')]);
      });
    }
  }, [open, loadCandidates, row.txnDate]);

  const handleSelect = async (entryId: string) => {
    setLinking(true);
    setError(null);
    try {
      await financeBankReconciliationApi.manualMatch(
        wsId,
        firmId,
        bankAccountId,
        sessionId,
        row._id,
        [entryId],
      );
      onLinked();
      onClose();
    } catch {
      setError('Failed to link voucher. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  // Filter candidates by search text
  const filteredCandidates = candidates.filter((c) => {
    if (!searchText) return true;
    const q = searchText.toLowerCase();
    return (
      c.sourceVoucherNumber?.toLowerCase().includes(q) || c.narration?.toLowerCase().includes(q)
    );
  });

  const isDebit = row.debitPaise > 0;
  const absAmount = (isDebit ? row.debitPaise : row.creditPaise) / 100;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Link to Voucher"
      placement="right"
      styles={{ wrapper: { width: 480 } }}
      destroyOnHidden
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            background: 'var(--cr-surface-2)',
            borderRadius: 'var(--cr-radius-md)',
            padding: '8px 12px',
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 13 }}>
            <strong>
              {dayjs(row.txnDate).format('DD MMM YYYY')} - ₹
              {absAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}{' '}
              {isDebit ? 'Dr' : 'Cr'}
            </strong>
          </Text>
          <Text
            type="secondary"
            style={{
              display: 'block',
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.narration}
          </Text>
        </div>

        {/* Filter bar */}
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <Input.Search
            placeholder="Search voucher # or narration"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            size="small"
            allowClear
          />
          <RangePicker
            size="small"
            style={{ width: '100%' }}
            value={dateRange}
            onChange={(val) => setDateRange((val as [Dayjs | null, Dayjs | null]) ?? [null, null])}
            format="DD MMM YYYY"
          />
        </Space>
      </div>

      {error && <Alert type="error" title={error} style={{ marginBottom: 12 }} />}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <Spin />
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: 'var(--cr-text-3)' }}>
          <Text type="secondary">No uncleared entries</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
            All ledger entries for this bank account are already cleared or no entries exist in this
            date range.
          </Text>
        </div>
      ) : (
        <div>
          {filteredCandidates.map((candidate) => (
            <div key={candidate._id} style={{ position: 'relative' }}>
              <BookEntryCard entry={candidate} isSelected={false} onSelect={() => {}} />
              <Button
                size="small"
                type="primary"
                loading={linking}
                onClick={() => handleSelect(candidate._id)}
                style={{ position: 'absolute', top: 12, right: 12 }}
              >
                Select
              </Button>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
