'use client';

import { Spin, Table, Tooltip, InputNumber, Input } from 'antd';
import type { TableColumnsType } from 'antd';
import type { ExpandableConfig } from 'antd/es/table/interface';
import { CheckCircleFilled, CloseCircleFilled, LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BulkAssignmentRow {
  assignmentId: string;
  machineId: string;
  machineName: string;
  machineCode: string;
  teamMemberId: string;
  operatorName: string;
  shiftId?: string;
  primaryMetric: 'stitches' | 'pieces' | 'hours';
  isOutOfScope: boolean;
}

export interface BulkRowState {
  stitchCount?: number | null;
  pieceCount?: number | null;
  hoursLogged?: number | null;
  notes?: string;
  status: 'pending' | 'submitting' | 'success' | 'failed' | 'out-of-scope-warn';
  errorCode?: 'WINDOW' | 'SCOPE' | 'LOCKED' | 'AMBIGUOUS' | 'VALIDATION';
  errorDetail?: string;
}

export interface BulkProductionLogTableProps {
  rows: BulkAssignmentRow[];
  values: Record<string, BulkRowState>; // keyed by assignmentId
  onChange: (assignmentId: string, patch: Partial<BulkRowState>) => void;
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Row row background class helper
// ---------------------------------------------------------------------------

function getRowClassName(row: BulkAssignmentRow, values: Record<string, BulkRowState>): string {
  const state = values[row.assignmentId];
  if (!state) return '';
  switch (state.status) {
    case 'submitting':
      return 'bulk-row--submitting';
    case 'success':
      return 'bulk-row--success';
    case 'failed':
      return 'bulk-row--failed';
    case 'out-of-scope-warn':
      return 'bulk-row--out-of-scope';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Status cell
// ---------------------------------------------------------------------------

function StatusCell({ state, t }: { state: BulkRowState; t: ReturnType<typeof useTranslations> }) {
  if (state.status === 'pending') return null;

  if (state.status === 'submitting') {
    return (
      <span className="flex items-center gap-1 text-[13px] text-[var(--cr-text-3)]">
        <Spin size="small" />
        <span className="text-[var(--cr-text-4)]">{t('bulk.row.success')}</span>
      </span>
    );
  }

  if (state.status === 'success') {
    return (
      <span className="flex items-center gap-1 text-[13px] text-[var(--cr-success)]">
        <CheckCircleFilled />
        {t('bulk.row.success')}
      </span>
    );
  }

  if (state.status === 'failed') {
    const code = state.errorCode ?? 'VALIDATION';
    const errLabel = t(`bulk.row.errCode.${code}` as Parameters<typeof t>[0]);
    let tooltipContent: string;
    if (code === 'VALIDATION') {
      tooltipContent = t('bulk.row.errTip.VALIDATION', { detail: state.errorDetail ?? '' });
    } else {
      tooltipContent = t(`bulk.row.errTip.${code}` as Parameters<typeof t>[0]);
    }
    return (
      <Tooltip title={tooltipContent}>
        <span
          aria-describedby={`err-${code}`}
          className="flex cursor-help items-center gap-1"
          style={{ color: 'var(--cr-error)' }}
        >
          <CloseCircleFilled style={{ fontSize: 13 }} />
          <span
            style={{
              background: 'var(--cr-error-bg)',
              color: 'var(--cr-error)',
              fontSize: 11,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 4,
              letterSpacing: '0.04em',
            }}
          >
            {errLabel}
          </span>
          <span id={`err-${code}`} className="sr-only">
            {tooltipContent}
          </span>
        </span>
      </Tooltip>
    );
  }

  if (state.status === 'out-of-scope-warn') {
    return (
      <span className="flex items-center gap-1" style={{ color: 'var(--cr-error)' }}>
        <LockOutlined style={{ fontSize: 13 }} />
        <span
          style={{
            background: 'var(--cr-error-bg)',
            color: 'var(--cr-error)',
            fontSize: 11,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 4,
            letterSpacing: '0.04em',
          }}
        >
          {t('bulk.row.outOfScope')}
        </span>
      </span>
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Primary metric cell
// ---------------------------------------------------------------------------

function PrimaryMetricCell({
  row,
  state,
  onChange,
  disabled,
}: {
  row: BulkAssignmentRow;
  state: BulkRowState;
  onChange: (patch: Partial<BulkRowState>) => void;
  disabled: boolean;
}) {
  const metric = row.primaryMetric;

  const stepMap = {
    stitches: 1,
    pieces: 1,
    hours: 0.25,
  };
  const precisionMap = {
    stitches: 0,
    pieces: 0,
    hours: 2,
  };
  const suffixMap = {
    stitches: 'stitches',
    pieces: 'pcs',
    hours: 'hr',
  };
  const maxMap = {
    stitches: 10_000_000,
    pieces: 1_000_000,
    hours: 24,
  };

  const value =
    metric === 'stitches'
      ? state.stitchCount
      : metric === 'pieces'
        ? state.pieceCount
        : state.hoursLogged;

  function handleChange(val: number | null) {
    if (metric === 'stitches') onChange({ stitchCount: val });
    else if (metric === 'pieces') onChange({ pieceCount: val });
    else onChange({ hoursLogged: val });
  }

  return (
    <div className={state.status === 'submitting' ? 'animate-pulse-light' : ''}>
      <InputNumber
        className="w-full tabular-nums"
        value={value ?? undefined}
        onChange={handleChange}
        min={0}
        max={maxMap[metric]}
        step={stepMap[metric]}
        precision={precisionMap[metric]}
        addonAfter={suffixMap[metric]}
        disabled={disabled || state.status === 'submitting' || state.status === 'out-of-scope-warn'}
        style={{ fontVariantNumeric: 'tabular-nums' }}
        aria-label={`Output - ${metric}`}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BulkProductionLogTable({
  rows,
  values,
  onChange,
  readOnly = false,
}: BulkProductionLogTableProps) {
  const t = useTranslations('machines-production');

  // Expandable row for secondary metrics + notes
  const expandable: ExpandableConfig<BulkAssignmentRow> = {
    expandedRowRender: (row: BulkAssignmentRow) => {
      const state = values[row.assignmentId] ?? { status: 'pending' as const };
      const isDisabled =
        readOnly || state.status === 'out-of-scope-warn' || state.status === 'submitting';
      const metric = row.primaryMetric;

      return (
        <div className="flex flex-col gap-3 px-4 py-2">
          {/* Secondary metric 1 */}
          {metric !== 'stitches' && (
            <div className="flex items-center gap-3">
              <span className="w-24 text-xs text-[var(--cr-text-3)]">Stitches</span>
              <InputNumber
                className="tabular-nums"
                value={state.stitchCount ?? undefined}
                onChange={(val) => onChange(row.assignmentId, { stitchCount: val })}
                min={0}
                step={1}
                precision={0}
                addonAfter="stitches"
                disabled={isDisabled}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
          )}
          {metric !== 'pieces' && (
            <div className="flex items-center gap-3">
              <span className="w-24 text-xs text-[var(--cr-text-3)]">Pieces</span>
              <InputNumber
                className="tabular-nums"
                value={state.pieceCount ?? undefined}
                onChange={(val) => onChange(row.assignmentId, { pieceCount: val })}
                min={0}
                step={1}
                precision={0}
                addonAfter="pcs"
                disabled={isDisabled}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
          )}
          {metric !== 'hours' && (
            <div className="flex items-center gap-3">
              <span className="w-24 text-xs text-[var(--cr-text-3)]">Hours</span>
              <InputNumber
                className="tabular-nums"
                value={state.hoursLogged ?? undefined}
                onChange={(val) => onChange(row.assignmentId, { hoursLogged: val })}
                min={0}
                max={24}
                step={0.25}
                precision={2}
                addonAfter="hr"
                disabled={isDisabled}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              />
            </div>
          )}
          {/* Notes */}
          <div className="flex items-start gap-3">
            <span className="mt-1 w-24 text-xs text-[var(--cr-text-3)]">Notes</span>
            <Input.TextArea
              value={state.notes ?? ''}
              onChange={(e) => onChange(row.assignmentId, { notes: e.target.value })}
              rows={2}
              maxLength={500}
              disabled={isDisabled}
              placeholder="Optional context…"
              style={{ maxWidth: 400 }}
            />
          </div>
        </div>
      );
    },
    rowExpandable: () => true,
  };

  const columns: TableColumnsType<BulkAssignmentRow> = [
    {
      title: t('bulk.col.machine'),
      key: 'machine',
      width: 180,
      render: (_: unknown, row: BulkAssignmentRow) => (
        <div>
          <span className="text-[13px] font-medium">{row.machineName}</span>
          <span className="ml-1 text-xs text-[var(--cr-text-3)]">· {row.machineCode}</span>
        </div>
      ),
    },
    {
      title: t('bulk.col.operator'),
      key: 'operator',
      width: 150,
      render: (_: unknown, row: BulkAssignmentRow) => (
        <span
          className="text-[13px]"
          style={{ color: row.isOutOfScope ? 'var(--cr-text-4)' : undefined }}
        >
          {row.operatorName}
        </span>
      ),
    },
    {
      title: t('bulk.col.primary'),
      key: 'primary',
      width: 200,
      render: (_: unknown, row: BulkAssignmentRow) => {
        const state = values[row.assignmentId] ?? { status: 'pending' as const };
        return (
          <PrimaryMetricCell
            row={row}
            state={state}
            onChange={(patch) => onChange(row.assignmentId, patch)}
            disabled={readOnly}
          />
        );
      },
    },
    {
      title: t('bulk.col.secondary'),
      key: 'secondary',
      width: 120,
      render: () => <span className="text-xs text-[var(--cr-text-3)] italic">Expand row</span>,
    },
    {
      title: t('bulk.col.notes'),
      key: 'notes',
      width: 150,
      ellipsis: true,
      render: (_: unknown, row: BulkAssignmentRow) => {
        const state = values[row.assignmentId] ?? { status: 'pending' as const };
        return (
          <span className="truncate text-[13px] text-[var(--cr-text-3)]">{state.notes || '-'}</span>
        );
      },
    },
    {
      title: t('bulk.col.result'),
      key: 'result',
      width: 160,
      render: (_: unknown, row: BulkAssignmentRow) => {
        const state = values[row.assignmentId] ?? { status: 'pending' as const };
        return <StatusCell state={state} t={t} />;
      },
    },
  ];

  const useVirtual = rows.length > 50;

  return (
    <>
      {/* Inline styles for row state classes */}
      <style>{`
        .bulk-row--submitting td { background: rgba(6, 182, 212, 0.08) !important; }
        .bulk-row--success td { background: rgba(34, 197, 94, 0.12) !important; transition: background 3s ease; }
        .bulk-row--failed td { background: rgba(239, 68, 68, 0.12) !important; }
        .bulk-row--out-of-scope td { background: var(--cr-surface-2) !important; }
        .bulk-row--out-of-scope td input,
        .bulk-row--out-of-scope td .ant-input-number { color: var(--cr-text-4) !important; }
        @keyframes pulseLightAnim { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .animate-pulse-light { animation: pulseLightAnim 1.2s ease-in-out infinite; }
      `}</style>
      <Table<BulkAssignmentRow>
        columns={columns}
        dataSource={rows}
        rowKey="assignmentId"
        pagination={false}
        size="middle"
        virtual={useVirtual}
        expandable={expandable}
        rowClassName={(row: BulkAssignmentRow) => getRowClassName(row, values)}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: null }}
      />
    </>
  );
}

export default BulkProductionLogTable;
