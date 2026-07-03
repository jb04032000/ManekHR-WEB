'use client';

import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarOutlined, LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import { Button, DatePicker, Empty, Input, Select, Skeleton, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { DsCard, DsPageHeader, DsTable } from '@/components/ui';
import { TableCustomScrollbar } from '@/components/ui/TableCustomScrollbar';
import { salaryApi, teamApi } from '@/lib/api';
import { useWorkspaceStore } from '@/lib/store';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import type { PaymentRegisterResponse, PaymentRegisterRow } from '@/types';
import { buildPayrollRouteHref, getPayrollRoutePeriod } from '../utils/payroll-route.utils';

function formatPaymentModeLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function RegisterMetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone: 'default' | 'success' | 'danger' | 'primary';
}) {
  const toneMap = {
    default: {
      background: 'var(--cr-surface)',
      borderColor: 'var(--cr-border,var(--cr-border))',
      labelColor: 'var(--cr-text-5)',
      valueColor: 'var(--cr-text)',
    },
    success: {
      background: 'var(--cr-success-50)',
      borderColor: 'rgba(34,197,94,0.14)',
      labelColor: 'var(--cr-success-700)',
      valueColor: 'var(--cr-success-700)',
    },
    danger: {
      background: 'var(--cr-danger-50)',
      borderColor: 'rgba(239,68,68,0.14)',
      labelColor: 'var(--cr-danger-700)',
      valueColor: 'var(--cr-danger-700)',
    },
    primary: {
      background: 'var(--cr-info-50)',
      borderColor: 'rgba(37,99,235,0.14)',
      labelColor: 'var(--cr-info-700)',
      valueColor: 'var(--cr-info-700)',
    },
  } as const;

  const colors = toneMap[tone];

  return (
    <div
      className="rounded-[24px] border px-5 py-4"
      style={{
        background: colors.background,
        borderColor: colors.borderColor,
        boxShadow: 'var(--cr-shadow-card)',
      }}
    >
      <p
        className="m-0 text-[11px] font-semibold tracking-[0.1em] uppercase"
        style={{ color: colors.labelColor }}
      >
        {label}
      </p>
      <p
        className="m-0 mt-2 text-[30px] leading-none font-bold"
        style={{ color: colors.valueColor }}
      >
        {value}
      </p>
      {sub ? (
        <p className="m-0 mt-2 text-[12px] text-[var(--cr-text-2,var(--cr-text-5))]">{sub}</p>
      ) : null}
    </div>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: 'neutral' | 'success' | 'danger' | 'warning';
  label: string;
}) {
  const toneClass = {
    neutral: 'border border-slate-200 bg-slate-100 text-slate-700',
    success: 'border border-emerald-100 bg-emerald-50 text-emerald-700',
    danger: 'border border-rose-100 bg-rose-50 text-rose-700',
    warning: 'border border-amber-100 bg-amber-50 text-amber-700',
  }[tone];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold ${toneClass}`}
    >
      {label}
    </span>
  );
}

export default function SalaryPaymentsPage() {
  const t = useTranslations('salary.payments');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { month, year } = getPayrollRoutePeriod(searchParams);
  const selectedMonthLabel = useMemo(
    () => dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY'),
    [month, year],
  );
  const currencyFmt = useCurrencyFormatter();
  // Wrapper for the desktop payments table - <TableCustomScrollbar> finds the
  // inner `.ant-table-content` and drives a branded horizontal bar (native bar
  // hidden for `.salary-table-wrap` in globals.css). Mirrors the main payroll
  // and shift tables in SalaryPageHeader.
  const tableWrapRef = useRef<HTMLDivElement>(null);
  const { currentWorkspaceId, isHydrated } = useWorkspaceStore(
    useShallow((state) => ({
      currentWorkspaceId: state.currentWorkspaceId,
      isHydrated: state.isHydrated,
    })),
  );

  const teamMemberId = searchParams.get('teamMemberId') ?? undefined;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'reversed'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [register, setRegister] = useState<PaymentRegisterResponse | null>(null);
  const [focusMemberName, setFocusMemberName] = useState<string | null>(null);

  const replacePeriod = useCallback(
    (nextMonth: number, nextYear: number) => {
      router.replace(
        buildPayrollRouteHref(pathname, searchParams, {
          month: String(nextMonth),
          year: String(nextYear),
        }),
        { scroll: false },
      );
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const queryMonth = searchParams.get('month');
    const queryYear = searchParams.get('year');

    if (!queryMonth || !queryYear) {
      replacePeriod(month, year);
    }
  }, [month, replacePeriod, searchParams, year]);

  useEffect(() => {
    startTransition(() => {
      setPage(1);
    });
  }, [month, search, status, teamMemberId, year]);

  const loadRegister = useCallback(async () => {
    if (!currentWorkspaceId || !isHydrated) {
      return;
    }

    startTransition(() => {
      setLoading(true);
    });
    try {
      const data = await salaryApi.getPaymentRegister(currentWorkspaceId, {
        month,
        year,
        page,
        limit: pageSize,
        search: search.trim() || undefined,
        status,
        teamMemberId,
      });
      startTransition(() => {
        setRegister(data);
        setError(null);
        // Resolve member name from first matching row when available.
        if (teamMemberId && data.records.length > 0) {
          const firstRow = data.records[0];
          if (firstRow.teamMemberName && firstRow.teamMemberName !== 'Unknown employee') {
            setFocusMemberName(firstRow.teamMemberName);
          }
        }
      });
    } catch (err) {
      startTransition(() => {
        setError(parseApiError(err));
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [currentWorkspaceId, isHydrated, month, page, pageSize, search, status, teamMemberId, year]);

  useEffect(() => {
    void loadRegister();
  }, [loadRegister]);

  // When teamMemberId changes clear the stale name so the chip shows the
  // generic fallback until the new name is resolved.
  useEffect(() => {
    if (!teamMemberId) {
      setFocusMemberName(null);
    }
  }, [teamMemberId]);

  // Fallback: if the register returned no rows for this member (e.g. no
  // payments in the current month), fetch the name from the team API once.
  useEffect(() => {
    if (!teamMemberId || !currentWorkspaceId || !isHydrated || focusMemberName) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const member = await teamApi.get(currentWorkspaceId, teamMemberId);
        if (!cancelled && member.name) {
          startTransition(() => {
            setFocusMemberName(member.name);
          });
        }
      } catch {
        // Name stays null; generic fallback label will be shown.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, focusMemberName, isHydrated, teamMemberId]);

  const columns = useMemo<ColumnsType<PaymentRegisterRow>>(
    () => [
      {
        title: 'Payment',
        key: 'payment',
        render: (_, record) => {
          const isUnavailable =
            !record.teamMemberName || record.teamMemberName === 'Unknown employee';
          return (
            <div className="space-y-1">
              <p
                className={`m-0 text-[15px] font-semibold ${
                  isUnavailable ? 'text-[var(--cr-text-2,var(--cr-text-5))]' : 'text-heading'
                }`}
              >
                {isUnavailable ? 'Employee unavailable' : record.teamMemberName}
              </p>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[12px] text-[var(--cr-text-2,var(--cr-text-5))]">
                <span>{dayjs(record.paymentDate).format('DD MMM YYYY')}</span>
                <span>
                  Salary period{' '}
                  {dayjs(
                    `${record.salaryYear}-${String(record.salaryMonth).padStart(2, '0')}-01`,
                  ).format('MMM YYYY')}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        title: 'Method',
        key: 'method',
        render: (_, record) => (
          <div className="space-y-2">
            <StatusPill tone="neutral" label={formatPaymentModeLabel(record.paymentMode)} />
            {record.splitCount > 0 ? (
              <p className="m-0 text-[11px] text-[var(--cr-text-2,var(--cr-text-5))]">
                {record.splitCount} split line{record.splitCount > 1 ? 's' : ''}
              </p>
            ) : null}
          </div>
        ),
      },
      {
        title: 'Credited',
        key: 'credited',
        align: 'right',
        render: (_, record) => (
          <div className="space-y-1 text-right">
            <p className="m-0 text-[15px] font-semibold text-heading">
              {currencyFmt.full(record.creditedAmount)}
            </p>
            {(record.commission ?? 0) > 0 ? (
              <p className="m-0 text-[11px] text-[var(--cr-text-2,var(--cr-text-5))]">
                Base {currencyFmt.full(record.amount)} + Commission{' '}
                {currencyFmt.full(record.commission)}
              </p>
            ) : (
              <p className="m-0 text-[11px] text-[var(--cr-text-2,var(--cr-text-5))]">
                Base credit {currencyFmt.full(record.amount)}
              </p>
            )}
          </div>
        ),
      },
      {
        title: 'Status',
        key: 'status',
        render: (_, record) => (
          <div className="flex flex-wrap gap-2">
            <StatusPill
              tone={record.status === 'reversed' ? 'danger' : 'success'}
              label={record.status === 'reversed' ? 'Reversed' : 'Active'}
            />
            {record.isAdvance && record.advanceForYear && record.advanceForMonth ? (
              <StatusPill
                tone="warning"
                label={`Advance for ${dayjs(
                  `${record.advanceForYear}-${String(record.advanceForMonth).padStart(2, '0')}-01`,
                ).format('MMM YYYY')}`}
              />
            ) : null}
          </div>
        ),
      },
      {
        title: 'Reference',
        key: 'reference',
        render: (_, record) => (
          <div className="space-y-1">
            <p className="m-0 text-[13px] font-medium text-heading">
              {record.referenceNo || 'No reference'}
            </p>
            <p className="m-0 text-[11px] text-[var(--cr-text-2,var(--cr-text-5))]">
              {record.paidBy || 'Payer not noted'}
            </p>
            {record.proofAttached ? (
              <p className="m-0 text-[11px] text-[var(--cr-primary,var(--cr-info-500))]">
                Proof attached
              </p>
            ) : null}
          </div>
        ),
      },
      {
        title: 'Actions',
        key: 'actions',
        align: 'right',
        render: (_, record) => (
          <Button
            type="link"
            className="px-0 font-semibold"
            onClick={() =>
              router.push(
                buildPayrollRouteHref('/dashboard/salary/run-payroll', searchParams, {
                  month: String(record.salaryMonth),
                  year: String(record.salaryYear),
                  teamMemberId: record.teamMemberId,
                }),
              )
            }
          >
            Open payroll row
          </Button>
        ),
      },
    ],
    [currencyFmt, router, searchParams],
  );

  return (
    <div className="space-y-6">
      <DsPageHeader title={t('pageTitle')} sub={t('pageSubtitle')} />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-[11px] font-semibold tracking-[0.12em] text-[var(--cr-primary,var(--cr-info-500))] uppercase">
              Payments Register
            </p>
            {register ? (
              <>
                <StatusPill tone="success" label={`${register.summary.activeCount} active`} />
                <StatusPill tone="danger" label={`${register.summary.reversedCount} reversed`} />
                {register.summary.advanceCount > 0 ? (
                  <StatusPill tone="warning" label={`${register.summary.advanceCount} advance`} />
                ) : null}
              </>
            ) : null}
          </div>
          <h1 className="m-0 mt-3 text-[34px] leading-tight font-bold text-heading">
            Review payroll money movement
          </h1>
          <p className="m-0 mt-3 max-w-3xl text-[15px] leading-7 text-[var(--cr-text-2,var(--cr-text-5))]">
            Review payments linked to the selected payroll period, trace advance spillovers, and
            jump directly back to the payroll row that created each entry.
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-[24px] border border-[var(--cr-border,var(--cr-border))] bg-white p-3 shadow-[var(--cr-shadow-card)]">
            <div className="flex items-center gap-2">
              <Button
                icon={<LeftOutlined />}
                aria-label="Previous month"
                onClick={() => {
                  const next = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).subtract(
                    1,
                    'month',
                  );
                  replacePeriod(next.month() + 1, next.year());
                }}
              />
              <DatePicker
                picker="month"
                allowClear={false}
                aria-label="Select month"
                value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
                format="MMMM YYYY"
                className="flex-1"
                onChange={(value) => {
                  if (!value) return;
                  replacePeriod(value.month() + 1, value.year());
                }}
              />
              <Button
                icon={<RightOutlined />}
                aria-label="Next month"
                onClick={() => {
                  const next = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(
                    1,
                    'month',
                  );
                  replacePeriod(next.month() + 1, next.year());
                }}
              />
              <Button
                icon={<CalendarOutlined />}
                onClick={() => {
                  const today = dayjs();
                  replacePeriod(today.month() + 1, today.year());
                }}
              >
                This Month
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="primary"
              size="large"
              className="h-12 rounded-2xl font-semibold"
              onClick={() =>
                router.push(
                  buildPayrollRouteHref('/dashboard/salary/run-payroll', searchParams, {
                    month: String(month),
                    year: String(year),
                  }),
                )
              }
            >
              Open Run Payroll
            </Button>
            <Button
              size="large"
              className="h-12 rounded-2xl font-semibold"
              onClick={() =>
                router.push(
                  buildPayrollRouteHref('/dashboard/salary', searchParams, {
                    month: String(month),
                    year: String(year),
                  }),
                )
              }
            >
              Back to Overview
            </Button>
          </div>
        </div>
      </section>

      {loading && !register ? (
        <DsCard className="rounded-[28px]" styles={{ body: { padding: 24 } }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </DsCard>
      ) : error ? (
        <DsCard className="rounded-[28px]" styles={{ body: { padding: 24 } }}>
          <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={() => void loadRegister()}>
              Retry payments register
            </Button>
          </Empty>
        </DsCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RegisterMetricCard
              label={`Credited for ${selectedMonthLabel}`}
              value={currencyFmt.full(register?.summary.totalCredited ?? 0)}
              sub={`${register?.summary.activeCount ?? 0} active entries`}
              tone="primary"
            />
            <RegisterMetricCard
              label="Reversed value"
              value={currencyFmt.full(register?.summary.totalReversed ?? 0)}
              sub={`${register?.summary.reversedCount ?? 0} reversed entries`}
              tone="danger"
            />
            <RegisterMetricCard
              label="Advance payments"
              value={register?.summary.advanceCount ?? 0}
              sub="Cross-month recovery entries"
              tone="default"
            />
            <RegisterMetricCard
              label="Split entries"
              value={register?.summary.splitCount ?? 0}
              sub="Payments with multiple settlement lines"
              tone="success"
            />
          </div>

          <DsCard className="rounded-[28px]" styles={{ body: { padding: 24 } }}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_440px] xl:items-end">
              <div className="min-w-0">
                <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
                  Payment operations
                </p>
                <h2 className="m-0 mt-1 text-[28px] leading-tight font-bold text-heading">
                  Payroll-period register
                </h2>
                <p className="m-0 mt-2 text-[14px] leading-6 text-[var(--cr-text-2,var(--cr-text-5))]">
                  Search by employee, payer, note, or reference. This register follows the selected
                  salary month, while still showing the actual payment date on each row.
                </p>
              </div>

              <div className="space-y-2">
                {teamMemberId ? (
                  <div>
                    <Tag
                      closable
                      onClose={() => {
                        router.replace(
                          buildPayrollRouteHref(pathname, searchParams, { teamMemberId: null }),
                          { scroll: false },
                        );
                      }}
                      color="blue"
                      className="rounded-full px-3 py-1 text-[13px] font-medium"
                    >
                      {focusMemberName
                        ? t('showingMember', { name: focusMemberName })
                        : t('showingMemberGeneric')}
                    </Tag>
                  </div>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_170px]">
                  <Input.Search
                    allowClear
                    placeholder="Search employee, payer, note, or reference"
                    aria-label="Search payments"
                    value={searchDraft}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSearchDraft(nextValue);
                      if (!nextValue) {
                        setSearch('');
                      }
                    }}
                    onSearch={(value) => {
                      setSearch(value.trim());
                    }}
                  />
                  <Select
                    value={status}
                    onChange={(value) => setStatus(value)}
                    aria-label="Filter by status"
                    options={[
                      { value: 'all', label: 'All statuses' },
                      { value: 'active', label: 'Active only' },
                      { value: 'reversed', label: 'Reversed only' },
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="mt-6">
              {/* Mobile (sub-md) card-list. The DsTable below has 6 columns
                  totalling ~1120px and forces horizontal scroll on phones,
                  hiding most fields. The cards surface the key payment info
                  (employee, period/date, amount, status, method) and are
                  tap-navigable to the run-payroll detail for the row's
                  month + employee. */}
              <div className="flex flex-col gap-2 md:hidden">
                {loading ? (
                  <div className="py-8 text-center text-sm text-[var(--cr-text-2,var(--cr-text-5))]">
                    Loading…
                  </div>
                ) : (register?.records?.length ?? 0) === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No payments match this month and filter combination."
                  />
                ) : (
                  (register?.records ?? []).map((record) => {
                    const isUnavailable =
                      !record.teamMemberName || record.teamMemberName === 'Unknown employee';
                    return (
                      <button
                        key={record._id}
                        type="button"
                        onClick={() =>
                          router.push(
                            buildPayrollRouteHref('/dashboard/salary/run-payroll', searchParams, {
                              month: String(record.salaryMonth),
                              year: String(record.salaryYear),
                              teamMemberId: record.teamMemberId,
                            }),
                          )
                        }
                        className="rounded-xl border border-border-light bg-surface p-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-[14px] font-semibold ${isUnavailable ? 'text-[var(--cr-text-2,var(--cr-text-5))]' : 'text-heading'}`}
                          >
                            {isUnavailable ? 'Employee unavailable' : record.teamMemberName}
                          </span>
                          <StatusPill
                            tone={record.status === 'reversed' ? 'danger' : 'success'}
                            label={record.status === 'reversed' ? 'Reversed' : 'Active'}
                          />
                        </div>
                        <div className="mb-2 text-[12px] text-[var(--cr-text-2,var(--cr-text-5))]">
                          {dayjs(record.paymentDate).format('DD MMM YYYY')}
                          {' · '}
                          Salary{' '}
                          {dayjs(
                            `${record.salaryYear}-${String(record.salaryMonth).padStart(2, '0')}-01`,
                          ).format('MMM YYYY')}
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[16px] font-semibold text-heading">
                            {currencyFmt.full(record.creditedAmount)}
                          </span>
                          <span className="text-[11px] text-[var(--cr-text-2,var(--cr-text-5))]">
                            {formatPaymentModeLabel(record.paymentMode)}
                            {record.referenceNo ? ` · ${record.referenceNo}` : ''}
                          </span>
                        </div>
                        {record.isAdvance && record.advanceForYear && record.advanceForMonth ? (
                          <div className="mt-2">
                            <StatusPill
                              tone="warning"
                              label={`Advance for ${dayjs(`${record.advanceForYear}-${String(record.advanceForMonth).padStart(2, '0')}-01`).format('MMM YYYY')}`}
                            />
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Desktop / tablet table - md+ */}
              <div ref={tableWrapRef} className="salary-table-wrap hidden md:block">
                <DsTable<PaymentRegisterRow>
                  rowKey="_id"
                  columns={columns}
                  dataSource={register?.records || []}
                  loading={loading}
                  rowClassName={() =>
                    'transition-colors hover:bg-[var(--cr-surface-2,var(--cr-bg))]'
                  }
                  pagination={{
                    current: register?.pagination.page ?? page,
                    pageSize: register?.pagination.limit ?? pageSize,
                    total: register?.pagination.total ?? 0,
                    showSizeChanger: true,
                    pageSizeOptions: ['25', '50', '100'],
                    onChange: (nextPage, nextPageSize) => {
                      setPage(nextPage);
                      setPageSize(nextPageSize);
                    },
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} payments`,
                  }}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No payments match this month and filter combination."
                      />
                    ),
                  }}
                  scrollX={1120}
                  // sticky={false} so the table renders a single `.ant-table-content`
                  // scroller (not the sticky header's `.ant-table-body` + AntD sticky
                  // scroll bar). That lets the branded scrollbar below reuse the same
                  // `.salary-table-wrap` + `.ant-table-content` pattern as the main
                  // payroll table, and hides AntD's own bottom scroll bar.
                  sticky={false}
                />
                {/* Branded horizontal scrollbar - native bar hidden for
                    `.salary-table-wrap` in globals.css; this draws a draggable thumb
                    synced to `.ant-table-content` (+ wheel-to-horizontal). Same
                    component the main payroll and Team tables use. */}
                <TableCustomScrollbar containerRef={tableWrapRef} />
              </div>
            </div>
          </DsCard>
        </>
      )}
    </div>
  );
}
