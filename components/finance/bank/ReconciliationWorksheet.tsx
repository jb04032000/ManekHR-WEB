'use client';

import React, { useEffect, useState, useCallback, startTransition } from 'react';
import {
  Alert,
  Button,
  Collapse,
  Modal,
  Popconfirm,
  Progress,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  Input,
  Badge,
} from 'antd';
import DatePicker from 'antd/lib/date-picker';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useRouter } from 'next/navigation';
import type {
  BankStatement,
  BankStatementRow,
  BankReconciliationCandidate,
  ReconciliationSession,
  FinanceBankAccount,
} from '@/types';
import { financeBankReconciliationApi } from '@/lib/api/modules/finance-bank-reconciliation.api';
import BankStatementRowCard from './BankStatementRowCard';
import BookEntryCard from './BookEntryCard';
import MatchSuggestionsPanel from './MatchSuggestionsPanel';
import CreateFromRowModal from './CreateFromRowModal';
import BrsReportModal from './BrsReportModal';
import LinkVoucherDrawer from './LinkVoucherDrawer';

const { Text } = Typography;
const { RangePicker } = DatePicker;
const { Search } = Input;

interface MatchedPair {
  bankRow: BankStatementRow;
  ledgerEntryId: string;
  matchedBy?: string;
  matchType?: string;
}

interface ReconciliationWorksheetProps {
  session: ReconciliationSession;
  statement: BankStatement;
  bankAccount: FinanceBankAccount;
  wsId: string;
  firmId: string;
  bankAccountId: string;
  sessionId: string;
  onSessionUpdated: (s: ReconciliationSession) => void;
}

function formatRupees(paise: number): string {
  const rupees = paise / 100;
  return (
    '₹' + rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export default function ReconciliationWorksheet({
  session: initialSession,
  statement,
  bankAccount,
  wsId,
  firmId,
  bankAccountId,
  sessionId,
  onSessionUpdated,
}: ReconciliationWorksheetProps) {
  const router = useRouter();

  // State
  const [session, setSession] = useState<ReconciliationSession>(initialSession);
  const [rows, setRows] = useState<BankStatementRow[]>([]);
  const [matchedRows, setMatchedRows] = useState<BankStatementRow[]>([]);
  const [candidates, setCandidates] = useState<BankReconciliationCandidate[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [brsModalOpen, setBrsModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalRow, setCreateModalRow] = useState<BankStatementRow | null>(null);
  const [linkDrawerOpen, setLinkDrawerOpen] = useState(false);
  const [linkDrawerRow, setLinkDrawerRow] = useState<BankStatementRow | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [rowStatusFilter, setRowStatusFilter] = useState<string>('unmatched');
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all');
  const [rowSearch, setRowSearch] = useState('');
  const [excludeReason, setExcludeReason] = useState<Record<string, string>>({});

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load rows
  const loadRows = useCallback(async () => {
    if (!wsId || !firmId) return;
    startTransition(() => {
      setRowsLoading(true);
    });
    try {
      const [unmatchedData, allData] = await Promise.all([
        financeBankReconciliationApi.listRows(wsId, firmId, bankAccountId, sessionId, {
          status: 'unmatched',
          limit: 100,
        }),
        financeBankReconciliationApi.listRows(wsId, firmId, bankAccountId, sessionId, {
          status: 'matched',
          limit: 500,
        }),
      ]);
      startTransition(() => {
        setRows(unmatchedData.items);
        setMatchedRows(allData.items);
      });
    } catch {
      message.error('Failed to load rows');
    } finally {
      startTransition(() => {
        setRowsLoading(false);
      });
    }
  }, [wsId, firmId, bankAccountId, sessionId]);

  // Load candidates for a specific row (book entries pane)
  const loadCandidates = useCallback(
    async (rowId?: string) => {
      const targetRowId = rowId ?? rows.find((r) => r.status === 'unmatched')?._id;
      if (!targetRowId || !wsId || !firmId) {
        startTransition(() => {
          setCandidates([]);
        });
        return;
      }
      try {
        const data = await financeBankReconciliationApi.candidates(
          wsId,
          firmId,
          bankAccountId,
          sessionId,
          targetRowId,
        );
        startTransition(() => {
          setCandidates(data);
        });
      } catch {
        startTransition(() => {
          setCandidates([]);
        });
      }
    },
    [wsId, firmId, bankAccountId, sessionId, rows],
  );

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // When rows load, populate candidates for the first unmatched row
  useEffect(() => {
    if (rows.length > 0) {
      loadCandidates();
    }
  }, [rows, loadCandidates]);

  // Session refresh
  const refreshSession = useCallback(async () => {
    try {
      const updated = await financeBankReconciliationApi.getSession(
        wsId,
        firmId,
        bankAccountId,
        sessionId,
      );
      setSession(updated);
      onSessionUpdated(updated);
    } catch {
      // silent
    }
  }, [wsId, firmId, bankAccountId, sessionId, onSessionUpdated]);

  const isLocked = session.status === 'locked' || session.status === 'completed';
  const difference = session.statementClosingBalancePaise - session.bookBalancePaise;
  const isFullyReconciled = difference === 0;

  // Filter rows
  const filteredRows = rows.filter((r) => {
    if (rowStatusFilter !== 'all') {
      if (rowStatusFilter === 'unmatched' && r.status !== 'unmatched') return false;
      if (rowStatusFilter === 'disputed' && r.status !== 'disputed') return false;
    }
    if (rowSearch) {
      const q = rowSearch.toLowerCase();
      if (!r.narration?.toLowerCase().includes(q) && !r.refNumber?.toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  // --- Action Handlers ---

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const summary = await financeBankReconciliationApi.autoMatch(
        wsId,
        firmId,
        bankAccountId,
        sessionId,
      );
      message.success(
        `Auto-match complete: ${summary.autoCleared} auto-cleared, ${summary.suggested} suggested, ${summary.reversalPairs} reversal pairs`,
      );
      await loadRows();
      await refreshSession();
    } catch {
      message.error('Auto-match failed. Try again or match rows manually.');
    } finally {
      setAutoMatching(false);
    }
  };

  const handleConfirmSuggestion = async (row: BankStatementRow) => {
    if (!row.topSuggestions?.length) return;
    const topSuggestion = row.topSuggestions[0];
    try {
      // Optimistic update
      setRows((prev) => prev.filter((r) => r._id !== row._id));
      await financeBankReconciliationApi.manualMatch(
        wsId,
        firmId,
        bankAccountId,
        sessionId,
        row._id,
        [topSuggestion.ledgerEntryId],
      );
      await refreshSession();
      await loadRows();
    } catch {
      message.error('Failed to confirm match. Please try again.');
      await loadRows();
    }
  };

  const handleBulkMatch = async () => {
    if (selectedRowIds.length === 0 || selectedEntryIds.length === 0) return;
    try {
      await financeBankReconciliationApi.bulkMatch(wsId, firmId, bankAccountId, sessionId, {
        bankStatementRowIds: selectedRowIds,
        ledgerEntryIds: selectedEntryIds,
      });
      message.success(
        `Matched ${selectedRowIds.length} bank rows with ${selectedEntryIds.length} book entries`,
      );
      setSelectedRowIds([]);
      setSelectedEntryIds([]);
      await loadRows();
      await refreshSession();
    } catch {
      message.error('Bulk match failed. Please try again.');
    }
  };

  const handleUnmatch = async (row: BankStatementRow) => {
    try {
      await financeBankReconciliationApi.unmatch(wsId, firmId, bankAccountId, sessionId, row._id);
      message.success('Unmatched successfully');
      await loadRows();
      await refreshSession();
    } catch {
      message.error('Failed to unmatch. Please try again.');
    }
  };

  const handleExclude = async (row: BankStatementRow, reason?: string) => {
    try {
      await financeBankReconciliationApi.excludeRow(
        wsId,
        firmId,
        bankAccountId,
        sessionId,
        row._id,
        reason,
      );
      message.success('Row excluded');
      await loadRows();
    } catch {
      message.error('Failed to exclude row.');
    }
  };

  const handleComplete = () => {
    Modal.confirm({
      title: 'Complete Reconciliation',
      content:
        'Lock this reconciliation? Once locked, no further changes can be made. Export the BRS report before locking.',
      okText: 'Complete',
      okButtonProps: { danger: true },
      onOk: async () => {
        setCompleting(true);
        try {
          const updated = await financeBankReconciliationApi.complete(
            wsId,
            firmId,
            bankAccountId,
            sessionId,
          );
          setSession(updated);
          onSessionUpdated(updated);
          message.success('Reconciliation completed and locked');
        } catch {
          message.error('Failed to complete reconciliation. Ensure all rows are matched.');
        } finally {
          setCompleting(false);
        }
      },
    });
  };

  const handleRowSelect = (rowId: string, selected: boolean) => {
    setSelectedRowIds((prev) => (selected ? [...prev, rowId] : prev.filter((id) => id !== rowId)));
  };

  const handleEntrySelect = (entryId: string, selected: boolean) => {
    setSelectedEntryIds((prev) =>
      selected ? [...prev, entryId] : prev.filter((id) => id !== entryId),
    );
  };

  // Get top suggestion entry for a row
  const getTopSuggestion = (row: BankStatementRow): BankReconciliationCandidate | undefined => {
    const top = row.topSuggestions?.[0];
    if (!top) return undefined;
    return candidates.find((c) => c._id === top.ledgerEntryId);
  };

  const matchedPairsCount = session.totalMatchedCount ?? matchedRows.length;
  const totalRows = statement.totalRows ?? 0;
  const matchedPercent = totalRows > 0 ? Math.round((matchedPairsCount / totalRows) * 100) : 0;

  // Matched Pairs table columns
  const matchedPairsColumns = [
    {
      title: 'Date',
      dataIndex: 'txnDate',
      key: 'txnDate',
      render: (v: string) => dayjs(v).format('DD MMM'),
      width: 80,
    },
    {
      title: 'Narration',
      dataIndex: 'narration',
      key: 'narration',
      ellipsis: true,
    },
    {
      title: 'Amount',
      dataIndex: 'amountPaise',
      key: 'amount',
      width: 120,
      render: (v: number, record: BankStatementRow) => {
        const isDebit = record.debitPaise > 0;
        const abs = Math.abs(v) / 100;
        return isDebit ? (
          <Text type="danger">₹{abs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        ) : (
          <Text type="success">₹{abs.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
        );
      },
    },
    {
      title: <span className="sr-only">Direction</span>,
      key: 'arrow',
      width: 30,
      render: () => <Text type="secondary">↔</Text>,
    },
    {
      title: 'Voucher #',
      key: 'voucherNumber',
      width: 120,
      render: (_: unknown, record: BankStatementRow) => (
        <Text code>{record.matchedVoucherIds?.[0] ?? '-'}</Text>
      ),
    },
    {
      title: 'Matched By',
      key: 'matchedBy',
      width: 100,
      render: (_: unknown, record: BankStatementRow) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.matchType === 'auto' ? 'Auto' : (record.matchedBy ?? 'User')}
        </Text>
      ),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'unmatch',
      width: 90,
      render: (_: unknown, record: BankStatementRow) =>
        !isLocked ? (
          <Popconfirm
            title="Remove this match?"
            description="The bank row and book entry will return to unmatched."
            okText="Unmatch"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleUnmatch(record)}
          >
            <Button type="link" danger size="small">
              Unmatch
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  if (isMobile) {
    return (
      <div className="p-lg">
        <Alert
          type="warning"
          title="Bank reconciliation is optimised for desktop. Please use a wider screen."
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Sticky header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--cr-surface)',
          borderBottom: '1px solid var(--cr-border)',
          paddingTop: 12,
          paddingBottom: 12,
          paddingLeft: 24,
          paddingRight: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Back + Bank account + Period */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 200 }}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() =>
              router.push(`/dashboard/finance/bank-accounts/${bankAccountId}/reconcile`)
            }
            style={{ padding: 0 }}
          >
            Back
          </Button>
          <Text strong style={{ fontFamily: 'var(--font-display)', fontSize: 15 }}>
            {bankAccount?.name ?? 'Bank Account'}
          </Text>
          <Tag color="blue">
            {dayjs(session.periodFrom).format('MMM YYYY')} -{' '}
            {dayjs(session.periodTo).format('MMM YYYY')}
          </Tag>
          {isLocked && (
            <Tag color="default">
              <LockOutlined /> Locked
            </Tag>
          )}
        </div>

        {/* Center: Statistics */}
        <div style={{ display: 'flex', gap: 24, flex: 1, justifyContent: 'center' }}>
          <Statistic
            title={
              <Text style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>Statement Balance</Text>
            }
            value={formatRupees(session.statementClosingBalancePaise)}
            styles={{
              content: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 },
            }}
          />
          <Statistic
            title={<Text style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>Book Balance</Text>}
            value={formatRupees(session.bookBalancePaise)}
            styles={{
              content: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 },
            }}
          />
          <Statistic
            title={<Text style={{ fontSize: 12, color: 'var(--cr-text-3)' }}>Difference</Text>}
            value={formatRupees(Math.abs(difference))}
            styles={{
              content: {
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 700,
                color: isFullyReconciled ? 'var(--cr-success)' : 'var(--cr-error)',
              },
            }}
            prefix={
              <span
                aria-live="polite"
                aria-atomic="true"
                style={{ fontSize: 14, fontWeight: 400 }}
              />
            }
          />
        </div>

        {/* Right: Progress + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 120 }}>
            <Progress
              percent={matchedPercent}
              size="small"
              strokeColor="var(--cr-primary)"
              format={(p) => `${p}%`}
            />
            <Text
              style={{
                fontSize: 11,
                color: 'var(--cr-text-3)',
                display: 'block',
                textAlign: 'center',
              }}
            >
              {matchedPairsCount}/{totalRows} matched
            </Text>
          </div>

          {!isLocked && (
            <>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                loading={autoMatching}
                onClick={handleAutoMatch}
              >
                Run Auto-Match
              </Button>

              <Tooltip title={!isFullyReconciled ? 'Difference must be ₹0 to complete' : undefined}>
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  disabled={!isFullyReconciled}
                  loading={completing}
                  onClick={handleComplete}
                >
                  Complete Reconciliation
                </Button>
              </Tooltip>
            </>
          )}

          <Button onClick={() => setBrsModalOpen(true)}>BRS Report</Button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
        {rowsLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : (
          <>
            {/* Split pane */}
            <div style={{ display: 'flex', height: 'calc(100vh - 160px)', overflow: 'hidden' }}>
              {/* Left pane: Unmatched Bank Rows */}
              <div
                style={{
                  flex: '0 0 50%',
                  minWidth: 400,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: '1px solid var(--cr-border)',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--cr-border)',
                    background: 'var(--cr-surface-2)',
                  }}
                >
                  <Text
                    strong
                    style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    Unmatched Bank Rows
                    <Badge
                      count={filteredRows.length}
                      style={{ marginLeft: 8, background: 'var(--cr-text-3)' }}
                    />
                  </Text>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <Segmented
                      size="small"
                      options={[
                        { label: 'All', value: 'all' },
                        { label: 'Unmatched', value: 'unmatched' },
                        { label: 'Disputed', value: 'disputed' },
                      ]}
                      value={rowStatusFilter}
                      onChange={(v) => setRowStatusFilter(v as string)}
                    />
                    <Search
                      size="small"
                      placeholder="Search narration..."
                      value={rowSearch}
                      onChange={(e) => setRowSearch(e.target.value)}
                      style={{ width: 180 }}
                      allowClear
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  {filteredRows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 48, color: 'var(--cr-text-3)' }}>
                      <Text type="secondary">All rows matched</Text>
                      <Text
                        type="secondary"
                        style={{ display: 'block', fontSize: 12, marginTop: 4 }}
                      >
                        Every bank transaction has been matched to a book entry. Review matched
                        pairs or complete the reconciliation.
                      </Text>
                    </div>
                  ) : (
                    filteredRows.map((row) => {
                      const topSuggestion = getTopSuggestion(row);
                      return (
                        <div key={row._id}>
                          <BankStatementRowCard
                            row={row}
                            isSelected={selectedRowIds.includes(row._id)}
                            suggestionEntry={topSuggestion}
                            onConfirmSuggestion={() => handleConfirmSuggestion(row)}
                            onLink={() => {
                              setLinkDrawerRow(row);
                              setLinkDrawerOpen(true);
                            }}
                            onCreate={() => {
                              setCreateModalRow(row);
                              setCreateModalOpen(true);
                            }}
                            onExclude={() => {
                              Modal.confirm({
                                title: 'Exclude Row',
                                content: (
                                  <div>
                                    <Text>
                                      Mark this transaction as disputed? It will be excluded from
                                      the reconciliation balance. You can undo this any time.
                                    </Text>
                                    <Input.TextArea
                                      placeholder="Reason (optional)"
                                      maxLength={200}
                                      style={{ marginTop: 8 }}
                                      onChange={(e) =>
                                        setExcludeReason((prev) => ({
                                          ...prev,
                                          [row._id]: e.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                ),
                                okText: 'Confirm Exclude',
                                onOk: () => handleExclude(row, excludeReason[row._id]),
                              });
                            }}
                            onSelect={(selected) => handleRowSelect(row._id, selected)}
                          />
                          {row.topSuggestions?.length > 1 && (
                            <MatchSuggestionsPanel
                              row={row}
                              candidates={
                                row.topSuggestions
                                  .slice(0, 3)
                                  .map((s) => candidates.find((c) => c._id === s.ledgerEntryId))
                                  .filter(Boolean) as typeof candidates
                              }
                              onMatch={async (entryId) => {
                                await financeBankReconciliationApi.manualMatch(
                                  wsId,
                                  firmId,
                                  bankAccountId,
                                  sessionId,
                                  row._id,
                                  [entryId],
                                );
                                await loadRows();
                                await refreshSession();
                              }}
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Bulk action bar */}
                {!isLocked && selectedRowIds.length > 0 && (
                  <div
                    style={{
                      position: 'sticky',
                      bottom: 0,
                      padding: '8px 16px',
                      background: 'var(--cr-surface)',
                      borderTop: '1px solid var(--cr-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>
                      {selectedRowIds.length} bank row{selectedRowIds.length > 1 ? 's' : ''}{' '}
                      selected
                    </Text>
                    {selectedEntryIds.length > 0 && (
                      <Popconfirm
                        title={`Match ${selectedRowIds.length} bank rows + ${selectedEntryIds.length} book entries?`}
                        description="This will link the selected rows as a many-to-many group."
                        onConfirm={handleBulkMatch}
                        okText="Proceed"
                        cancelText="Cancel"
                      >
                        <Button type="primary" size="small">
                          Match {selectedRowIds.length} bank rows + {selectedEntryIds.length} book
                          entries
                        </Button>
                      </Popconfirm>
                    )}
                    <Button size="small" onClick={() => setSelectedRowIds([])}>
                      Clear
                    </Button>
                  </div>
                )}
              </div>

              {/* Right pane: Book Entries */}
              <div
                style={{
                  flex: '0 0 50%',
                  minWidth: 400,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--cr-border)',
                    background: 'var(--cr-surface-2)',
                  }}
                >
                  <Text
                    strong
                    style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  >
                    Book Entries
                  </Text>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <Segmented
                      size="small"
                      options={[
                        { label: 'All', value: 'all' },
                        { label: 'Payment In', value: 'payment_in' },
                        { label: 'Payment Out', value: 'payment_out' },
                        { label: 'Expense', value: 'expense' },
                        { label: 'Journal', value: 'journal' },
                      ]}
                      value={entryTypeFilter}
                      onChange={(v) => setEntryTypeFilter(v as string)}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                  {candidates.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 48, color: 'var(--cr-text-3)' }}>
                      <Text type="secondary">No uncleared entries</Text>
                      <Text
                        type="secondary"
                        style={{ display: 'block', fontSize: 12, marginTop: 4 }}
                      >
                        All ledger entries for this bank account are already cleared or no entries
                        exist in this date range.
                      </Text>
                    </div>
                  ) : (
                    candidates
                      .filter((c) => entryTypeFilter === 'all' || c.entryType === entryTypeFilter)
                      .map((entry) => (
                        <BookEntryCard
                          key={entry._id}
                          entry={entry}
                          isSelected={selectedEntryIds.includes(entry._id)}
                          onSelect={(selected) => handleEntrySelect(entry._id, selected)}
                        />
                      ))
                  )}
                </div>

                {/* Bulk entry action bar */}
                {!isLocked && selectedEntryIds.length > 0 && (
                  <div
                    style={{
                      position: 'sticky',
                      bottom: 0,
                      padding: '8px 16px',
                      background: 'var(--cr-surface)',
                      borderTop: '1px solid var(--cr-border)',
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>
                      {selectedEntryIds.length} book entr{selectedEntryIds.length > 1 ? 'ies' : 'y'}{' '}
                      selected
                    </Text>
                    <Button
                      size="small"
                      style={{ marginLeft: 8 }}
                      onClick={() => setSelectedEntryIds([])}
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Matched Pairs section */}
            <div style={{ padding: '0 24px 24px' }}>
              <Collapse
                ghost
                defaultActiveKey={matchedPairsCount <= 20 ? ['matched'] : []}
                items={[
                  {
                    key: 'matched',
                    label: <Text strong>Matched Pairs ({matchedPairsCount})</Text>,
                    children: (
                      <Table
                        size="small"
                        dataSource={matchedRows}
                        columns={matchedPairsColumns}
                        rowKey="_id"
                        pagination={{ pageSize: 20, showSizeChanger: false }}
                        style={{ background: 'var(--cr-surface-2)' }}
                        scroll={{ x: true }}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>

      {/* Modals & Drawers */}
      {createModalRow && (
        <CreateFromRowModal
          open={createModalOpen}
          row={createModalRow}
          wsId={wsId}
          firmId={firmId}
          bankAccountId={bankAccountId}
          sessionId={sessionId}
          onClose={() => {
            setCreateModalOpen(false);
            setCreateModalRow(null);
          }}
          onCreated={async () => {
            setCreateModalOpen(false);
            setCreateModalRow(null);
            await loadRows();
            await refreshSession();
          }}
        />
      )}

      {linkDrawerRow && (
        <LinkVoucherDrawer
          open={linkDrawerOpen}
          row={linkDrawerRow}
          wsId={wsId}
          firmId={firmId}
          bankAccountId={bankAccountId}
          sessionId={sessionId}
          onClose={() => {
            setLinkDrawerOpen(false);
            setLinkDrawerRow(null);
          }}
          onLinked={async () => {
            setLinkDrawerOpen(false);
            setLinkDrawerRow(null);
            await loadRows();
            await refreshSession();
          }}
        />
      )}

      <BrsReportModal
        open={brsModalOpen}
        sessionId={sessionId}
        wsId={wsId}
        firmId={firmId}
        bankAccountId={bankAccountId}
        onClose={() => setBrsModalOpen(false)}
      />
    </div>
  );
}
