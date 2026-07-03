'use client';

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import {
  Card,
  Input,
  Select,
  Button,
  Space,
  Badge,
  Table,
  Collapse,
  DatePicker,
  Tooltip,
  Dropdown,
  Skeleton,
} from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';
import {
  SearchOutlined,
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  CloseCircleOutlined,
  FilePdfOutlined,
  TeamOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  MailOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { getSalaryExportFields } from '@/lib/exportFields/salaryFields';
import type { SalaryExportRow } from '@/lib/exportFields/salaryFields';
import { ExportButton } from '@/components/export';
import { BankFileButton } from '@/components/dashboard/salary/BankFileButton';
import { DsTable, DsTag, DsAvatar, SegmentedToggle } from '@/components/ui';
import { TableCustomScrollbar } from '@/components/ui/TableCustomScrollbar';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import type {
  SalaryRecord,
  StatusFilter,
  ViewMode,
  ShiftPayrollSummary,
} from '../../types/salary-page.types';
import { useSalaryPageStore } from '../../store/useSalaryPageStore';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { useDebounce } from '@/hooks/useDebounce';

type ShiftRowsPagination = { page: number; limit: number; total: number; pages: number };

interface SalaryPageHeaderProps {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  month: number;
  year: number;
  setMonth: (v: number) => void;
  setYear: (v: number) => void;
  search: string;
  setSearch: (v: string) => void;
  sortKey: string;
  setSortKey: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  statusCounts: Record<string, number>;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  loading: boolean;
  filteredRecords: SalaryRecord[];
  columns: ColumnsType<SalaryRecord>;
  shiftSummaries: ShiftPayrollSummary[];
  shiftSummariesLoading: boolean;
  shiftRowsByKey: Record<string, SalaryRecord[]>;
  shiftRowsLoadingByKey: Record<string, boolean>;
  shiftRowsLoadedByKey: Record<string, boolean>;
  shiftRowsErrorByKey: Record<string, string | undefined>;
  shiftPaginationByKey: Partial<Record<string, ShiftRowsPagination>>;
  onLoadShiftRows: (shiftKey: string, options?: { page?: number; limit?: number }) => Promise<void>;
  canExport: boolean;
  salaryFilterSummary: string | undefined;
  getExportData: () => Promise<SalaryExportRow[]>;
  onLoad: () => void;
  onLoadShiftSummaries: () => Promise<ShiftPayrollSummary[]>;
  onNavigateMonth: (month: number, year: number) => void;
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  setCurrentPage: (page: number) => void;
  onBulkPayslipDownload?: (mode: 'combined' | 'zip') => void;
  showPayslipGeneration?: boolean;
  enablePayslipGeneration?: boolean;
  payslipGenerating?: boolean;
  selectedRowKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  showBulkPayments?: boolean;
  onOpenBulkPayment?: () => void;
  onOpenBulkPayslip?: () => void;
  onBulkEmailPayslips?: () => void;
  bulkPayslipEmailing?: boolean;
  onClearSelection?: () => void;
  onOpenComplianceExport?: () => void;
  payableSelectedCount?: number;
  lockedSelectedCount?: number;
  wsId?: string;
}

interface ShiftRowsTableProps {
  shiftKey: string;
  columns: ColumnsType<SalaryRecord>;
  rowKey: (record: SalaryRecord) => string;
  rows: SalaryRecord[];
  loading: boolean;
  loaded: boolean;
  error?: string;
  pagination?: ShiftRowsPagination;
  onLoadShiftRows: (shiftKey: string, options?: { page?: number; limit?: number }) => Promise<void>;
}

function SalaryRecordCardList({
  rows,
  loading,
  loaded,
  error,
  rowKey,
}: {
  rows: SalaryRecord[];
  loading: boolean;
  loaded: boolean;
  error?: string;
  rowKey: (record: SalaryRecord) => string;
}) {
  const t = useTranslations();
  if (loading || (!loaded && !error)) {
    return (
      <div className="py-6 text-center text-[12px] text-muted">
        {t('salary.pageHeader.shiftRows.loading')}
      </div>
    );
  }
  if (error) {
    return <div className="py-6 text-center text-[12px] text-error">{error}</div>;
  }
  if (rows.length === 0) {
    return (
      <div className="py-6 text-center text-[12px] text-muted">
        {t('salary.pageHeader.shiftRows.noMatchInShift')}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => {
        const tm = typeof r.teamMemberId === 'object' ? r.teamMemberId : null;
        const name = tm?.name || t('salary.pageHeader.cardList.fallbackName');
        const designation = tm?.designation || '';
        const status = r.status; // 'pending' | 'partial' | 'paid' | 'advance'
        const statusTone =
          status === 'paid' ? 'active' : status === 'pending' ? 'inactive' : 'warning';
        const statusLabel =
          status === 'paid'
            ? t('salary.pageHeader.cardList.statusPaid')
            : status === 'pending'
              ? t('salary.pageHeader.cardList.statusPending')
              : status === 'partial'
                ? t('salary.pageHeader.cardList.statusPartial')
                : t('salary.pageHeader.cardList.statusAdvance');
        const net = r.effectiveSalary ?? r.netSalary ?? 0;
        const paid = r.paidAmount ?? 0;
        const remaining = Math.max(0, net - paid);
        return (
          <div
            key={rowKey(r)}
            className={`flex items-center gap-3 rounded-xl border border-border-light p-3 ${r.isPreview ? 'bg-surface-2' : 'bg-surface'}`}
          >
            <DsAvatar name={name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[14px] font-semibold text-heading">{name}</span>
                <DsTag
                  status={statusTone as 'active' | 'inactive' | 'warning'}
                  label={statusLabel}
                />
              </div>
              {designation ? (
                <div className="mt-0.5 truncate text-[12px] text-muted">{designation}</div>
              ) : null}
              {/* Net stands out (bold); Due is highlighted when unpaid since it is the
                  actionable amount. Read-only card (mobile only) - the desktop table
                  row carries the pay/calculate actions. */}
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12px]">
                <span className="text-subtle">
                  {t('salary.pageHeader.cardList.netLabel')}{' '}
                  <span className="font-semibold text-heading">
                    ₹{Number(net).toLocaleString('en-IN')}
                  </span>
                </span>
                {paid > 0 && (
                  <span className="text-subtle">
                    · {t('salary.pageHeader.cardList.paidLabel')} ₹
                    {Number(paid).toLocaleString('en-IN')}
                  </span>
                )}
                {remaining > 0 && status !== 'paid' && (
                  <span className="font-semibold" style={{ color: 'var(--cr-warning-700)' }}>
                    · {t('salary.pageHeader.cardList.dueLabel')} ₹
                    {Number(remaining).toLocaleString('en-IN')}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShiftRowsTable({
  shiftKey,
  columns,
  rowKey,
  rows,
  loading,
  loaded,
  error,
  pagination,
  onLoadShiftRows,
}: ShiftRowsTableProps) {
  const t = useTranslations();
  const tableLoading = loading || (!loaded && !error);
  // Wrapper for this shift panel's table so <TableCustomScrollbar> can drive the
  // branded horizontal bar (native bar hidden via `.salary-table-wrap` in globals.css),
  // same as the main table. Each shift panel gets its own ref/scrollbar.
  const shiftTableWrapRef = useRef<HTMLDivElement>(null);

  return (
    <>
      {/* Mobile (sub-md) read-only card list. The DsTable below has 12+ cols
        and forces horizontal scroll on phones. Cards surface name, status,
        net/paid/due - actions stay desktop-only for v1. */}
      <div className="md:hidden">
        <SalaryRecordCardList
          rows={rows}
          loading={loading}
          loaded={loaded}
          error={error}
          rowKey={rowKey}
        />
      </div>
      <div ref={shiftTableWrapRef} className="salary-table-wrap hidden md:block">
        <DsTable
          columns={columns}
          dataSource={rows}
          rowKey={rowKey}
          loading={tableLoading}
          scrollX={900}
          sticky={false}
          size="middle"
          rowClassName={(r: SalaryRecord) => (r.isPreview ? 'bg-surface-2' : '')}
          locale={{
            emptyText: tableLoading ? (
              t('salary.pageHeader.shiftRows.loading')
            ) : error ? (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <span className="rounded-full bg-error-bg px-3 py-1 text-[11px] font-semibold text-error">
                  {t('salary.pageHeader.shiftRows.errorBadge')}
                </span>
                <div className="space-y-1">
                  <p className="font-display text-[16px] font-semibold text-heading">
                    {t('salary.pageHeader.shiftRows.errorTitle')}
                  </p>
                  <p className="text-[12px] text-muted">{error}</p>
                </div>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() =>
                    void onLoadShiftRows(shiftKey, {
                      page: pagination?.page ?? 1,
                      limit: pagination?.limit,
                    })
                  }
                >
                  {t('salary.pageHeader.shiftRows.retry')}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-muted">
                  {t('salary.pageHeader.shiftRows.noMatchBadge')}
                </span>
                <div className="space-y-1">
                  <p className="font-display text-[16px] font-semibold text-heading">
                    {t('salary.pageHeader.shiftRows.noMatchTitle')}
                  </p>
                  <p className="text-[12px] text-muted">
                    {t('salary.pageHeader.shiftRows.noMatchBody')}
                  </p>
                </div>
              </div>
            ),
          }}
          pagination={
            pagination
              ? {
                  current: pagination.page,
                  pageSize: pagination.limit,
                  total: pagination.total,
                  size: 'small' as const,
                  showSizeChanger: true,
                  showQuickJumper: false,
                  pageSizeOptions: ['25', '50', '100'],
                  showTotal: (total: number, range: [number, number]) =>
                    t('salary.pageHeader.pagination.range', {
                      from: range[0],
                      to: range[1],
                      total,
                    }),
                  onChange: (newPage: number, newPageSize: number) => {
                    void onLoadShiftRows(shiftKey, {
                      page: newPage,
                      limit: newPageSize,
                    });
                  },
                }
              : false
          }
        />
        {/* Branded horizontal scrollbar for this shift's table (native bar hidden for
            `.salary-table-wrap` in globals.css). Same component as the main table. */}
        <TableCustomScrollbar containerRef={shiftTableWrapRef} />
      </div>
    </>
  );
}

function formatShiftTime12(value?: string) {
  if (!value) return '--';

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;

  const rawHours = Number(match[1]);
  const minutes = match[2];
  if (Number.isNaN(rawHours) || rawHours < 0 || rawHours > 23) return value;

  const suffix = rawHours >= 12 ? 'PM' : 'AM';
  const normalizedHours = rawHours % 12 || 12;
  return `${normalizedHours}:${minutes} ${suffix}`;
}

function formatShiftWindow(start?: string, end?: string) {
  if (!start && !end) return null;
  if (start && end) {
    return `${formatShiftTime12(start)} - ${formatShiftTime12(end)}`;
  }
  if (start) {
    return `Starts ${formatShiftTime12(start)}`;
  }
  return `Ends ${formatShiftTime12(end)}`;
}

function ShiftMetricCard({
  label,
  value,
  valueCompact,
  tone,
}: {
  label: string;
  /** Full formatted value (e.g. ₹1,23,45,678) - shown on desktop. */
  value: string;
  /** Compact value (e.g. ₹1.23L) - shown on the narrow mobile card so big amounts
   *  cannot overflow the ~110px 3-across cell. Falls back to `value` if absent. */
  valueCompact?: string;
  tone: 'primary' | 'success' | 'warning';
}) {
  const toneMap = {
    primary: {
      background: 'var(--cr-primary-light,var(--cr-primary-light))',
      borderColor: 'var(--cr-primary-border,var(--cr-primary-border))',
      labelColor: 'var(--cr-primary,var(--cr-primary))',
      valueColor: 'var(--cr-primary,var(--cr-primary))',
    },
    success: {
      background: 'var(--cr-success-bg,var(--cr-success-50))',
      borderColor: 'rgba(34,197,94,0.18)',
      labelColor: 'var(--cr-success,var(--cr-success-700))',
      valueColor: 'var(--cr-success,var(--cr-success-700))',
    },
    warning: {
      background: 'var(--cr-warning-bg,var(--cr-warning-50))',
      borderColor: 'rgba(245,158,11,0.18)',
      labelColor: 'var(--cr-warning,var(--cr-warning-700))',
      valueColor: 'var(--cr-warning,var(--cr-warning-700))',
    },
  } as const;

  const colors = toneMap[tone];

  return (
    <div
      // Tighter padding + smaller value on phones so three cards fit one row; sm+
      // restores the original desktop sizing.
      className="rounded-xl border px-2.5 py-2 text-left sm:px-3.5 sm:py-3 xl:text-right"
      style={{
        background: colors.background,
        borderColor: colors.borderColor,
      }}
    >
      <span
        className="block text-[10px] font-semibold tracking-[0.06em] uppercase sm:text-[11px] sm:tracking-[0.08em]"
        style={{ color: colors.labelColor }}
      >
        {label}
      </span>
      {/* Compact value on mobile so large amounts can't overflow the narrow 3-across
          card; full value on sm+ (desktop, unchanged). truncate + title are a safety net
          so even an extreme value truncates with a tooltip instead of breaking the UI. */}
      <strong
        className="mt-1 block truncate font-display text-[15px] leading-none font-bold sm:hidden"
        style={{ color: colors.valueColor }}
        title={value}
      >
        {valueCompact ?? value}
      </strong>
      <strong
        className="mt-1.5 hidden truncate font-display text-[18px] leading-none font-bold sm:block"
        style={{ color: colors.valueColor }}
        title={value}
      >
        {value}
      </strong>
    </div>
  );
}

function ShiftExceptionTag({
  count,
  label,
  tone,
}: {
  count: number;
  label: string;
  tone: 'pending' | 'advance' | 'neutral';
}) {
  if (count <= 0) return null;

  return (
    <DsTag
      status={tone === 'neutral' ? undefined : tone}
      style={{
        margin: 0,
        paddingInline: 8,
        paddingBlock: 1,
        fontSize: 11,
        lineHeight: '18px',
        textTransform: 'none',
        ...(tone === 'neutral'
          ? {
              background: 'var(--cr-surface-2,var(--cr-bg))',
              color: 'var(--cr-text-2,var(--cr-text-4))',
            }
          : {}),
      }}
    >
      {count} {label}
    </DsTag>
  );
}

function ShiftSummariesSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`shift-skeleton-${index}`}
          className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
        >
          <div className="grid grid-cols-1 gap-5 px-5 py-5 sm:px-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <Skeleton.Avatar active size={40} shape="square" style={{ borderRadius: 14 }} />
                <Skeleton.Input active size="small" style={{ width: 190, height: 24 }} />
              </div>
              <div className="mt-2.5">
                <Skeleton.Input active size="small" style={{ width: 160, height: 18 }} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Skeleton.Button
                  active
                  size="small"
                  style={{ width: 104, height: 24, borderRadius: 999 }}
                />
                <Skeleton.Button
                  active
                  size="small"
                  style={{ width: 126, height: 24, borderRadius: 999 }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[360px]">
              {Array.from({ length: 3 }).map((__, metricIndex) => (
                <div
                  key={`shift-skeleton-metric-${index}-${metricIndex}`}
                  className="rounded-xl border border-border-light bg-surface-2 px-3.5 py-3"
                >
                  <Skeleton.Input active size="small" style={{ width: 56, height: 14 }} />
                  <div className="mt-2">
                    <Skeleton.Input active size="small" style={{ width: 104, height: 24 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SalaryPageHeader({
  viewMode,
  setViewMode,
  month,
  year,
  setMonth,
  setYear,
  search,
  setSearch,
  sortKey,
  setSortKey,
  statusFilter,
  setStatusFilter,
  statusCounts,
  hasActiveFilters,
  onClearFilters,
  loading,
  filteredRecords,
  columns,
  shiftSummaries,
  shiftSummariesLoading,
  shiftRowsByKey,
  shiftRowsLoadingByKey,
  shiftRowsLoadedByKey,
  shiftRowsErrorByKey,
  shiftPaginationByKey,
  onLoadShiftRows,
  canExport,
  salaryFilterSummary,
  getExportData,
  onLoad,
  onLoadShiftSummaries,
  onNavigateMonth,
  currentPage,
  pageSize,
  totalRecords,
  setCurrentPage,
  onBulkPayslipDownload,
  showPayslipGeneration,
  enablePayslipGeneration = false,
  payslipGenerating = false,
  selectedRowKeys = [],
  onSelectionChange,
  showBulkPayments = false,
  onOpenBulkPayment,
  onOpenBulkPayslip,
  onBulkEmailPayslips,
  bulkPayslipEmailing = false,
  onClearSelection,
  onOpenComplianceExport,
  payableSelectedCount,
  lockedSelectedCount = 0,
  wsId,
}: SalaryPageHeaderProps) {
  const t = useTranslations();
  const router = useRouter();
  const displayConfig = usePayrollConfigStore((s) => s.config?.display);
  const currencyFmt = useCurrencyFormatter();

  // Local state drives the Input so typing stays responsive and isn't gated
  // by parent re-renders. Debounced value propagates to parent (store + URL +
  // API) so we don't fire a request on every keystroke.
  const [searchInput, setSearchInput] = useState(search);
  const latestSearchProp = useRef(search);
  // Wrapper for the desktop payroll table - <TableCustomScrollbar> finds the
  // `.ant-table-content` scroller inside it and draws the branded horizontal bar
  // (native bar hidden for `.salary-table-wrap` in globals.css). Mirrors Team.
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const debouncedSearchInput = useDebounce(searchInput, 400);

  // Keep a ref to the latest setSearch so the propagate effect below doesn't
  // depend on it. Parent passes a fresh inline arrow each render, so depending
  // on it would re-fire the effect on every parent re-render and replay the
  // (still-stale) debounced value back upstream - which would un-clear the
  // search whenever the user clicks Clear filters after the debounce fired.
  const setSearchRef = useRef(setSearch);
  useEffect(() => {
    setSearchRef.current = setSearch;
  });

  // Parent-driven search changes (clear button, URL nav, programmatic reset)
  // sync down into local state without feeding the debounce loop back up.
  useEffect(() => {
    latestSearchProp.current = search;
    startTransition(() => {
      setSearchInput((prev) => (prev === search ? prev : search));
    });
  }, [search]);

  // Propagate debounced local value up. Compare against latest parent value
  // via ref to avoid re-running setSearch when the change originated upstream.
  // Depend ONLY on debouncedSearchInput - see setSearchRef comment above.
  useEffect(() => {
    if (debouncedSearchInput !== latestSearchProp.current) {
      latestSearchProp.current = debouncedSearchInput;
      setSearchRef.current(debouncedSearchInput);
    }
  }, [debouncedSearchInput]);

  // Derive active-filters from local input (not parent's debounced search) so
  // the Clear button reflects what the user just typed without a 400ms lag.
  // Also includes sortKey so non-default sort enables the button. Parent's
  // hasActiveFilters prop is intentionally ignored here.
  void hasActiveFilters;
  const isFilterActive = searchInput !== '' || statusFilter !== 'all' || sortKey !== 'name_asc';

  const salaryExportFields = useMemo(
    () =>
      getSalaryExportFields({
        symbol: displayConfig?.currencySymbol || '₹',
        locale: displayConfig?.currencyLocale || 'en-IN',
        code: displayConfig?.currencyCode || 'INR',
      }),
    [displayConfig?.currencyCode, displayConfig?.currencyLocale, displayConfig?.currencySymbol],
  );

  const handlePrevMonth = () => {
    const prev = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).subtract(1, 'month');
    onNavigateMonth(prev.month() + 1, prev.year());
  };

  const handleNextMonth = () => {
    const next = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(1, 'month');
    onNavigateMonth(next.month() + 1, next.year());
  };

  const handleDatePickerChange = (d: dayjs.Dayjs | null) => {
    if (d) {
      onNavigateMonth(d.month() + 1, d.year());
    }
  };

  const handleThisMonth = () => {
    onNavigateMonth(dayjs().month() + 1, dayjs().year());
  };

  const pagination = {
    current: currentPage,
    pageSize,
    total: totalRecords,
    showSizeChanger: true,
    pageSizeOptions: ['25', '50', '100'],
    showTotal: (total: number, range: [number, number]) =>
      t('salary.pageHeader.pagination.range', { from: range[0], to: range[1], total }),
    size: 'small' as const,
    onChange: (newPage: number, newPageSize: number) => {
      if (newPageSize !== pageSize) {
        useSalaryPageStore.getState().setPageSize(newPageSize);
      } else {
        setCurrentPage(newPage);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    style: { marginTop: 8 },
  };

  const isCurrentMonth = month === dayjs().month() + 1 && year === dayjs().year();
  const canShowSelection =
    (showBulkPayments || (showPayslipGeneration && enablePayslipGeneration)) &&
    viewMode === 'table';
  const hasAnyRecords =
    viewMode === 'shift' ? shiftSummaries.length > 0 : filteredRecords.length > 0;
  const isViewLoading = loading || (viewMode === 'shift' && shiftSummariesLoading);
  const hasAnyEmployees = statusCounts.all > 0 || totalRecords > 0 || hasAnyRecords;
  const [activeShiftKeys, setActiveShiftKeys] = useState<string[]>([]);
  const activeShiftKeysRef = useRef<string[]>([]);
  const requestedShiftLoadsRef = useRef<Record<string, string>>({});
  const shiftRowsLoadingRef = useRef(shiftRowsLoadingByKey);
  const shiftPaginationRef = useRef(shiftPaginationByKey);
  const previousShiftContextRef = useRef('');
  const rowSelection: TableProps<SalaryRecord>['rowSelection'] =
    canShowSelection && onSelectionChange
      ? {
          selectedRowKeys,
          onChange: (newKeys) => {
            onSelectionChange(newKeys.map((key) => String(key)));
          },
          getCheckboxProps: (record) => {
            const name =
              (typeof record.teamMemberId === 'object' ? record.teamMemberId?.name : undefined) ??
              record.teamMember?.name ??
              'salary row';
            return {
              disabled:
                !record._id ||
                String(record._id).startsWith('new-') ||
                (record.baseSalary ?? 0) <= 0,
              // axe-core: per-row checkboxes need an accessible name.
              ...({ 'aria-label': t('salary.pageHeader.rowSelection.selectRow', { name }) } as {
                'aria-label': string;
              }),
            };
          },
          // Header select-all checkbox needs a label too.
          columnTitle: (
            <span className="sr-only">{t('salary.pageHeader.rowSelection.selectAll')}</span>
          ),
        }
      : undefined;

  const getSalaryRowKey = useCallback(
    (r: SalaryRecord) =>
      r._id ||
      (typeof r.teamMemberId === 'string' ? r.teamMemberId : r.teamMemberId?._id) ||
      r.teamMember?.id ||
      '',
    [],
  );

  const getShiftSummaryKey = useCallback(
    (summary: ShiftPayrollSummary) => summary.shiftId ?? 'unassigned',
    [],
  );

  useEffect(() => {
    activeShiftKeysRef.current = activeShiftKeys;
  }, [activeShiftKeys]);

  useEffect(() => {
    shiftRowsLoadingRef.current = shiftRowsLoadingByKey;
  }, [shiftRowsLoadingByKey]);

  useEffect(() => {
    shiftPaginationRef.current = shiftPaginationByKey;
  }, [shiftPaginationByKey]);

  const requestShiftRows = useCallback(
    async (shiftKey: string, force = false) => {
      const requestSignature = [
        shiftKey,
        month,
        year,
        search,
        statusFilter,
        sortKey,
        pageSize,
      ].join(':');

      if (!force && requestedShiftLoadsRef.current[shiftKey] === requestSignature) {
        return;
      }
      if (shiftRowsLoadingRef.current[shiftKey]) {
        return;
      }

      requestedShiftLoadsRef.current[shiftKey] = requestSignature;
      await onLoadShiftRows(shiftKey, {
        page: shiftPaginationRef.current[shiftKey]?.page ?? 1,
        limit: shiftPaginationRef.current[shiftKey]?.limit ?? pageSize,
      });
    },
    [month, onLoadShiftRows, pageSize, search, sortKey, statusFilter, year],
  );

  const shiftContextSignature = useMemo(
    () => [month, year, search, statusFilter, sortKey, pageSize].join(':'),
    [month, pageSize, search, sortKey, statusFilter, year],
  );

  useEffect(() => {
    if (viewMode !== 'shift') {
      startTransition(() => {
        setActiveShiftKeys([]);
      });
      requestedShiftLoadsRef.current = {};
      previousShiftContextRef.current = '';
      return;
    }

    requestedShiftLoadsRef.current = {};

    if (shiftSummaries.length === 1) {
      const singleShiftKey = getShiftSummaryKey(shiftSummaries[0]);
      const alreadyOpenSingleShift =
        activeShiftKeysRef.current.length === 1 && activeShiftKeysRef.current[0] === singleShiftKey;

      if (!alreadyOpenSingleShift) {
        startTransition(() => {
          setActiveShiftKeys([singleShiftKey]);
        });
        void requestShiftRows(singleShiftKey, true);
      }
      return;
    }

    startTransition(() => {
      setActiveShiftKeys((prev) =>
        prev.filter((key) => shiftSummaries.some((summary) => getShiftSummaryKey(summary) === key)),
      );
    });
  }, [getShiftSummaryKey, requestShiftRows, shiftSummaries, viewMode]);

  useEffect(() => {
    if (viewMode !== 'shift') {
      previousShiftContextRef.current = shiftContextSignature;
      return;
    }

    if (previousShiftContextRef.current === shiftContextSignature) {
      return;
    }

    previousShiftContextRef.current = shiftContextSignature;

    if (activeShiftKeys.length === 0) {
      return;
    }

    requestedShiftLoadsRef.current = {};
    activeShiftKeys.forEach((shiftKey) => {
      void requestShiftRows(shiftKey, true);
    });
  }, [activeShiftKeys, requestShiftRows, shiftContextSignature, viewMode]);

  const handleShiftPanelsChange = useCallback(
    (keys: string[] | string) => {
      const activeKeys = Array.isArray(keys) ? keys : [keys];
      const normalizedKeys = activeKeys.filter(Boolean).map(String);
      const previouslyOpen = new Set(activeShiftKeys);
      setActiveShiftKeys(normalizedKeys);
      normalizedKeys
        .filter((key) => !previouslyOpen.has(key))
        .forEach((key) => {
          void requestShiftRows(key, Boolean(shiftRowsErrorByKey[key]));
        });
    },
    [activeShiftKeys, requestShiftRows, shiftRowsErrorByKey],
  );

  const handleReload = useCallback(() => {
    if (viewMode !== 'shift') {
      onLoad();
      return;
    }

    previousShiftContextRef.current = '';
    void onLoadShiftSummaries();
  }, [onLoad, onLoadShiftSummaries, viewMode]);

  // Refresh + ⋮ overflow, rendered in two responsive slots. `includeExportBank` adds
  // Export + Bank Transfer File INSIDE the ⋮ menu - used only for the mobile slot, where
  // the inline Export/Bank buttons are hidden to declutter the toolbar. Desktop passes
  // false (Export/Bank stay inline). Each item's label is the real self-contained button
  // component (it owns its own export/bank modal), so behaviour matches the inline
  // buttons exactly. -> ExportButton, BankFileButton.
  const renderRefreshMore = (includeExportBank: boolean) => {
    const hasOtherMoreItems =
      !!onOpenComplianceExport || (showPayslipGeneration && !!onBulkEmailPayslips);
    const menuItems: MenuProps['items'] = [
      ...(includeExportBank
        ? [
            {
              key: 'export-mobile',
              label: (
                <ExportButton
                  fields={salaryExportFields}
                  getExportData={getExportData}
                  title={t('salary.pageHeader.title')}
                  filename="manekhr_payroll"
                  filterSummary={salaryFilterSummary}
                  disabled={loading || totalRecords === 0 || !canExport}
                  module="salary"
                />
              ),
            },
            ...(wsId
              ? [
                  {
                    key: 'bank-mobile',
                    label: (
                      <BankFileButton
                        wsId={wsId}
                        month={month}
                        year={year}
                        disabled={loading || totalRecords === 0}
                      />
                    ),
                  },
                ]
              : []),
            ...(hasOtherMoreItems ? [{ type: 'divider' as const }] : []),
          ]
        : []),
      ...(onOpenComplianceExport
        ? [
            {
              key: 'compliance',
              icon: <FileTextOutlined />,
              label: t('salary.pageHeader.moreMenu.complianceExport'),
              disabled: loading || totalRecords === 0,
              onClick: () => onOpenComplianceExport(),
            },
          ]
        : []),
      ...(showPayslipGeneration && onBulkEmailPayslips
        ? [
            {
              key: 'email-all-payslips',
              icon: <MailOutlined />,
              label: bulkPayslipEmailing
                ? t('salary.pageHeader.moreMenu.emailing')
                : t('salary.pageHeader.moreMenu.emailAllPayslips'),
              disabled: loading || bulkPayslipEmailing || !enablePayslipGeneration,
              onClick: () => onBulkEmailPayslips(),
            },
          ]
        : []),
    ];
    return (
      <>
        <Tooltip title={t('salary.pageHeader.refresh.label')}>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReload}
            aria-label={t('salary.pageHeader.refresh.label')}
          />
        </Tooltip>
        {menuItems.length > 0 && (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <Tooltip title={t('salary.pageHeader.moreMenu.label')}>
              <Button icon={<MoreOutlined />} aria-label={t('salary.pageHeader.moreMenu.label')} />
            </Tooltip>
          </Dropdown>
        )}
      </>
    );
  };

  return (
    <div className="salary-table-container">
      <Card variant="outlined">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {/* w-full on mobile so this group can't grow wider than the card (which was
              pushing the ⋮ off-screen); auto width inline on desktop. */}
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
            <div className="min-w-[176px]">
              <SegmentedToggle
                options={[
                  { label: t('salary.pageHeader.viewToggle.table'), value: 'table' },
                  { label: t('salary.pageHeader.viewToggle.byShift'), value: 'shift' },
                ]}
                value={viewMode}
                onChange={(value) => setViewMode(value as ViewMode)}
              />
            </div>
            {/* Mobile: refresh + ⋮ fill the empty right side of the view-toggle row
                (ml-auto). mr-1 keeps the ⋮ off the card's rounded corner (the card body
                padding is a tight 14px). Hidden on desktop (md+) where they live in the
                far-right toolbar cluster instead. */}
            <div className="mr-1 ml-auto flex items-center gap-2 md:hidden">
              {renderRefreshMore(true)}
            </div>
            {/* w-full on mobile so the date field can flex-shrink to fit; fixed inline
                row on desktop. */}
            <div className="flex w-full items-center gap-1 md:w-auto">
              <Button
                icon={<LeftOutlined />}
                onClick={handlePrevMonth}
                aria-label={t('salary.pageHeader.nav.prevMonth')}
              />
              <DatePicker
                picker="month"
                value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
                onChange={handleDatePickerChange}
                allowClear={false}
                format="MMMM YYYY"
                // Mobile: fill + shrink (min-w-0 flex-1) so the row never overflows;
                // fixed 160px on desktop.
                className="min-w-0 flex-1 md:w-40 md:flex-none"
                aria-label={t('salary.pageHeader.nav.selectMonth')}
              />
              <Button
                icon={<RightOutlined />}
                onClick={handleNextMonth}
                aria-label={t('salary.pageHeader.nav.nextMonth')}
              />
              {/* "This Month" - plain text button that mirrors the attendance module's
                  "Today" control (components/ui/DateNavigator.tsx): text label, no icon,
                  default styling, disabled on the current month. Shows the label on all
                  screens; the label is short enough that the flexing date field keeps the
                  row from overflowing on phones. whitespace-nowrap stops it wrapping. */}
              <Tooltip
                title={
                  isCurrentMonth
                    ? t('salary.pageHeader.nav.alreadyCurrentMonth')
                    : t('salary.pageHeader.nav.jumpCurrentMonth')
                }
              >
                <Button
                  onClick={handleThisMonth}
                  disabled={isCurrentMonth}
                  className="whitespace-nowrap"
                >
                  {t('salary.pageHeader.nav.thisMonth')}
                </Button>
              </Tooltip>
            </div>
          </div>
          <Space wrap size={8}>
            {/* Export + Bank Transfer File - inline on desktop; hidden on mobile, where
                they move into the ⋮ menu (renderRefreshMore(true)) to declutter the
                toolbar. gap-2 (=8px) matches the Space `size={8}` so desktop spacing is
                unchanged. */}
            <div className="hidden md:flex md:flex-wrap md:items-center md:gap-2">
              {!canExport ? (
                <Tooltip title={t('salary.pageHeader.export.upgradeTooltip')}>
                  <span>
                    <ExportButton
                      fields={salaryExportFields}
                      getExportData={getExportData}
                      title={t('salary.pageHeader.title')}
                      filename="manekhr_payroll"
                      filterSummary={salaryFilterSummary}
                      disabled={loading || totalRecords === 0}
                      module="salary"
                    />
                  </span>
                </Tooltip>
              ) : (
                <ExportButton
                  fields={salaryExportFields}
                  getExportData={getExportData}
                  title={t('salary.pageHeader.title')}
                  filename="manekhr_payroll"
                  filterSummary={salaryFilterSummary}
                  disabled={loading || totalRecords === 0 || !canExport}
                  module="salary"
                />
              )}
              {wsId && (
                <BankFileButton
                  wsId={wsId}
                  month={month}
                  year={year}
                  disabled={loading || totalRecords === 0}
                />
              )}
            </div>
            {showPayslipGeneration && onBulkPayslipDownload && (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'combined',
                      icon: <FilePdfOutlined />,
                      label: t('salary.pageHeader.payslips.combinedPdf'),
                      onClick: () => onBulkPayslipDownload('combined'),
                    },
                    {
                      key: 'zip',
                      icon: <FilePdfOutlined />,
                      label: t('salary.pageHeader.payslips.individualZip'),
                      onClick: () => onBulkPayslipDownload('zip'),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button
                  icon={<FilePdfOutlined />}
                  disabled={
                    loading || totalRecords === 0 || payslipGenerating || !enablePayslipGeneration
                  }
                >
                  {t('salary.pageHeader.payslips.button')}
                </Button>
              </Dropdown>
            )}
            {/* Desktop only: refresh + ⋮ sit at the far-right of the single toolbar
                row. On mobile they move up onto the view-toggle row (the md:hidden copy
                there), so this cluster is hidden below md. */}
            <div className="hidden items-center gap-2 md:flex">{renderRefreshMore(false)}</div>
          </Space>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {/* Mobile: search + sort share one row - search flex-grows so it is wider than
              the fixed-width sort select. Desktop: md:contents dissolves this wrapper so
              both flow inline with the status chips exactly as before (flex-1 -> flex-none
              restores the 280px search). */}
          <div className="flex w-full items-center gap-2 md:contents">
            <Input
              placeholder={t('salary.pageHeader.filters.searchPlaceholder')}
              aria-label={t('salary.pageHeader.filters.searchAriaLabel')}
              prefix={<SearchOutlined />}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="min-w-0 flex-1 md:flex-none"
              style={{ width: 280, height: 38 }}
              size="middle"
              allowClear
            />
            <Select
              value={sortKey}
              onChange={setSortKey}
              className="flex-none"
              style={{ width: 140, height: 38 }}
              size="middle"
              aria-label={t('salary.pageHeader.filters.sortAriaLabel')}
            >
              <Select.Option value="name_asc">
                {t('salary.pageHeader.filters.sortNameAsc')}
              </Select.Option>
              <Select.Option value="name_desc">
                {t('salary.pageHeader.filters.sortNameDesc')}
              </Select.Option>
              <Select.Option value="amount_asc">
                {t('salary.pageHeader.filters.sortAmountAsc')}
              </Select.Option>
              <Select.Option value="amount_desc">
                {t('salary.pageHeader.filters.sortAmountDesc')}
              </Select.Option>
              <Select.Option value="status">
                {t('salary.pageHeader.filters.sortStatus')}
              </Select.Option>
            </Select>
          </div>
          <Space wrap>
            {[
              {
                key: 'all',
                label: t('salary.pageHeader.filters.statusAll'),
                count: statusCounts.all,
              },
              {
                key: 'pending',
                label: t('salary.pageHeader.filters.statusPending'),
                count: statusCounts.pending,
              },
              {
                key: 'partial',
                label: t('salary.pageHeader.filters.statusPartial'),
                count: statusCounts.partial,
              },
              {
                key: 'advance',
                label: t('salary.pageHeader.filters.statusOverpaid'),
                count: statusCounts.advance,
              },
              {
                key: 'paid',
                label: t('salary.pageHeader.filters.statusPaid'),
                count: statusCounts.paid,
              },
              {
                key: 'not_generated',
                label: t('salary.pageHeader.filters.statusNotGenerated'),
                count: statusCounts.not_generated,
              },
              {
                key: 'salary_not_set',
                label: t('salary.pageHeader.filters.statusNoBaseSalary'),
                count: statusCounts.salary_not_set,
              },
            ].map((s) => (
              <Button
                key={s.key}
                type={statusFilter === s.key ? 'primary' : 'default'}
                size="small"
                onClick={() =>
                  setStatusFilter(statusFilter === s.key ? 'all' : (s.key as StatusFilter))
                }
              >
                {s.label}{' '}
                {s.count > 0 && (
                  <Badge
                    count={s.count}
                    style={{
                      background:
                        statusFilter === s.key ? 'var(--cr-surface, #fff)' : 'var(--cr-primary)',
                      color:
                        statusFilter === s.key
                          ? 'var(--cr-primary)'
                          : 'var(--cr-text-on-primary, #fff)',
                    }}
                  />
                )}
              </Button>
            ))}
          </Space>
          <Button
            size="small"
            type="text"
            icon={<CloseCircleOutlined />}
            disabled={!isFilterActive}
            onClick={() => {
              // Reset local input + ref first so the in-flight debounced value
              // can't propagate back up and un-clear the search. Then call the
              // parent's atomic clear handler (single router.replace + store
              // resets) so search/status/sort all clear together.
              setSearchInput('');
              latestSearchProp.current = '';
              onClearFilters();
            }}
            style={{ color: isFilterActive ? 'var(--cr-error)' : 'var(--cr-disabled-fg, #ccc)' }}
          >
            {t('salary.pageHeader.filters.clearFilters')}
          </Button>
        </div>
        {canShowSelection && selectedRowKeys.length > 0 && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-700">
                {t('salary.pageHeader.selection.selected', { count: selectedRowKeys.length })}
              </span>
              <Button size="small" type="link" onClick={onClearSelection}>
                {t('salary.pageHeader.selection.clear')}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {showBulkPayments && onOpenBulkPayment && (
                <Tooltip
                  title={
                    payableSelectedCount === 0
                      ? t('salary.pageHeader.selection.allLockedTooltip')
                      : undefined
                  }
                >
                  <Button
                    type="primary"
                    icon={<RupeeOutlined />}
                    disabled={payableSelectedCount === 0}
                    onClick={onOpenBulkPayment}
                  >
                    {lockedSelectedCount > 0
                      ? t('salary.pageHeader.selection.paySelectedWithTotal', {
                          payable: payableSelectedCount ?? selectedRowKeys.length,
                          total: selectedRowKeys.length,
                        })
                      : t('salary.pageHeader.selection.paySelected', {
                          payable: payableSelectedCount ?? selectedRowKeys.length,
                        })}
                  </Button>
                </Tooltip>
              )}
              {showPayslipGeneration && enablePayslipGeneration && onOpenBulkPayslip && (
                <Button
                  icon={<FilePdfOutlined />}
                  loading={payslipGenerating}
                  onClick={onOpenBulkPayslip}
                >
                  {t('salary.pageHeader.payslips.download', { count: selectedRowKeys.length })}
                </Button>
              )}
            </div>
          </div>
        )}
        {!hasAnyEmployees && !isViewLoading ? (
          <div className="py-12 text-center text-subtle">
            <RupeeOutlined className="mb-3 block text-[40px]" />
            <p className="m-0 text-[15px] font-semibold text-secondary">
              {t('salary.pageHeader.empty.noTeamTitle')}
            </p>
            <p className="m-0 text-[13px]">{t('salary.pageHeader.empty.noTeamBody')}</p>
          </div>
        ) : !hasAnyRecords && !isViewLoading ? (
          <div className="py-12 text-center text-subtle">
            <SearchOutlined className="mb-3 block text-[40px]" />
            <p className="m-0 text-[15px] font-semibold text-secondary">
              {t('salary.pageHeader.empty.noMatchTitle')}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <>
            {/* Mobile (sub-md) read-only card list - same pattern as the
                shift-grouped view. Bulk-select + per-row actions stay desktop. */}
            <div className="md:hidden">
              <SalaryRecordCardList
                rows={filteredRecords}
                loading={loading}
                loaded={true}
                rowKey={getSalaryRowKey}
              />
            </div>
            <div ref={tableWrapRef} className="salary-table-wrap hidden md:block">
              <Table
                columns={columns}
                dataSource={filteredRecords}
                rowKey={getSalaryRowKey}
                loading={loading}
                scroll={{ x: 900 }}
                size="middle"
                pagination={pagination}
                rowSelection={rowSelection}
                rowClassName={(r: SalaryRecord) => (r.isPreview ? 'bg-surface-2' : '')}
              />
              {/* Branded horizontal scrollbar - native bar hidden for
                  `.salary-table-wrap` in globals.css; this draws a draggable thumb
                  synced to `.ant-table-content` (+ wheel-to-horizontal). Same
                  component the Team table uses. */}
              <TableCustomScrollbar containerRef={tableWrapRef} />
            </div>
          </>
        ) : shiftSummariesLoading ? (
          <ShiftSummariesSkeleton />
        ) : shiftSummaries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-5 py-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
              <SearchOutlined className="text-[18px]" />
            </div>
            <p className="font-display text-[16px] font-semibold text-heading">
              {t('salary.pageHeader.shiftEmpty.title')}
            </p>
            <p className="mt-1 text-[13px] text-muted">{t('salary.pageHeader.shiftEmpty.body')}</p>
          </div>
        ) : (
          <div className="px-1 py-1">
            <Collapse
              ghost={false}
              activeKey={activeShiftKeys}
              onChange={handleShiftPanelsChange}
              expandIconPlacement="start"
              expandIcon={({ isActive }) => (
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200"
                  style={{
                    borderColor: isActive
                      ? 'var(--cr-primary-border,var(--cr-primary-border))'
                      : 'var(--cr-border,var(--cr-border))',
                    background: isActive
                      ? 'var(--cr-primary-light,var(--cr-primary-light))'
                      : 'var(--cr-surface-2,var(--cr-bg))',
                    color: isActive
                      ? 'var(--cr-primary,var(--cr-primary))'
                      : 'var(--cr-text-3,var(--cr-text-5))',
                  }}
                >
                  <RightOutlined
                    className="text-[12px] transition-transform duration-200"
                    style={{ transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)' }}
                  />
                </span>
              )}
              className="!border-0 !bg-transparent [&_.ant-collapse-content]:!border-t [&_.ant-collapse-content]:!border-t-border-light [&_.ant-collapse-content]:!bg-surface-2 [&_.ant-collapse-content-box]:!px-4 [&_.ant-collapse-content-box]:!pt-4 [&_.ant-collapse-content-box]:!pb-4 sm:[&_.ant-collapse-content-box]:!px-5 sm:[&_.ant-collapse-content-box]:!pb-5 [&_.ant-collapse-header]:!items-start [&_.ant-collapse-header]:!gap-4 [&_.ant-collapse-header]:!px-5 [&_.ant-collapse-header]:!py-5 sm:[&_.ant-collapse-header]:!px-6 [&_.ant-collapse-item]:!mb-4 [&_.ant-collapse-item]:!overflow-hidden [&_.ant-collapse-item]:!rounded-2xl [&_.ant-collapse-item]:!border [&_.ant-collapse-item]:!border-border [&_.ant-collapse-item]:!bg-surface [&_.ant-collapse-item]:!shadow-card [&_.ant-collapse-item:last-child]:!mb-0"
              items={shiftSummaries.map((summary) => {
                const shiftKey = getShiftSummaryKey(summary);
                const shiftTimeLabel = formatShiftWindow(
                  summary.shiftStartTime,
                  summary.shiftEndTime,
                );
                const exceptionPills = [
                  <ShiftExceptionTag
                    key="pending"
                    count={summary.pendingCount}
                    label={t('salary.pageHeader.shiftCard.exceptionPending')}
                    tone="pending"
                  />,
                  <ShiftExceptionTag
                    key="overpaid"
                    count={summary.overpaidCount}
                    label={t('salary.pageHeader.shiftCard.exceptionOverpaid')}
                    tone="advance"
                  />,
                  <ShiftExceptionTag
                    key="not-generated"
                    count={summary.notGeneratedCount}
                    label={t('salary.pageHeader.shiftCard.exceptionNotGenerated')}
                    tone="neutral"
                  />,
                  <ShiftExceptionTag
                    key="salary-not-set"
                    count={summary.salaryNotSetCount}
                    label={t('salary.pageHeader.shiftCard.exceptionNoPay')}
                    tone="neutral"
                  />,
                ].filter(Boolean);
                const metadataPills = [
                  shiftTimeLabel ? (
                    <span
                      key="shift-time"
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-body"
                    >
                      <FieldTimeOutlined className="text-[11px] text-subtle" />
                      {shiftTimeLabel}
                    </span>
                  ) : null,
                  ...exceptionPills,
                ].filter(Boolean);

                return {
                  key: shiftKey,
                  label: (
                    <div className="grid w-full grid-cols-1 gap-5 pr-1 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-display text-[18px] leading-none font-bold text-heading">
                            {summary.shiftName}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-2.5 py-1 text-[11px] font-semibold text-primary">
                            <TeamOutlined className="text-[11px]" />
                            {summary.employeeCount}{' '}
                            {summary.employeeCount === 1
                              ? t('salary.pageHeader.shiftCard.employeeOne')
                              : t('salary.pageHeader.shiftCard.employeePlural')}
                          </span>
                        </div>
                        {metadataPills.length > 0 && (
                          <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            {metadataPills}
                          </div>
                        )}
                      </div>
                      {/* 3-across on every width (was stacked full-width on phones,
                          eating ~360px). Desktop was already sm:grid-cols-3, so this only
                          compacts mobile. */}
                      <div className="grid grid-cols-3 gap-2 xl:min-w-[360px]">
                        <ShiftMetricCard
                          label={t('salary.pageHeader.shiftCard.metricPayable')}
                          value={currencyFmt.full(summary.totalPayable)}
                          valueCompact={currencyFmt.currency(summary.totalPayable)}
                          tone="primary"
                        />
                        <ShiftMetricCard
                          label={t('salary.pageHeader.shiftCard.metricPaid')}
                          value={currencyFmt.full(summary.totalPaid)}
                          valueCompact={currencyFmt.currency(summary.totalPaid)}
                          tone="success"
                        />
                        <ShiftMetricCard
                          label={t('salary.pageHeader.shiftCard.metricDue')}
                          value={currencyFmt.full(summary.totalDue)}
                          valueCompact={currencyFmt.currency(summary.totalDue)}
                          tone="warning"
                        />
                      </div>
                    </div>
                  ),
                  children: (
                    <div className="overflow-hidden rounded-xl border border-border-light bg-surface">
                      <ShiftRowsTable
                        shiftKey={shiftKey}
                        columns={columns}
                        rowKey={getSalaryRowKey}
                        rows={shiftRowsByKey[shiftKey] || []}
                        loading={Boolean(shiftRowsLoadingByKey[shiftKey])}
                        loaded={Boolean(shiftRowsLoadedByKey[shiftKey])}
                        error={shiftRowsErrorByKey[shiftKey]}
                        pagination={shiftPaginationByKey[shiftKey]}
                        onLoadShiftRows={onLoadShiftRows}
                      />
                    </div>
                  ),
                };
              })}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
