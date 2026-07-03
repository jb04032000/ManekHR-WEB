'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Progress, Skeleton, Table, Tag, Typography } from 'antd';
import { DownloadOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useTranslations } from 'next-intl';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { salaryApi } from '@/lib/api/modules/salary.api';
import { downloadSinglePayslip, type PayslipData } from '@/lib/export/generatePayslipPdf';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import { DsPageHeader } from '@/components/ui';
import { Can } from '@/components/rbac/Can';
// Worker self-service advance: CTA opens the request drawer; the list shows live status.
// Links: AdvanceRequestDrawer + MyAdvanceRequests (same folder, worker bundle).
import { AdvanceRequestDrawer } from '@/components/dashboard/salary/AdvanceRequestDrawer';
import { MyAdvanceRequests } from '@/components/dashboard/salary/MyAdvanceRequests';
// Worker self-service 0% loan: CTA opens the apply drawer; the list shows live status.
// Links: LoanRequestDrawer + MyLoanRequests (same folder, worker bundle). Gated on
// salary.request_loan@self + the loanManagement subscription feature.
import { LoanRequestDrawer } from '@/components/dashboard/salary/LoanRequestDrawer';
import { MyLoanRequests } from '@/components/dashboard/salary/MyLoanRequests';
// Phase 3a: reporting-person advance review card. Gated on review_advance permission.
// Links: TeamAdvanceReviewCard (same folder), salary.api listAdvanceRequestsForMyReports.
import { TeamAdvanceReviewCard } from '@/components/dashboard/salary/TeamAdvanceReviewCard';
import type {
  Form16Data,
  GratuityLedger,
  LedgerMonth,
  LedgerRecord,
  OutstandingAdvancesResponse,
} from '@/types';

const { Text } = Typography;

interface InstallmentRow {
  month: number;
  year: number;
  amount: number;
  status: string;
  index: number;
}

const INSTALLMENT_STATUS_COLOR: Record<string, string> = {
  scheduled: 'default',
  applied: 'success',
  reversed: 'error',
  carried: 'warning',
};

function formatMonthLabel(month: number, year: number): string {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY');
}

/**
 * Derive recovered/remaining amounts for a single advance.
 *
 * Recovery deductions for every future month are created eagerly up front, so
 * every installment carries status 'applied' from day one. "Recovered" must
 * therefore mean installments whose target month/year has ELAPSED (strictly
 * before the current calendar month/year), NOT status === 'applied'. This
 * mirrors the backend's refreshPlanProgress / outstanding computation: an
 * installment counts as recovered only once its month has passed; the current
 * month and all future months remain outstanding (the current month's pay may
 * not be finalized yet). Reversed installments were undone and never count.
 *
 * total comes from the top-level `amount` field on the advance.
 */
function deriveAdvanceProgress(
  total: number,
  installments:
    | Array<{ month: number; year: number; amount: number; status: string; index: number }>
    | undefined,
  currentMonth: number,
  currentYear: number,
): { recovered: number; remaining: number; pct: number } {
  if (!installments || installments.length === 0) {
    return { recovered: 0, remaining: total, pct: 0 };
  }
  const recovered = installments
    .filter((i) => i.status !== 'reversed')
    .filter((i) => i.year < currentYear || (i.year === currentYear && i.month < currentMonth))
    .reduce((sum, i) => sum + i.amount, 0);
  const remaining = Math.max(0, total - recovered);
  const pct = total > 0 ? Math.round((recovered / total) * 100) : 0;
  return { recovered, remaining, pct };
}

interface InstallmentScheduleTableProps {
  paymentId: string;
  rows: InstallmentRow[];
  colMonth: string;
  colAmount: string;
  colStatus: string;
  labelScheduled: string;
  labelApplied: string;
  labelReversed: string;
  labelCarried: string;
}

function statusLabel(
  s: string,
  labels: Pick<
    InstallmentScheduleTableProps,
    'labelScheduled' | 'labelApplied' | 'labelReversed' | 'labelCarried'
  >,
): string {
  if (s === 'scheduled') return labels.labelScheduled;
  if (s === 'applied') return labels.labelApplied;
  if (s === 'reversed') return labels.labelReversed;
  if (s === 'carried') return labels.labelCarried;
  return s;
}

function InstallmentScheduleTable({
  paymentId,
  rows,
  colMonth,
  colAmount,
  colStatus,
  ...labels
}: InstallmentScheduleTableProps) {
  const columns: ColumnsType<InstallmentRow> = [
    {
      title: colMonth,
      key: 'month',
      render: (_: unknown, row: InstallmentRow) => formatMonthLabel(row.month, row.year),
    },
    {
      title: colAmount,
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (v: number) => <span className="tabular-nums">{formatCurrencyFull(v)}</span>,
    },
    {
      title: colStatus,
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => (
        <Tag color={INSTALLMENT_STATUS_COLOR[s] ?? 'default'}>{statusLabel(s, labels)}</Tag>
      ),
    },
  ];

  return (
    <Table<InstallmentRow>
      rowKey={(row) => `${paymentId}-${row.year}-${row.month}-${row.index}`}
      size="small"
      dataSource={rows}
      pagination={false}
      className="mt-1"
      columns={columns}
      scroll={{ x: 'max-content' }}
    />
  );
}

const STATUS_COLOR: Record<LedgerMonth['status'], string> = {
  paid: 'success',
  partial: 'warning',
  pending: 'default',
  advance: 'processing',
};

/**
 * Self-scoped salary surface (Access Control Initiative - Salary A2). Rendered
 * by the salary route scope-gate for a member whose salary access is self.
 * Read-only, own data only: the server self-filters every endpoint to the
 * caller's own teamMemberId, so this component just renders what the API
 * returns. Payslip history comes from the self-guarded ledger; each row's PDF
 * is fetched on demand from the own-payslip endpoint and rendered client-side.
 */
export default function MySalary() {
  const t = useTranslations('salary.mySalary');
  const { currentWorkspaceId } = useWorkspaceStore();
  const { data: perm, can } = useMyPermissions();
  const { message } = App.useApp();
  const teamMemberId = perm?.teamMemberId ?? null;
  const { payslipGeneration, advancePayments, loanManagement } = useSalaryFeatures();
  const canDownload = payslipGeneration.enabled;

  const [ledger, setLedger] = useState<LedgerRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [advances, setAdvances] = useState<OutstandingAdvancesResponse | null>(null);
  const [gratuity, setGratuity] = useState<GratuityLedger | null>(null);
  const [form16, setForm16] = useState<Form16Data | null>(null);
  // Self-service advance request drawer + a refresh signal for the requests list.
  const [advanceDrawerOpen, setAdvanceDrawerOpen] = useState(false);
  const [advanceRefreshKey, setAdvanceRefreshKey] = useState(0);
  // Self-service 0% loan apply drawer + a refresh signal for the loan-requests list.
  const [loanDrawerOpen, setLoanDrawerOpen] = useState(false);
  const [loanRefreshKey, setLoanRefreshKey] = useState(0);
  // Outstanding loan balance (rupees) for the header tile; null = not loaded /
  // loan module off.
  const [loanOutstanding, setLoanOutstanding] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !teamMemberId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // getLedger is typed LedgerRecord[] but the backend returns a single
      // LedgerRecord; mirror the Array.isArray guard used by useQuickPayslipEmail
      // and the team page. months come sorted most-recent-first from the API
      // (getLedgerHistory sorts year desc, month desc), so months[0] is latest.
      const res = await salaryApi.getLedger(currentWorkspaceId, teamMemberId);
      const record = (Array.isArray(res) ? res[0] : res) as LedgerRecord | undefined;
      setLedger(record ?? null);
    } catch (e) {
      setLedger(null);
      message.error(parseApiError(e) || t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, teamMemberId, message, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadExtras = useCallback(async () => {
    if (!currentWorkspaceId || !teamMemberId) return;
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const fy = month >= 4 ? year : year - 1;
    const [adv, grat, f16, loanOut] = await Promise.allSettled([
      salaryApi.getOutstandingAdvances(currentWorkspaceId, teamMemberId),
      salaryApi.getGratuityLedger(currentWorkspaceId, teamMemberId),
      salaryApi.getForm16Data(currentWorkspaceId, teamMemberId, fy),
      // Loan-balance tile. Self-scoped endpoint; only called when the loan
      // module is on (a locked plan would 403 and the tile is hidden anyway).
      loanManagement.enabled
        ? salaryApi.getMemberLoanOutstanding(currentWorkspaceId, teamMemberId)
        : Promise.resolve(null),
    ]);
    setAdvances(adv.status === 'fulfilled' ? adv.value : null);
    setGratuity(grat.status === 'fulfilled' ? grat.value : null);
    setForm16(f16.status === 'fulfilled' ? f16.value : null);
    setLoanOutstanding(loanOut.status === 'fulfilled' ? loanOut.value : null);
  }, [currentWorkspaceId, teamMemberId, loanManagement.enabled]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  const months = useMemo(() => ledger?.months ?? [], [ledger]);

  // Current calendar month/year, derived once via the same new Date() approach
  // used for the recovery banner below. Threaded into deriveAdvanceProgress so
  // the progress bar and the banner agree on what "current" means.
  const { currentMonth, currentYear } = useMemo(() => {
    const now = new Date();
    return { currentMonth: now.getMonth() + 1, currentYear: now.getFullYear() };
  }, []);

  // Header-tile figures (owner spec 2026-07-03): current month's FULL salary
  // (baseSalary - NOT the attendance-accrued net, which climbs day by day and
  // reads as a wrong number mid-month) + the advance taken against the month +
  // pending = full salary minus everything already paid.
  const thisMonth = useMemo(() => {
    const key = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const row = months.find((m) => m.monthKey === key);
    const fullSalary = row?.baseSalary || row?.salary || 0;
    let advanceTaken = 0;
    for (const adv of advances?.advances ?? []) {
      if (adv.advanceForMonth === currentMonth && adv.advanceForYear === currentYear) {
        advanceTaken += adv.amount;
      }
    }
    return {
      salary: fullSalary,
      pending: Math.max(0, fullSalary - (row?.paid ?? 0)),
      advanceTaken,
    };
  }, [months, advances, currentMonth, currentYear]);

  // Current-month recovery: sum installment amounts for the current calendar month/year
  const currentMonthRecovery = useMemo(() => {
    if (!advances) return 0;
    let total = 0;
    for (const adv of advances.advances) {
      for (const inst of adv.installments ?? []) {
        if (inst.month === currentMonth && inst.year === currentYear) {
          total += inst.amount;
        }
      }
    }
    return total;
  }, [advances, currentMonth, currentYear]);

  const handleDownload = useCallback(
    async (salaryId: string) => {
      if (!currentWorkspaceId || !teamMemberId) return;
      setDownloadingId(salaryId);
      try {
        const data = await salaryApi.getOwnPayslip(currentWorkspaceId, teamMemberId, salaryId);
        await downloadSinglePayslip(data as unknown as PayslipData);
      } catch (e) {
        message.error(parseApiError(e) || t('downloadFailed'));
      } finally {
        setDownloadingId(null);
      }
    },
    [currentWorkspaceId, teamMemberId, message, t],
  );

  const columns = useMemo<ColumnsType<LedgerMonth>>(
    () => [
      { title: t('colMonth'), dataIndex: 'monthLabel', key: 'monthLabel' },
      {
        title: t('colNet'),
        dataIndex: 'salary',
        key: 'salary',
        render: (v: number) => <span className="tabular-nums">{formatCurrencyFull(v)}</span>,
      },
      {
        title: t('colStatus'),
        dataIndex: 'status',
        key: 'status',
        render: (s: LedgerMonth['status']) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
      },
      ...(canDownload
        ? [
            {
              title: t('colAction'),
              key: 'action',
              render: (_: unknown, row: LedgerMonth) => (
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={downloadingId === row.salaryId}
                  onClick={() => handleDownload(row.salaryId)}
                >
                  {t('download')}
                </Button>
              ),
            },
          ]
        : []),
    ],
    [t, canDownload, downloadingId, handleDownload],
  );

  return (
    <div className="flex flex-col gap-4">
      <DsPageHeader title={t('title')} sub={t('subtitle')} />

      {!loading && !teamMemberId && (
        <Card style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}>
          <p className="m-0 text-[13px] text-subtle">{t('noRecord')}</p>
        </Card>
      )}

      {(loading || teamMemberId) && (
        <>
          {/* Header cards (owner spec 2026-07-03, final): total money RECEIVED
              in hand since joining, this month's salary with advance + pending,
              and the loan balance. Colored-card style mirrors the owner's Run
              Payroll SalarySummaryCards (same radius/padding/typography). */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {loading ? (
              [0, 1, 2].map((i) => (
                <Skeleton.Button key={i} active block style={{ height: 80, borderRadius: 14 }} />
              ))
            ) : (
              <>
                <div
                  className="flex items-center gap-3 rounded-[14px] px-4 py-3 sm:gap-3.5 sm:px-5 sm:py-4"
                  style={{ background: 'var(--cr-success-50)' }}
                >
                  <span style={{ color: 'var(--cr-success-700)' }}>
                    <CheckCircleOutlined className="text-[22px] sm:text-[28px]" />
                  </span>
                  <div>
                    <p
                      className="m-0 font-display text-lg font-extrabold sm:text-xl"
                      style={{ color: 'var(--cr-success-700)' }}
                    >
                      {formatCurrencyFull(ledger?.totalPaid ?? 0)}
                    </p>
                    <p className="m-0 text-xs text-muted">
                      {t('statTotalPaid')} · {t('statSinceJoining')}
                    </p>
                  </div>
                </div>
                <div
                  className="flex items-center gap-3 rounded-[14px] px-4 py-3 sm:gap-3.5 sm:px-5 sm:py-4"
                  style={{ background: 'var(--cr-violet-bg)' }}
                >
                  <span style={{ color: 'var(--cr-violet)' }}>
                    <RupeeOutlined className="text-[22px] sm:text-[28px]" />
                  </span>
                  <div>
                    <p
                      className="m-0 font-display text-lg font-extrabold sm:text-xl"
                      style={{ color: 'var(--cr-violet)' }}
                    >
                      {formatCurrencyFull(thisMonth.salary)}
                    </p>
                    <p className="m-0 text-xs text-muted">
                      {t('statThisMonthSalary')} · {t('statAdvanceTaken')}{' '}
                      {formatCurrencyFull(thisMonth.advanceTaken)} · {t('statPendingPay')}{' '}
                      {formatCurrencyFull(thisMonth.pending)}
                    </p>
                  </div>
                </div>
                {loanManagement.enabled && (
                  <div
                    className="flex items-center gap-3 rounded-[14px] px-4 py-3 sm:gap-3.5 sm:px-5 sm:py-4"
                    style={{ background: 'var(--cr-warning-50)' }}
                  >
                    <span style={{ color: 'var(--cr-warning-500)' }}>
                      <ClockCircleOutlined className="text-[22px] sm:text-[28px]" />
                    </span>
                    <div>
                      <p
                        className="m-0 font-display text-lg font-extrabold sm:text-xl"
                        style={{ color: 'var(--cr-warning-500)' }}
                      >
                        {formatCurrencyFull(loanOutstanding ?? 0)}
                      </p>
                      <p className="m-0 text-xs text-muted">
                        {t('statLoanBalance')} · {t('statLoanBalanceHint')}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <Card
            title={<span className="font-display font-bold">{t('historyTitle')}</span>}
            loading={loading}
            style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}
            styles={{ body: { padding: 16 } }}
          >
            <Table<LedgerMonth>
              rowKey="salaryId"
              size="small"
              columns={columns}
              dataSource={months}
              pagination={false}
              locale={{ emptyText: t('empty') }}
              scroll={{ x: 'max-content' }}
            />
          </Card>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Card
              title={t('advancesTitle')}
              extra={
                advancePayments.enabled ? (
                  <Can module="salary" action="request_advance" scope="self">
                    <Button type="primary" size="small" onClick={() => setAdvanceDrawerOpen(true)}>
                      {t('requestAdvanceCta')}
                    </Button>
                  </Can>
                ) : undefined
              }
              style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}
            >
              {advances && advances.outstanding > 0 ? (
                <div className="flex flex-col gap-3">
                  {currentMonthRecovery > 0 && (
                    <Alert
                      type="info"
                      showIcon
                      title={t('advanceRecoveryBannerTitle')}
                      description={t('advanceRecoveryBannerDesc', {
                        amount: formatCurrencyFull(currentMonthRecovery),
                      })}
                    />
                  )}
                  <div>
                    <p className="m-0 text-[11px] font-semibold tracking-wide text-faint uppercase">
                      {t('advancesOutstanding')}
                    </p>
                    <p className="m-0 text-[18px] font-bold tabular-nums">
                      {formatCurrencyFull(advances.outstanding)}
                    </p>
                  </div>
                  {advances.advances.map((adv) => {
                    const { recovered, remaining, pct } = deriveAdvanceProgress(
                      adv.amount,
                      adv.installments,
                      currentMonth,
                      currentYear,
                    );
                    return (
                      <div key={adv.paymentId} className="mt-1 flex flex-col gap-2">
                        {adv.installments && adv.installments.length > 0 && (
                          <>
                            <Text className="text-[11px] text-muted">
                              {t('advanceScheduleCaption', { count: adv.installments.length })}
                            </Text>
                            <div>
                              <Progress
                                percent={pct}
                                size="small"
                                status="active"
                                strokeColor="var(--cr-primary, #1677ff)"
                              />
                              <p className="m-0 text-[11px] text-muted tabular-nums">
                                {t('advanceProgressCaption', {
                                  recovered: formatCurrencyFull(recovered),
                                  total: formatCurrencyFull(adv.amount),
                                  remaining: formatCurrencyFull(remaining),
                                })}
                              </p>
                            </div>
                            <InstallmentScheduleTable
                              paymentId={adv.paymentId}
                              rows={adv.installments as InstallmentRow[]}
                              colMonth={t('advanceColMonth')}
                              colAmount={t('advanceColAmount')}
                              colStatus={t('advanceColStatus')}
                              labelScheduled={t('advanceStatusScheduled')}
                              labelApplied={t('advanceStatusApplied')}
                              labelReversed={t('advanceStatusReversed')}
                              labelCarried={t('advanceStatusCarried')}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="m-0 text-[13px] text-subtle">{t('sectionEmpty')}</p>
              )}
            </Card>
            <Card
              title={t('gratuityTitle')}
              style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}
            >
              {gratuity ? (
                <div>
                  <p className="m-0 text-[11px] font-semibold tracking-wide text-faint uppercase">
                    {t('gratuityAccrued')}
                  </p>
                  <p className="m-0 text-[18px] font-bold tabular-nums">
                    {formatCurrencyFull(gratuity.gratuityAmount)}
                  </p>
                </div>
              ) : (
                <p className="m-0 text-[13px] text-subtle">{t('sectionEmpty')}</p>
              )}
            </Card>
            <Card
              title={t('form16Title')}
              style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}
            >
              {form16 && form16.monthlyBreakdown.length > 0 ? (
                <span className="text-[13px]">{t('form16View')}</span>
              ) : (
                <p className="m-0 text-[13px] text-subtle">{t('sectionEmpty')}</p>
              )}
            </Card>
          </div>

          {/* Apply for a 0% loan: worker self-service banner. Sits directly under
              the overview cards (it was buried below the advance-requests table
              and read as invisible - UX fix 2026-07-03) and uses a primary-tinted
              highlight so the option is discoverable. Gated on the loanManagement
              subscription feature AND salary.request_loan@self. CTA opens
              LoanRequestDrawer; MyLoanRequests renders the live status below. */}
          {currentWorkspaceId && teamMemberId && loanManagement.enabled && (
            <Can module="salary" action="request_loan" scope="self">
              <div
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4"
                style={{
                  // color-mix (not the `${var}22` hex-suffix trick) - suffixing an
                  // alpha onto a var() reference is invalid CSS and gets dropped.
                  border: '1.5px solid color-mix(in srgb, var(--cr-primary) 20%, transparent)',
                  background: 'color-mix(in srgb, var(--cr-primary) 5%, transparent)',
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: 'color-mix(in srgb, var(--cr-primary) 10%, transparent)' }}
                  >
                    <RupeeOutlined className="text-lg" style={{ color: 'var(--cr-primary)' }} />
                  </div>
                  <div className="min-w-0">
                    <p className="m-0 text-[14px] font-bold text-heading">
                      {t('loanRequest.cardTitle')}
                    </p>
                    <p className="m-0 mt-0.5 text-[12px] text-muted">{t('loanRequest.cardHint')}</p>
                  </div>
                </div>
                <Button type="primary" onClick={() => setLoanDrawerOpen(true)}>
                  {t('loanRequest.applyCta')}
                </Button>
              </div>
            </Can>
          )}

          {/* My advance requests: live status of the worker's own requests. Only
              shown when advances are enabled AND the worker holds request_advance. */}
          {currentWorkspaceId && teamMemberId && advancePayments.enabled && (
            <Can module="salary" action="request_advance" scope="self">
              <MyAdvanceRequests workspaceId={currentWorkspaceId} refreshKey={advanceRefreshKey} />
            </Can>
          )}

          {/* My loan requests: live status table for the worker's 0% loan requests. */}
          {currentWorkspaceId && teamMemberId && loanManagement.enabled && (
            <Can module="salary" action="request_loan" scope="self">
              <MyLoanRequests workspaceId={currentWorkspaceId} refreshKey={loanRefreshKey} />
            </Can>
          )}

          {/* Phase 3a: team advance review card for reporting-person managers.
              Gated on salary.review_advance@self (Phase 3a plan 2026-06-22 Task 4).
              Advisory only: the card lets the holder verify (stamp) a report's request
              but does NOT change status or block the owner's approve/reject flow. */}
          {currentWorkspaceId && can('salary', 'review_advance', 'self') && (
            <TeamAdvanceReviewCard workspaceId={currentWorkspaceId} />
          )}
        </>
      )}

      {currentWorkspaceId && teamMemberId && (
        <AdvanceRequestDrawer
          open={advanceDrawerOpen}
          onClose={() => setAdvanceDrawerOpen(false)}
          workspaceId={currentWorkspaceId}
          currentMonth={currentMonth}
          currentYear={currentYear}
          onSuccess={() => setAdvanceRefreshKey((k) => k + 1)}
        />
      )}

      {currentWorkspaceId && teamMemberId && (
        <LoanRequestDrawer
          open={loanDrawerOpen}
          onClose={() => setLoanDrawerOpen(false)}
          workspaceId={currentWorkspaceId}
          onSuccess={() => setLoanRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
