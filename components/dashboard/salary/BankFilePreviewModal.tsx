'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  InputNumber,
  Select,
  Typography,
  Alert,
  Spin,
} from 'antd';
import { DsModal } from '@/components/ui';
import { WarningOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons';
import Link from 'next/link';
import type { ColumnsType } from 'antd/es/table';
import { useBankFileExport } from '@/hooks/useBankFileExport';
import type { BankFileRow, BankFileMeta, BankBlockReason, BankFlag } from '@/types';
import { IMPS_CAP } from '@/lib/exportFields/bankFileValidators';

const { Text } = Typography;

const BLOCK_LABELS: Record<BankBlockReason, string> = {
  missing_account: 'Account number missing',
  missing_ifsc: 'IFSC missing',
  invalid_ifsc: 'IFSC format invalid',
};

const FLAG_LABELS: Record<BankFlag, { label: string; color: string; tooltip: string }> = {
  inactive: {
    label: 'Final settlement',
    color: 'purple',
    tooltip: 'Employee offboarded - pending dues. Verify before disbursal.',
  },
  on_hold: {
    label: 'On hold',
    color: 'orange',
    tooltip: 'Salary row was marked on hold. Confirm before paying.',
  },
  partially_paid: {
    label: 'Partial',
    color: 'blue',
    tooltip: 'Some amount already paid. Row shows remaining.',
  },
  fully_paid: {
    label: 'Fully paid',
    color: 'default',
    tooltip: 'Already paid in full. Include only to overpay.',
  },
  preferred_upi: {
    label: 'Prefers UPI',
    color: 'cyan',
    tooltip: 'Employee prefers UPI, but bank details are valid.',
  },
  preferred_cash: {
    label: 'Prefers Cash',
    color: 'cyan',
    tooltip: 'Employee prefers cash, but bank details are valid.',
  },
};

interface BankFilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  wsId: string;
  meta: BankFileMeta;
}

export function BankFilePreviewModal({ open, onClose, wsId, meta }: BankFilePreviewModalProps) {
  const {
    rows,
    loading,
    error,
    fetchRows,
    updateRow,
    resetAmounts,
    setModeAll,
    toggleFullyPaid,
    download,
  } = useBankFileExport(wsId);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) fetchRows(meta.month, meta.year);
  }, [open, meta.month, meta.year, fetchRows]);

  const includedRows = useMemo(() => rows.filter((r) => r._include && !r._blockReason), [rows]);
  const reviewRows = useMemo(() => rows.filter((r) => !r._include && !r._blockReason), [rows]);
  const blockedRows = useMemo(() => rows.filter((r) => !!r._blockReason), [rows]);
  const totalAmount = useMemo(() => includedRows.reduce((s, r) => s + r.amount, 0), [includedRows]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await download(meta);
    } finally {
      setDownloading(false);
    }
  };

  const buildColumns = (showCheckbox: boolean, disabled: boolean): ColumnsType<BankFileRow> => [
    ...(showCheckbox
      ? [
          {
            title: <span className="sr-only">Select</span>,
            width: 40,
            render: (_: unknown, row: BankFileRow) => (
              <input
                type="checkbox"
                checked={row._include}
                disabled={disabled || !!row._blockReason}
                onChange={(e) => updateRow(row.rowId, { _include: e.target.checked })}
              />
            ),
          },
        ]
      : []),
    {
      title: 'Employee',
      dataIndex: 'employeeName',
      width: 180,
      render: (name: string, row: BankFileRow) => (
        <Space orientation="vertical" size={2}>
          <Text style={{ opacity: disabled ? 0.45 : 1 }}>{name}</Text>
          {row.employeeCode && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {row.employeeCode}
            </Text>
          )}
          <Space size={4} wrap>
            {row._flags.map((f) => (
              <Tooltip key={f} title={FLAG_LABELS[f].tooltip}>
                <Tag color={FLAG_LABELS[f].color} style={{ fontSize: 11, margin: 0 }}>
                  {FLAG_LABELS[f].label}
                </Tag>
              </Tooltip>
            ))}
            {row._blockReason && (
              <>
                <Tag color="red" style={{ fontSize: 11, margin: 0 }}>
                  {BLOCK_LABELS[row._blockReason]}
                </Tag>
                <Link href={`/dashboard/team/${row.rowId}`} style={{ fontSize: 11 }}>
                  Update bank details
                </Link>
              </>
            )}
          </Space>
        </Space>
      ),
    },
    {
      title: 'Account',
      dataIndex: 'accountNumber',
      width: 140,
      render: (acc: string, row: BankFileRow) => (
        <Space orientation="vertical" size={0}>
          <Text style={{ opacity: disabled ? 0.45 : 1, fontSize: 12 }}>{acc || '-'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {row.ifsc || '-'}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Mode',
      dataIndex: 'paymentMode',
      width: 110,
      render: (mode: BankFileRow['paymentMode'], row: BankFileRow) => (
        <Select
          value={mode}
          size="small"
          style={{ width: 90 }}
          disabled={disabled || !row._include}
          onChange={(v) => updateRow(row.rowId, { paymentMode: v })}
          options={[
            { value: 'NEFT', label: 'NEFT' },
            { value: 'RTGS', label: 'RTGS' },
            { value: 'IMPS', label: 'IMPS' },
          ]}
        />
      ),
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      width: 130,
      render: (amount: number, row: BankFileRow) => (
        <InputNumber
          value={amount}
          size="small"
          style={{ width: 110 }}
          min={0}
          precision={2}
          disabled={disabled || !row._include}
          onChange={(v) => {
            if (v !== null) {
              const newMode = v > IMPS_CAP ? 'RTGS' : row.paymentMode;
              updateRow(row.rowId, { amount: v, paymentMode: newMode });
            }
          }}
        />
      ),
    },
    {
      title: <span className="sr-only">Status</span>,
      width: 32,
      render: (_: unknown, row: BankFileRow) => {
        if (row._warnings.length > 0) {
          return (
            <Tooltip title={row._warnings.join('; ')}>
              <WarningOutlined style={{ color: 'var(--cr-warning-500)' }} />
            </Tooltip>
          );
        }
        if (disabled)
          return <StopOutlined style={{ color: 'var(--cr-danger-500)', opacity: 0.4 }} />;
        if (row._include) return <CheckCircleOutlined style={{ color: 'var(--cr-success-500)' }} />;
        return null;
      },
    },
  ];

  const footer = (
    <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
      <Space wrap>
        <Button size="small" onClick={() => toggleFullyPaid(true)}>
          Include fully-paid rows
        </Button>
        <Button size="small" onClick={resetAmounts}>
          Reset amounts
        </Button>
        <Select
          size="small"
          placeholder="Set mode: all"
          style={{ width: 130 }}
          onChange={(v) => setModeAll(v)}
          options={[
            { value: 'NEFT', label: 'All → NEFT' },
            { value: 'RTGS', label: 'All → RTGS' },
            { value: 'IMPS', label: 'All → IMPS' },
          ]}
        />
      </Space>
      <Button
        type="primary"
        loading={downloading}
        onClick={handleDownload}
        disabled={includedRows.length === 0}
      >
        Download File{meta.format === 'both' ? 's' : ''}
      </Button>
    </Space>
  );

  return (
    <DsModal
      open={open}
      title="Preview Bank Transfer File"
      onCancel={onClose}
      width={900}
      footer={footer}
      scrollable={false}
      destroyOnHidden
    >
      {loading && <Spin style={{ display: 'block', textAlign: 'center', padding: 40 }} />}
      {error && <Alert type="error" title={error} style={{ marginBottom: 12 }} />}
      {!loading && !error && (
        <Space orientation="vertical" size={16} style={{ width: '100%' }}>
          {/* Summary strip */}
          <Space wrap>
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Included {includedRows.length} · ₹{totalAmount.toLocaleString('en-IN')}
            </Tag>
            {reviewRows.length > 0 && (
              <Tag color="orange" icon={<WarningOutlined />}>
                Review before sending {reviewRows.length}
              </Tag>
            )}
            {blockedRows.length > 0 && (
              <Tag color="red" icon={<StopOutlined />}>
                Cannot include {blockedRows.length}
              </Tag>
            )}
          </Space>

          {/* Included section */}
          {includedRows.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Included ({includedRows.length})
              </Text>
              <Table<BankFileRow>
                columns={buildColumns(true, false)}
                dataSource={includedRows}
                rowKey="rowId"
                size="small"
                scroll={{ x: 'max-content', y: 220 }}
                pagination={false}
              />
            </div>
          )}

          {/* Review section */}
          {reviewRows.length > 0 && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Review before sending ({reviewRows.length})
              </Text>
              <Table<BankFileRow>
                columns={buildColumns(true, false)}
                dataSource={reviewRows}
                rowKey="rowId"
                size="small"
                scroll={{ x: 'max-content', y: 180 }}
                pagination={false}
                rowClassName="opacity-60"
              />
            </div>
          )}

          {/* Cannot include section */}
          {blockedRows.length > 0 && (
            <div>
              <Text
                strong
                style={{ display: 'block', marginBottom: 6, color: 'var(--cr-danger-500)' }}
              >
                Cannot include ({blockedRows.length})
              </Text>
              <Table<BankFileRow>
                columns={buildColumns(false, true)}
                dataSource={blockedRows}
                rowKey="rowId"
                size="small"
                scroll={{ x: 'max-content', y: 160 }}
                pagination={false}
                rowClassName="opacity-50"
              />
            </div>
          )}
        </Space>
      )}
    </DsModal>
  );
}
